"use strict"

/**
 * Manage backend websocket connection
 */
define([ 'rz_config' ], function(rz_config) {

    var rz_server_url = 'http://' + rz_config.rz_server_host + ':'
            + rz_config.rz_server_port;

    function init() {
        var socket = io.connect(rz_server_url + '/graph', {
            'reconnection' : true, // TODO: limit reconnection attempts
            'reconnectionDelay': 3000,
        });

        // wire up event handlers
        socket.on('diff_commit__topo', diff_merge__topo);
    }

    function diff_merge__topo(topo_diff) {
        console.log('ws: rx: diff_merge__topo')
    }

    return {
        init : init
    };

});
