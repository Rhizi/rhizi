/*
    This file is part of rhizi, a collaborative knowledge graph editor.
    Copyright (C) 2014-2015  Rhizi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * Manage backend websocket connection
 */
define('rz_mesh',
       [ 'util', 'model/diff', 'model/util', 'socketio', 'view/activity'],
function( util,   model_diff,   model_util,   io,              activity) {

    "use strict";

    var ws_server_url = document.location.origin + '/graph'; // socketio namespace

    var socket;
    var rz_mesh_graph_ref;

    /**
     * [!] caller is responsible of calling destroy()
     *
     * @param init_spec: expected to contain a graph:graph mapping
     */
    function init(init_spec) {

        socket = io.connect(ws_server_url, {
            'reconnectionDelay': 30000,
        });

        util.assert(undefined !== init_spec.graph, 'unable to init ws connection, graph undefined');
        rz_mesh_graph_ref = init_spec.graph;

        // wire up event handlers
        socket.on('connect', on_connect);
        socket.on('disconnect', on_disconnect);
        socket.on('error', on_error);
        socket.on('diff_commit__topo', ws_diff_merge__topo);
        socket.on('diff_commit__attr', ws_diff_merge__attr);
    }

    function destroy(init_spec) {
        socket.disconnect();
        console.log('ws: connection closed on \'beforeunload\' event'); // no one will ever see this but still
    }

    function on_connect() {
        console.log('ws: connection established: endpoint: ' + ws_server_url);
    }

    function on_disconnect() {
        console.log('ws: connection closed on peer disconnect, endpoint: ' + ws_server_url);
    }

    function on_error(err) {
        console.log('ws: error: ' + err);
    }

    /**
     * Handle websocket incoming Topo_Diffs
     *
     * @param topo_diff_cr: Topo_Diff commit result object
     */
    function ws_diff_merge__topo(topo_diff_spec_raw, topo_diff_cr) {

        // adapt from wire format, no need to do the same for id_sets
        var node_set_add = topo_diff_spec_raw.node_set_add.map(model_util.adapt_format_read_node);
        var link_ptr_set = topo_diff_spec_raw.link_set_add.map(model_util.adapt_format_read_link_ptr);

        var topo_diff_spec = { node_set_add: node_set_add,
                               link_set_add: link_ptr_set,
                               node_id_set_rm: topo_diff_spec_raw.node_id_set_rm,
                               link_id_set_rm: topo_diff_spec_raw.link_id_set_rm,
                               meta: topo_diff_spec_raw.meta };

        // [!] note: this is not a pure Topo_Diff object in the sense it contain a link_ptr_set,
        // not a resolved link object set
        var topo_diff = model_diff.new_topo_diff(topo_diff_spec); // run through validation

        console.log('ws: rx: ws_diff_merge__topo, committing wire-adapted topo_diff:', topo_diff);

        activity.incomingActivityBus.push(topo_diff_spec);
        rz_mesh_graph_ref.commit_diff__topo(topo_diff);
    }

    /**
     * Handle websocket incoming Attr_Diffs
     *
     * @param attr_diff_cr: Attr_Diff commit result object
     */
    function ws_diff_merge__attr(attr_diff_spec, attr_diff_cr) {
        var attr_diff = model_diff.new_attr_diff_from_spec(attr_diff_spec); // run through validation
        console.log('ws: rx: ws_diff_merge__attr, committing wire-adapted topo_diff:', attr_diff);

        activity.incomingActivityBus.push(attr_diff_spec);
        rz_mesh_graph_ref.commit_diff__attr(attr_diff);
    }

    function emit__rzdoc_subscribe(rzdoc_name) {
        var callback = function(data) {
            console.log('ws: rzdoc subscription acked: rzdoc name: \'' + rzdoc_name + '\'');
        };
        socket.emit('rzdoc_subscribe', { rzdoc_name: rzdoc_name}, callback);
    }

    function emit__rzdoc_unsubscribe(rzdoc_name) {
        var callback = function(data) {
            console.log('ws: rzdoc un-subscription acked: rzdoc name: \'' + rzdoc_name + '\'');
        };
        socket.emit('rzdoc_unsubscribe', { rzdoc_name: rzdoc_name}, callback);
    }

    return {
        init : init,
        destroy: destroy,
        emit__rzdoc_subscribe: emit__rzdoc_subscribe,
        emit__rzdoc_unsubscribe: emit__rzdoc_unsubscribe,
    };

});
