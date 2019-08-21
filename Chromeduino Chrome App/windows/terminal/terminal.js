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

class Terminal {
    constructor(baud){
        $('#baud').val(baud);
        this.term = $('.terminal');
        this.autoScroll = $(autoScroll);
        this.onCommand = new chrome.Event;
        this.onBaud = new chrome.Event;
    }

    message(buffer){
        this.term.append(buffer);
        if(this.autoScroll.is(':checked')){
            this.term.scrollTop(this.term.prop('scrollHeight'));
        }
    }

    setBaud(baud){
        this.onBaud.dispatch(baud);
    }

    initBaud(baud){
        $('#baud').val(baud);
    }

    command(msg){
        this.onCommand.dispatch(msg);
    }

    clear(){
        this.term.text('');
    }
}

window.terminal = null;

$(() => {

    window.terminal = new Terminal();
    let input = $('#cmdInput');

    $('#baud').change(e => {
        window.terminal.setBaud(Number($('#baud').val()));
        window.terminal.clear();
    });

    $('#cmdSend').click(e => {
        if (input.val() === '') return;
        window.terminal.command(input.val());
        input.val('');
    });

    input.keyup(e=>{
        if(e.keyCode !== 13 && e.which !== 13) return;
        $('#cmdSend').click();
    });

    $('#clear').click(e=>window.terminal.clear());

    input.focus();
});