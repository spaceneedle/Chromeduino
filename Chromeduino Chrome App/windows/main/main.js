String.prototype.lines = function() { return this.split(/\r*\n/); }
String.prototype.lineCount = function() { return this.lines().length; }

let terminalwindow = null;
let serverwindow = null;
let terminal = null;
let verbose_logging = false;
let server_address = "";
let boards = {};

chrome.Event = class {
    constructor() {
        this.listeners = [];
    }
    
    addListener(f) {
        if (!this.hasListener(f)) this.listeners.push(f);
    }
    
    removeListener(f) {
        this.listeners.splice(this.listeners.indexOf(f), 1);
    }
    
    hasListener(f) {
        return this.listeners.indexOf(f) !== -1;
    }
    
    hasListeners() {
        return !!this.listeners.length;
    }
    
    dispatch(...data) {
        this.listeners.forEach(f => f(...data));
    }
}

const new_server = ()=>{
    chrome.storage.sync.set({ "settings.server": server_address });
    $.get(server_address + '/boards').done(body=>{
        body = validate_return(body);
        if(!body) return;
        boards = body;
        chrome.storage.local.get('settings.lastBoard', function(data) {
            let lastBoard = data['settings.lastBoard'] || "none";
            let board_list = $('#board_list');
            let html = '<option value="none">Select a Board</option>';
            let exists = false;
            for(let i in boards){
                html+= `<option value="${i}">${boards[i].name}</option>`;
                if(lastBoard === i) exists = true;
            }
            board_list.html(html);
            board_list.val(exists ? lastBoard : 'none');
        });
    });
};

const open_server_menu = (showError) => {
    if(terminalwindow) return terminalwindow.show();
    chrome.app.window.create("windows/servers/servers.html", {
        "bounds": {
            "width": 400,
            "height": 700
        }
    }, serwin => {
        chrome.app.window.current().hide();
        serverwindow = serwin;
        serverwindow.onClosed.addListener(()=>{
            serverwindow = null;
            if(server_address === "") chrome.app.window.current().close();
        });

        serverwindow.contentWindow.showError = !!showError;
        serverwindow.contentWindow.server_address = server_address;
        serverwindow.contentWindow.onServerChange = new chrome.Event;
        serverwindow.contentWindow.onServerChange.addListener(seradd=>{
            server_address = seradd;
            serverwindow.close();
            chrome.app.window.current().show();
            new_server();
        });
    });
};

chrome.storage.sync.get('settings.server', function(data) {
    server_address = data['settings.server'] || "";
    if(server_address === "") return open_server_menu();
    check_server(server_address, (success, version)=>{
        if(!success) open_server_menu(true);
        else new_server();
    });
});

const set_progress = (percent, msg, isErrored, c1 = 'darkcyan', c2 = 'grey')=>{
    $('.progressbar-bar').css('background', `linear-gradient(to right, ${c1} , ${c1} ${percent}%, ${c2} ${percent}%, ${c2} )`);
    let label = $(".progress-label");
    if(msg) label.text(msg);
    if(isErrored) label.addClass('label-error');
    else label.removeClass('label-error');
};

const console_el = $('.console');
const spanout = $('.stdout');
const spanerr = $('.stderr');
const display_console = (stdout, stderr, joiner=false) => {

    if(joiner === false){
        spanout.text('');
        spanerr.text('');
    }
    if(stdout) spanout.text(spanout.text() ? spanout.text() + joiner + stdout : stdout);
    if(stderr) spanerr.text(spanerr.text() ? spanerr.text() + joiner + stderr : stderr);
    console_el.scrollTop(console_el.prop('scrollHeight'));
};

const ensure_connection = (cb) => {
    if(!cb) cb = ()=>{};
    if(connection.isConnected())return cb(true);
    let devicePath = $('#port_list').val();
    if(!devicePath || devicePath === '' || devicePath === 'none'){
        display_console("", "Port not selected, please go to Tools > Ports.");
        return cb(false);
    }
    let done = function(){
        connection.onConnect.removeListener(done);
        connection.onError.removeListener(fail);
        cb(true);
        chrome.storage.local.set({'settings.lastPort': devicePath});
    };
    let fail = function(err){
        console.error(err);
        connection.onConnect.removeListener(done);
        connection.onError.removeListener(fail);
        cb(false);
    };
    connection.onConnect.addListener(done);
    connection.onError.addListener(fail);
    connection.connect(devicePath);
};

const display_ports = () => {
    // Populate the list of available devices
    connection.getDevices(function(ports) {
        console.log(ports);
        const dropDown = document.querySelector('#port_list');
        dropDown.innerHTML = "";
        ports.unshift({displayName: "Select a Port", path: "none"});

        chrome.storage.local.get('settings.lastPort', function(data) {
            let lastPort = data['settings.lastPort'] || "none";
            let exists = false;

            ports.forEach(function (port) {
                let displayName = port.displayName ? `${port.displayName} (${port.path})` : port.path;
                if(port.path === lastPort) exists = true;
                if(port.path === 'none') displayName = port.displayName;

                let newOption = document.createElement("option");
                newOption.text = displayName;
                newOption.value = port.path;
                dropDown.appendChild(newOption);
            });
            if(exists) $(dropDown).val(lastPort);
        });
    });
};

var hexfile = "";
var editor = null;
var defaultsketch = "\n\nvoid setup(){\n  \n}\n\nvoid loop(){\n  \n}\n";
var workingfile = null;
var termmode = 1;
var keytx = 0;

$( document ).ready(function(){


    $.get('./blink.ino').done(text=>{
        $('#editor').text(text);
    }).always(()=>{
        editor = ace.edit("editor");
        editor.setTheme("ace/theme/xcode");
        editor.getSession().setMode("ace/mode/c_cpp");
        console.log("ready");

        Split(['#editor', '.console'], {
            sizes: [80, 20],
            minSize: 100,
            direction: 'vertical',
            gutter: (index, direction) => {
                const gutter = document.createElement('div');
                gutter.className = `progressbar-bar gutter gutter-${direction}`;
                const label = document.createElement('div');
                label.className = 'progress-label';
                gutter.appendChild(label);
                return gutter;
            },
            gutterStyle: (dimension, gutterSize)=>{
                return {'min-height': '2em'};
            },
            onDrag: () => {
                editor.resize();
            },
            onDragEnd: () => {
                editor.resize();
            }
        });
        set_progress(0, "Welcome");
    });

    display_ports();
    $('#refresh-ports').click(function(){
        display_ports();
        $(this).find('i').addClass('fa-spin');
        setTimeout(()=>{
            $(this).find('i').removeClass('fa-spin');
        }, 500);
    });

    $('#change-server').click(e=>{
        open_server_menu(false);
    });

    $('#board_list').change(function(e){
        let value = $(this).val();
        if(!value || value === '' || value === 'none') return;
        chrome.storage.local.set({'settings.lastBoard': value});
    });

    $("#newproject").click(function(e) {
        //$("#dark").toggle();
        //$("#newsure").toggle("off");
        editor.getSession().setValue(defaultsketch);
        workingfile = null;
    });
  
    $("#term").click(function(e) {
        if(terminalwindow) return terminalwindow.show();
        ensure_connection(success=> {
            if(!success) return;
            chrome.app.window.create("windows/terminal/terminal.html", {
                "bounds": {
                    "width": 800,
                    "height": 350
                }
            }, termwin => {
                terminalwindow = termwin;
                terminalwindow.onClosed.addListener(() => {
                    terminalwindow = null;
                    terminal = null;
                    if(termmode === 1) connection.disconnect();
                });

                let init_term = () => {
                    terminal = terminalwindow.contentWindow.terminal;
                    if (!terminal) return setTimeout(init_term, 10);
                    terminal.initBaud(connection.baud);
                    terminal.onBaud.addListener(baud => connection.setBaud(baud));
                    terminal.onCommand.addListener(msg => connection.send(msg));
                };
                terminalwindow.contentWindow.addEventListener('load', init_term);
            });
        });
    });

    let saving = false;

    const saveFile = writableFileEntry => {
        workingfile = writableFileEntry;
        let errorHandler = (err) => {
            console.error(err);
            set_progress(0, 'Error occured and could not save file.', true);
            saving = false;
        };
        writableFileEntry.createWriter(function(writer) {
            writer.onerror = errorHandler;
            writer.onwriteend = function(e) {
                console.log('write complete');
                set_progress(100, 'File Saved.');
                saving = false;
            };
            writer.write(new Blob([editor.getSession().getValue()], {type: 'text/plain'}));
        }, errorHandler);
    };

    $("#save").click(function(e) {
        if(saving) return;
        saving = true;
        if(workingfile) chrome.fileSystem.getWritableEntry(workingfile, saveFile);
        else chrome.fileSystem.chooseEntry({type: 'saveFile'}, saveFile);
    });

    $("#saveas").click(function(e) {
        if(saving) return;
        saving = true;
        chrome.fileSystem.chooseEntry({type: 'saveFile'}, saveFile);
    });

    $(document).keyup(e=>{
        if(e.ctrlKey && !e.shiftKey && !e.altKey && (e.which === 83 || e.keyCode === 83)){
            $("#save").click();
        }
    });
  
    $("#load").click(function(){
        chrome.fileSystem.chooseEntry({type: 'openFile'}, function(readOnlyEntry) {
            console.log(readOnlyEntry);
            workingfile = readOnlyEntry;
            readOnlyEntry.file(function(file) {
                console.log(file);
                var reader = new FileReader();
                reader.onerror = function(stuff) {
                    log("error", stuff);
                    log("\n");
                    log (stuff.getMessage());
                    log("\n");
                    set_progress(0, 'Error loading file.', true);
                };
                reader.onloadend = function(e) {
                    editor.getSession().setValue(e.target.result);
                    set_progress(100, 'File loaded.');
                };

                reader.readAsText(file);
            });
        });
    });
  
  

  


    $("#program").click(function() {
        let board = $('#board_list').val();
        if(!board || board === '' || board === 'none'){
            display_console("", "Board not selected, please go to Tools > Board.");
            return set_progress(0, "Error in finding board", true);
        }
        set_progress(0, "connecting to device");
        ensure_connection(success => {
            if (!success) {
                return set_progress(0, 'Error in connecting to device.', true);
            }
            set_progress(10, "Packaging file...");
            let sketchfile = editor.getSession().getValue();//btoa(editor.getSession().getValue());
            set_progress(20, "Uploading to compiler server...");
            display_console("Uploading to remote compiling server: " + server_address);
            $.post(server_address + "/compile", {sketch: sketchfile, board}, function (data) {
                console.log(data);
                display_console(data.stdout, data.stderr, '\n\n');
                if (!data.success) {
                    set_progress(0, data.msg, true);
                    return;//console.error(data.stderr || data.msg);
                }
                termmode = 0;
                connection.tempBaud(boards[board].upload_speed, success=> {
                    if(!success){
                        display_console("", "Could not set baudrate.", '\n\n');
                        return set_progress(0, "Error in preparing board", true);
                    }
                    set_progress(30, "Processing results...");
                    hexfileascii = atob(data.hex);
                    console.log("Got file contents, running hex fixer");
                    set_progress(40, "Decoding Intel Hex file...");
                    fixHex();
                });
            });
        });
    });

    $("#check").click(function() {
        let board = $('#board_list').val();
        if(!board || board === '' || board === 'none'){
            display_console("", "Board not selected, please go to Tools > Board.");
            return set_progress(0, "Error in finding board", true);
        }
        set_progress(10, "Packaging file...");
        let sketchfile = editor.getSession().getValue();//btoa(editor.getSession().getValue());
        set_progress(50, "Uploading to compiler server...");
        display_console("Uploading to remote compiling server: " + server_address);
        $.post( server_address + "/compile", { sketch: sketchfile, board}, function( data ) {
            console.log(data);
            display_console(data.stdout, data.stderr, '\n\n');
            if(!data.success){
                set_progress(0, data.msg, true);
                return;//console.error(data.stderr || data.msg);
            }
            set_progress(100, "Compiled Successfully!");
            display_console('Done Compiling! Have a nice day! :)', '', '\n\n');
        });
    });



/*
// Handle the 'Connect' button
document.querySelector('#connect_button').addEventListener('click', function() {

 // $("#connect_box").dialog("close");
  // get the device to connect to
  var dropDown = document.querySelector('#port_list');
  var devicePath = dropDown.options[dropDown.selectedIndex].value;
  console.log(devicePath);
  // connect
connection.connect(devicePath);
  $("#connect_box").toggle("explode");
  $("#dark").toggle("explode");
});
  
  
document.querySelector('#demo_button').addEventListener('click', function() {
  $("#connect_box").toggle("explode");
  $("#dark").toggle("explode");
});  */
  
    $( document ).keypress(function() {
        $("#numbers").html("");
        var lines = $("#editor").val().lineCount();
        for(x = 1; x <= lines; x++) {
            $("#numbers").append(x+"\n");
        }
    });
});


function stk500_program() {
    set_progress(60, "Putting Arduino in program mode (DTR Reset)...");
    serial.setControlSignals(connection.connectionId,DTRRTSOff,function(result) {
        console.log("DTR off: " + result);
        setTimeout(function(){
            serial.setControlSignals(connection.connectionId,DTRRTSOn,function(result) {
                console.log("DTR on:" + result);
                setTimeout(function() {
                    set_progress(70, "Reset complete...prepping upload blocks..");
                    log("Arduino reset, now uploading.\n");
                    stk500_upload(hexfile);
                },200);
            });
        }, 100);
    });
}



/* code from AVRChick */

/* set up some variables */

const serial = chrome.serial;
var seq = 1;

/* STK500 commands */

SIGN_ON_MESSAGE = "AVR STK";

command = {

"Sync_CRC_EOP" : 0x20,  
"GET_SYNC" : 0x30,
"GET_SIGN_ON" : 0x31,
"SET_PARAMETER" : 0x40,
"GET_PARAMETER" : 0x41,
"SET_DEVICE" : 0x42,
"SET_DEVICE_EXT" : 0x45,                
"ENTER_PROGMODE" : 0x50,
"LEAVE_PROGMODE" : 0x51,
"CHIP_ERASE" : 0x52,
"CHECK_AUTOINC" : 0x53,
"LOAD_ADDRESS" : 0x55,
"UNIVERSAL" : 0x56,
"UNIVERSAL_MULTI" : 0x57,
"PROG_FLASH" : 0x60,
"PROG_DATA" : 0x61,
"PROG_FUSE" : 0x62,
"PROG_LOCK" : 0x63,
"PROG_PAGE" : 0x64,
"PROG_FUSE_EXT" : 0x65,        
"READ_FLASH" : 0x70,
"READ_DATA" : 0x71,
"READ_FUSE" : 0x72,
"READ_LOCK" : 0x73,
"READ_PAGE" : 0x74,
"READ_SIGN" : 0x75,
"READ_OSCCAL" : 0x76,
"READ_FUSE_EXT" : 0x77,        
"READ_OSCCAL_EXT" : 0x78
};


parameters = {
"HW_VER" : 0x80,
"SW_MAJOR" : 0x81,
"SW_MINOR" : 0x82,
"LEDS": 0x83,
"VTARGET": 0x84,
"VADJUST": 0x85,
"OSC_PSCALE" : 0x86,
"OSC_CMATCH" : 0x87,
"RESET_DURATION" : 0x88,
"SCK_DURATION" : 0x89,
"BUFSIZEL" : 0x90, 
"BUFSIZEH" : 0x91,
"DEVICE" : 0x92, 
"PROGMODE" : 0x93,
"PARAMODE" : 0x94, 
"POLLING" : 0x95, 
"SELFTIMED" : 0x96, 
"TOPCARD_DETECT" : 0x98
};


responses = { 
  0x10 : "OK",               
  0x11 : "FAILED",
  0x12 : "UNKNOWN",
  0x13 : "NODEVICE",
  0x14 : "INSYNC",
  0x15 : "NOSYNC"
};

var DTRRTSOn = { dtr: true, rts: true }; 
var DTRRTSOff = { dtr: false, rts: false };

function transmitPacket(buffer,delay) {
    setTimeout(function() {
        display_console('.', '', '');
        if(verbose_logging){
            var debug = "";
            for (x = 0; x < buffer.length; x++) {
                debug += "[" + buffer.charCodeAt(x).toString(16) + "]";
            }
            console.log(debug);
        }
        connection.send(buffer);
    },delay + timer);
    timer = timer + delay;
}

var oneshot = 0;
var timer = 0;

function stk500_test() {
    oneshot = 0;
    // transmitPacket(String.fromCharCode(0xF0)+String.fromCharCode(0xF0)+String.fromCharCode(0xF0)+String.fromCharCode(0xF0),20);
    transmitPacket(String.fromCharCode(command.GET_SYNC)+""+String.fromCharCode(command.Sync_CRC_EOP),0);
    transmitPacket(String.fromCharCode(command.GET_SYNC)+""+String.fromCharCode(command.Sync_CRC_EOP),10);
    transmitPacket(String.fromCharCode(command.GET_SYNC)+""+String.fromCharCode(command.Sync_CRC_EOP),10);
    stk500_getparam("HW_VER",50);
    stk500_getparam("SW_MAJOR",50);
    stk500_getparam("SW_MINOR",50);
    stk500_getparam("TOPCARD_DETECT",50);
    timer = 0;
}

function stk500_getparam(param,delay) {
    transmitPacket("A"+String.fromCharCode(parameters[param])+String.fromCharCode(command.Sync_CRC_EOP),delay);
}

function d2b(number) {
    return String.fromCharCode(number);
}

/* to program a page, we need to load in the address of flash memory. This address is independent of the bootloader space 
 the next step is to then provide up to 128 bytes of data over serial. There is a 0x00 and 0x46 that appears in the command.
 I have no idea what this does, but AVRDude uses this */

function stk500_prgpage(address,data,delay,flag) {
  address = hexpad16(address.toString(16)); /* convert and pad number to hex */
  address = address[2] + address[3] + address[0] + address[1];  /* make LSB first */
  if(verbose_logging) console.log("Programming 0x"+address);
  address = String.fromCharCode(parseInt(address[0] + address[1],16)) +  String.fromCharCode(parseInt(address[2] + address[3],16)); /* h2b */
  transmitPacket(d2b(command.LOAD_ADDRESS)+address+d2b(command.Sync_CRC_EOP),delay);
  var debug = "";
  var datalen = data.length;
  buffer = "";
  transmitPacket(d2b(command.PROG_PAGE)+d2b(0x00)+d2b(datalen)+d2b(0x46)+data+d2b(command.Sync_CRC_EOP),delay);
  
}

function stk500_upload(heximage) {
    flashblock = 0;
    transmitPacket(d2b(command.ENTER_PROGMODE)+d2b(command.Sync_CRC_EOP),50);
    var blocksize = 128;
    blk = Math.ceil(heximage.length / blocksize);
    termmode = 0;
    display_console("Binary data broken into "+blk+" blocks (block size is 128)\nComplete when you see "+blk+" dots: \n\n", "", "\n");
    set_progress(80, "Serial upload...");
    for(b = 0; b < Math.ceil(heximage.length / blocksize); b++) {
        var currentbyte = blocksize * b;
        var block = heximage.substr(currentbyte,blocksize);
        /* console.log("Block "+b+" starts at byte "+currentbyte+": "+block) */
        flag = 0;
        stk500_prgpage(flashblock,block,250);
        flashblock = flashblock + 64;
    }
    setTimeout(function () {
        connection.resetBaud(success => {
            set_progress(100, "Serial programming finished.");
            display_console("Upload Complete! Have a nice day! :)", success ? "" : "Could not reset baudrate", "\n\n");
            termmode = 1;
            if (!terminalwindow) connection.disconnect();
            if (terminal) terminal.clear();
        });
    },timer + 1000);

    timer = 0;
}
  
 

/* pads an 8 bit number */

function hexpad(num,size) { 
      var size = 2;
      var s = "00" + num;
    return s.substr(s.length-size);
    }

/* pads an 16 bit number */

function hexpad16(num,size) { 
      var size = 4;
      var s = "0000" + num;
    return s.substr(s.length-size);
    }


/* Interprets an ArrayBuffer as UTF-8 encoded string data. */
var ab2str = function(buf) {
  var bufView = new Uint8Array(buf);
  var encodedString = String.fromCharCode.apply(null, bufView);
  if(verbose_logging) console.log(encodedString);
  return decodeURIComponent(encodeURIComponent(encodedString));
};

/* Converts a string to UTF-8 encoding in a Uint8Array; returns the array buffer. */
var str2ab = function(str) {
 // var encodedString = unescape(encodeURIComponent(str));
  var encodedString = str;
  var bytes = new Uint8Array(encodedString.length);
  for (var i = 0; i < encodedString.length; ++i) {
    bytes[i] = encodedString.charCodeAt(i);
  }
  return bytes.buffer;
};

////////////////////////////////////////////////////////
////////////////////////////////////////////////////////

/* i stole chrome's arduino serial port example, thanks guys for the great foundation to build up from. no idea what half this crap is. */

var SerialConnection = function() {
    this.connectionId = -1;
    this.baud = 115200;
    this.lineBuffer = "";

    this.boundOnReceive = this.onReceive.bind(this);
    this.boundOnReceiveError = this.onReceiveError.bind(this);
    serial.onReceive.addListener(this.boundOnReceive);
    serial.onReceiveError.addListener(this.boundOnReceiveError);

    this.onConnect = new chrome.Event();
    this.onReadLine = new chrome.Event();
    this.onError = new chrome.Event();
};


SerialConnection.prototype.onReceive = function(receiveInfo) {
  if (receiveInfo.connectionId !== this.connectionId) {
    return;
  }

  this.lineBuffer += ab2str(receiveInfo.data);
  var d = new Date();
  var n = d.getMilliseconds();
  var buffer = this.lineBuffer;
  var decoded = "";
  for(x = 0; x < buffer.length; x++ )
     { decoded += "[" + buffer.charCodeAt(x).toString(16) + "]"; }
  // console.log(n+" length: "+buff.length);
  if(verbose_logging) console.log(n+" received data: "+decoded);
  /*if(termmode == 1) {

//    $("#terminal").text() = tlen.substr(0,tlen.length-1);
 // $("#terminal").append(buffer+"&#9608;"); }
    
    $("#terminal").append(buffer); var elem = document.getElementById('terminal');
    elem.scrollTop = elem.scrollHeight; } */
  if(terminal && termmode === 1) terminal.message(buffer);
  this.lineBuffer = "";
  var index;
  while ((index = this.lineBuffer.indexOf('\n')) >= 0) {
    var line = this.lineBuffer.substr(0, index + 1);
    this.onReadLine.dispatch(line);
    this.lineBuffer = this.lineBuffer.substr(index + 1);
  }
};

SerialConnection.prototype.onReceiveError = function(errorInfo) {
  if (errorInfo.connectionId === this.connectionId) {
    this.onError.dispatch(errorInfo);
  }
};

SerialConnection.prototype.getDevices = function(callback) {
  serial.getDevices(callback);
};


    
    
    
SerialConnection.prototype.connect = function(path) {
  serial.connect(path, {bitrate: this.baud}, connectionInfo => {
      if (!connectionInfo) {
          log("Connection failed.");
          return;
      }
      this.connectionId = connectionInfo.connectionId;
      this.onConnect.dispatch();
      serial.setControlSignals(connection.connectionId,DTRRTSOn,function(result) {
          console.log("DTR on: " + result);
      });
  })
};

SerialConnection.prototype.send = function(msg) {
  if (this.connectionId < 0) {
    throw 'Invalid connection';
  }
  serial.send(this.connectionId, str2ab(msg), function() {});
};

SerialConnection.prototype.disconnect = function() {
    if (this.connectionId < 0) {
        throw 'Invalid connection';
    }
    serial.disconnect(this.connectionId, success => {
        if(!success) console.error('could not disconnect');
        this.connectionId = -1;
    });
};

SerialConnection.prototype.setBaud = function(baud) {
    if (this.connectionId < 0) {
        throw 'Invalid connection';
    }
    if(this.baud === baud) return;
    serial.update(this.connectionId, {bitrate: baud}, success => {
        if(success) {
            console.log("Baud for connection set to " + baud);
            this.baud = baud;
        }
        else console.error("Could not set baud rate.");
    });
};

SerialConnection.prototype.tempBaud = function(baud, cb) {
    if (this.connectionId < 0) {
        throw 'Invalid connection';
    }
    serial.update(this.connectionId, {bitrate: baud}, success => {
        if(success) {
            console.log("Baud for connection set to " + baud + " temporarily");
        }
        else console.error("Could not set baud rate.");
        cb(success);
    });
};

SerialConnection.prototype.resetBaud = function(cb) {
    if (this.connectionId < 0) {
        throw 'Invalid connection';
    }
    serial.update(this.connectionId, {bitrate: this.baud}, success => {
        if(success) {
            console.log("Baud for connection set back to " + this.baud);
        }
        else console.error("Could not set baud rate.");
        cb(success);
    });
};

SerialConnection.prototype.isConnected = function() {
    return this.connectionId > 0;
};


const connection = new SerialConnection();


////////


function getHiddenProp(){
    var prefixes = ['webkit','moz','ms','o'];
    
    // if 'hidden' is natively supported just return it
    if ('hidden' in document) return 'hidden';
    
    // otherwise loop over all the known prefixes until we find one
    for (var i = 0; i < prefixes.length; i++){
        if ((prefixes[i] + 'Hidden') in document) 
            return prefixes[i] + 'Hidden';
    }

    // otherwise it's not supported
    return null;
}

function isHidden() {
    var prop = getHiddenProp();
    if (!prop) return false;
    
    return document[prop];
}

function notify(msisdn,text) { 
var myNotification = new Notify('Iridium', {
    body: msisdn+": "+text,
  icon: "9555.jpg",
  timeout: 10,
    notifyShow: onNotifyShow
});

function onNotifyShow() {
    console.log('notification was shown!');
}
myNotification.show();

}

var hexfile = "";
var chosenFileEntry = null;
var hexfileascii = "";


/* convert the ASCII hex into binary */

function fixHex() {
    hexfile = "";
    buffer = hexfileascii.split("\n");
    for(x = 0; x < buffer.length; x++) {
        size = parseInt(buffer[x].substr(1,2),16);
        if(size == 0) {
            log("complete!\n");
            set_progress(50, "Intel Hex decoded, launching programmer...");
            stk500_program();
            return;
        }
        for(y = 0; y < (size * 2); y = y + 2){
            // console.log(buffer[x].substr(y+9,2));
            hexfile += String.fromCharCode(parseInt(buffer[x].substr(y+9,2),16));
        }
    }
}


function reset() { 
    log("Resetting device....");
    serial.setControlSignals(connection.connectionId,DTRRTSOff,function(result) {
        console.log("DTR off: " + result);
        setTimeout(function(){
            serial.setControlSignals(connection.connectionId,DTRRTSOn,function(result) {
                console.log("DTR on:" + result);
                log("done.\n");
            });
        }, 100);
    });
}


function log(text) { 
console.log(text);

}





    
