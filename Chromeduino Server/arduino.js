const { exec } = require('child_process');
const fs = require('fs');
const properties = require ("properties");
const tmp = require('tmp');

const errorCodes = {
    0: "Success",
    1: "Build failed or upload failed",
    2: "Sketch not found",
    3: "Invalid (argument for) commandline option",
    4: "Preference passed to --get-pref does not exist"
};

const process_file = (path, cb)=>{
    fs.readFile(path, 'utf8', (err, file)=>{
        if(err) return cb(err);
        // make boards.txt file compatible
        file = file.replace('\n\r', '\n');
        file = file.replace('\r', '\n');
        file = file.split('\n');
        for(let i in file){
            if(file[i].indexOf('=') === -1) continue;
            let key = file[i].replace(/=.*/, '');
            if(key.search(/menu.cpu.[^.]*$/) !== -1) file[i] = file[i].replace('=', '.name=');
            if(key.search(/.vid.\d+$/) !== -1) file[i] = file[i].replace('=', '.value=');
        }
        file = file.join('\n');
        properties.parse(file,{namespaces: true}, cb);
    });
};

class Arduino {
    constructor (arduino_dir) {
        this.dir = arduino_dir;
        this.buildcmd = `"${this.dir}/arduino-builder" -hardware "${this.dir}/hardware" -libraries "${this.dir}/libraries"`;
        let tools  = ['/hardware/tools', '/tools', '/tools-builder'];
        for(let i in tools) this.buildcmd += ` -tools "${this.dir}${tools[i]}"`;
        this.libraries = [];
        this.boards = {};
        this.loadLibraries().catch(console.error);
        this.loadBoards().catch(console.error);
    }

    loadLibraries(){
        return new Promise((resolve, reject) => {
            fs.readdir(`${this.dir}/libraries`, (err, files)=>{
                if(err) reject(err);
                if(files.length < 1) return resolve([]);
                let count = 0;
                let libs = [];
                let done = (err)=>{
                    count++;
                    if(err) console.error(err);
                    if(count === files.length){
                        this.libraries = libs;
                        resolve(libs);
                    }
                };
                files.forEach(file=>{
                    process_file(`${this.dir}/libraries/${file}/library.properties`, (err, data)=>{
                        if(err) return done(err);
                        if(!data.name || !data.version) return done(`The library ${file} is missing a name and/or version in it's properties file.`);
                        libs.push(data);
                        done();
                    });
                });
            });
        });
    }

    loadBoards(){ //this will need to become more dynamic
        return new Promise((resolve, reject) => {
            process_file(`${this.dir}/hardware/arduino/avr/boards.txt`, (err, data)=>{
                if(err) return reject(err);
                let boards = {};
                for(let i in data){
                    if(i === 'menu') continue;
                    let board = 'arduino:avr:' + i;
                    let name = data[i].name || i;
                    if(data[i].menu && data[i].menu.cpu){
                        for(let j in data[i].menu.cpu){
                            let boardcpu = board + ':cpu=' + j;
                            let cpuname = data[i].menu.cpu[j].name || j;
                            boards[boardcpu] = {name: name + ' / ' + cpuname, upload_speed: data[i].menu.cpu[j].upload.speed};
                        }
                    } else {
                        boards[board] = {name: name, upload_speed: data[i].upload.speed};
                    }
                }
                this.boards = boards;
                resolve(boards);
            });
        });
    }

    compile(code, board="arduino:avr:uno", verbose){
        return new Promise((resolve, reject) => {
            if(!this.boards[board]) return resolve({success: false, msg: "Unknown board provided"});
            if(/#\s*include\s*<\.*\/.*>/.test(code)) resolve({success: false, msg: 'Security out-of-bounds'});
            verbose = verbose ? '-verbose' : '';
            tmp.dir({prefix: 'chromeduino-', unsafeCleanup: true}, (err, path, cleanup)=>{
                if(err) return reject(err);
                console.log(path);
                let codeFile = path.replace(/^.*\//, '')+'.ino';
                fs.writeFile(path + '/' + codeFile, code, err => {
                    if(err) return reject(err);
                    fs.mkdir(path+'/compiled', err=>{
                        if(err) return reject(err);
                        let cmd = `${this.buildcmd} ${verbose} -fqbn ${board} -build-path "${path}/compiled" "${path}/${codeFile}"`;
                        exec(cmd, (err, stdout, stderr)=>{
                            stderr = stderr.split(this.dir).join('~/arduino-1.8.5');
                            stdout = stdout.split(this.dir).join('~/arduino-1.8.5');
                            if(err){
                                cleanup();
                                return resolve({success: false, msg: errorCodes[err.code], code: err.code, stdout, stderr});
                            }
                            fs.readFile(path + '/compiled/' + codeFile + '.hex', 'base64', (err, hexcode)=>{
                                if(err) {
                                    cleanup();
                                    return reject(err);
                                }
                                cleanup();
                                resolve({success: true, hex: hexcode, stdout, stderr});
                            });
                        });
                    });
                });
            });
        });
    }

}

module.exports = Arduino;