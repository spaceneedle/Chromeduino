const validate_return = body =>{
    if(typeof body === 'string'){
        try{
            body = JSON.parse(body);
        } catch(e){
            console.error("invalid version format returned by server: " + body);
            return false;
        }
    } else if(typeof body !== 'object'){
        console.error('no clue what was returned...');
        return false;
    }
    return body;
};

const valid_server_version = (ver) =>{
    if(typeof ver !== 'string') return false;
    let required = [0, 0, 1];
    let given  = ver.split('.');
    for(let i in given){
        let sect = Number(given[i]);
        if(isNaN(sect)) return false;
        if(sect > required[i]) return true;
        if(sect < required[i]) return false;
    }
    return true;
};

const check_server = (address, cb) => {
    if(!cb) cb = ()=>{};
    $.get(address + '/version').done(body=>{
        body = validate_return(body);
        if(!body){
            console.error(address + " -- invalid version type returned by server: " + body);
            return cb(false, null);
        }
        if(typeof body.version !== 'string' || typeof body.program !== 'string' || body.program !== 'chromeduino'){
            console.error(address + " -- invalid version format returned by server: " + body);
            return cb(false, null);
        }
        if(!valid_server_version(body.version)) {
            console.error(address + " -- invalid server version: " + body);
            return cb(false, body.version);
        }
        return cb(true, body.version);
    }).fail(()=>{
        console.error(address + " -- could not reach server");
        return cb(false, null);
    });
};