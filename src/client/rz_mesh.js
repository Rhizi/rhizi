"use strict"

/**
 * Manage backend websocket connection
 */
define([ 'rz_config', 'util', 'model/diff', 'socketio'], function(rz_config, util, model_diff, io) {

    var ws_server_url = 'http://' + rz_config.rz_server_host + ':'
                        + rz_config.rz_server_port
                        + '/graph'; // socketio namespace

    var rz_mesh_graph_ref;

    /**
     * @param init_spec: expected to contain a graph:graph mapping
     */
    function init(init_spec) {

        var socket = io.connect(ws_server_url, {
            'reconnectionDelay': 3000,
        });

        util.assert(undefined != init_spec.graph, 'unable to init ws connection, graph undefined');
        rz_mesh_graph_ref = init_spec.graph;

        // wire up event handlers
        socket.on('connect', on_connect);
        socket.on('disconnect', on_disconnect);
        socket.on('error', on_error);
        socket.on('diff_commit__topo', diff_merge__topo);
        socket.on('diff_commit__attr', diff_merge__attr);
    }

    function on_connect() {
        console.log('ws: connection established: endpoint: ' + ws_server_url);
    }

    function on_disconnect() {
        // TODO: call when possible
    }

    function on_error(err) {
        console.log('ws: error: ' + err);
    }

    function diff_merge__topo(topo_diff_raw) {
        console.log('ws: rx: diff_merge__topo');
        var topo_diff_json = JSON.parse(topo_diff_raw);
        var topo_diff = model_diff.new_topo_diff(topo_diff_json);
        rz_mesh_graph_ref.commit_diff__topo(topo_diff);
    }

    function diff_merge__attr(attr_diff_raw) {
        console.log('ws: rx: diff_merge__attr');
        var attr_diff_json = JSON.parse(attr_diff_raw);
        var attr_diff = model_diff.new_attr_diff(attr_diff_json);
        rz_mesh_graph_ref.commit_diff__attr(attr_diff);
    }

    return {
        init : init
    };

});
