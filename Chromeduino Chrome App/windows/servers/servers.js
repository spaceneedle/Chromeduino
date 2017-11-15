const servers_url = "https://raw.githubusercontent.com/mrfrase3/Chromeduino/server-implementation/servers.json";

const use_server = address => {
    if(address.indexOf('http') !== 0) address = 'http://' + address;
    check_server(address, (success, version)=>{
        if(success) return window.onServerChange.dispatch(address);
        $('.header').show();
        $(`.server-item[data-address="${address}"]`).remove();
    });
};

const compile_server_list = (servers, server_el) => {
    let html = "";
    let count = 0;
    const done = server =>{
        count++;
        if(server) html += `<li class='server-item' data-address='${server.address}'><table>`;
        for(let i in server){
            html += `<tr><th>${i}</th><td>${server[i]}</td></tr>`;
        }
        html += "</table></li>";
        if(count === servers.length) {
            if (html === "") html = "<li class='server-error'>No valid compile severs were found.</li>";
            server_el.html(html);
            $('.server-item').click(function(e){
                use_server($(this).attr("data-address"));
            });
        }
    };
    servers.forEach(server=>{
        check_server(server.address, (success, version)=>{
            if(!success) return done(null);
            server.version = version;
            done(server);
        });
    });
};

$(()=>{
    const server_list = $('.server-list');
    const input = $('#serverInput');

    $.get(servers_url).done(body=>{
        body = validate_return(body);
        if(!body){
            return server_list.html("<li class='server-error'>Could not load servers list, please contact the developers.</li>");
        }
        compile_server_list(body, server_list);

    }).fail(()=>{
        server_list.html("<li class='server-error'>Could not load servers list, please check your internet connection.</li>");
    });

    $('.errclose').click(e=>{
        $('.header').hide();
    });

    $('.header').toggle(window.showError);

    $('#serverSend').click(e => {
        if (input.val().trim() === '') return;
        use_server(input.val().trim());
    });

    input.keyup(e=>{
        if(e.keyCode !== 13 && e.which !== 13) return;
        $('#serverSend').click();
    });

    input.val(window.server_address || "");
});