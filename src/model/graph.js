"use strict"

define(['Bacon', 'consts', 'util', 'model/core', 'model/util', 'rz_api_backend', 'rz_api_mesh', 'history', 'rz_bus'],
function (Bacon, consts, util, model_core, model_util, rz_api_backend, rz_api_mesh, history, rz_bus) {

var debug = false;

function Graph() {

    var nodes = [],
        links = [],
        diffBus = new Bacon.Bus();

    this.diffBus = diffBus;

    /**
     * add node if no previous node is present whose id equals that of the node being added
     *
     * @return node if node was actually added
     */
    this.addNode = function(spec) {
        var node = this.__addNode(spec);
        if (node) {
            return node;
        }
    }

    /**
     * Inner implementation
     *
     * @param notify whether or not a presenter notification will be sent, default = true
     */
    this.__addNode = function(spec, notify) {
        var existing_node,
            node;

        notify = undefined === notify ? true : notify;

        if (undefined == spec.id) {
            existing_node = findNodeByName(spec.name)
            if (existing_node){
                return existing_node;
            } else {
                node = model_core.create_node__set_random_id(spec);
                if (debug) {
                    if ('bubble' == node.type){
                        console.debug('__addNode: stamping node id: ' + node.id + ', name: \'' + node.name + '\' (bubble)');
                    }else {
                        console.debug('__addNode: stamping node id: ' + node.id + ', name: \'' + node.name + '\'');
                    }
                }
            }
        } else {
            node = model_core.create_node_from_spec(spec);
        }

        existing_node = findNode(node.id, null);
        if (existing_node) {
            console.debug('__addNode: id collision: existing-node.id: \'' + existing_node.id + '\', ' + 'new-node.id: \'' + node.id + '\'');
            return existing_node;
        }

        nodes.push(node);

        if (notify) {
            diffBus.push({nodes: {add: [node]}});
        }

        return node;
    }

    this._removeNodes = function(ns) {
        for (var j = 0; j < ns.length; j++) {
            var n = ns[j];
            var i = 0;
            while (i < links.length) {
                if ((links[i]['__src'] === n) || (links[i]['__dst'] == n)) links.splice(i, 1);
                else i++;
            }
            var index = findNodeIndex(n.id, n.state);
            if (index !== undefined) {
                nodes.splice(index, 1);
            }
        }
        if (ns.length > 0) {
            diffBus.push({nodes: {removed: ns.map(function(n) { return n.id; })}});
        }
    }

    this.removeNode = function(id, state) {
        var i = 0;
        var n = findNode(id, state);
        this._removeNodes([n]);
    }

    this.removeNodes = function(state) {
        var id = null;
        var ns = findNodes(null, state);
        this._removeNodes(ns);
    }

    /**
     *
     * getConnectedNodesAndLinks
     *
     * @id
     * @state - defines the starting node (must have id and state)
     * @d - depth defining connected component. If -1 returns the entire connected component. (can be the whole graph)
     *
     * NOTE: chainlinks are treated specially, they don't count for distance. So all their decendants will be added.
     *
     * NOTE: temp state nodes (n.state === 'temp') are ignored.
     *
     * @return - {
     *  'node': [node]
     *  'link': [link]
     *  }
     *
     * TODO: rewrite using efficient data structure. Right now iterates over everything
     * TODO: implement for d !== 1
     *
     */
    this.getConnectedNodesAndLinks = function(chosen_nodes, d) {
        var ret = {'nodes':[], 'links':[]};

        function addNode(node) {
            if (chosen_nodes.filter(function (n) { return n.id == node.id; }).length == 1) {
                return;
            }
            ret.nodes.push(node);
        }
        function same(n1, n2) {
            // XXX: using name comparison because one of the nodes might be stale
            return compareNames(n1.name, n2.name);
        }

        if (chosen_nodes === undefined) {
            console.log('getConnectedNodesAndLinks: bug: called with undefined node');
            return;
        }
        if (d !== 1) {
            console.log('getConnectedNodesAndLinks: bug: not implemented for d == ' + d);
        }
        d = d || 1;

        if (chosen_nodes.length === undefined) {
            console.log('getConnectedNodesAndLinks: expected array');
        }

        links.forEach(function(link) {
            chosen_nodes.forEach(function (n) {
                var adjacentnode;
                if (same(link.__src, n)) {
                    adjacentnode = findNode(link.__dst.id, null);
                    if (adjacentnode.state !== "temp") {
                        addNode({type: 'exit', node: adjacentnode});
                    }
                    ret.links.push({type: 'exit', link: link});
                    if (link.__dst.type === "chainlink") {
                        links.forEach(function(link2) {
                            if (link.__dst.id === link2.__dst.id &&
                                link2.__dst.type === "chainlink" &&
                                link2.__dst.state !== "temp") {
                                adjacentnode = findNode(link2.__src.id, null);
                                if (adjacentnode.state !== "temp") {
                                    addNode({type: 'enter', node: adjacentnode});
                                }
                                ret.links.push({type: 'enter', link: link2});
                            }
                        });
                    }
                }
                if (same(link.__dst, n)) {
                    adjacentnode = findNode(link.__src.id, null);
                    if (adjacentnode.state !== "temp") {
                        addNode({type: 'enter', node: adjacentnode});
                    }
                    ret.links.push({type: 'enter', link: link});
                }
            });
        });
        return ret;
    }

    /* compareSubset:
     *  state: one of the optional states that defines a subgraph
     *  new_nodes: array of objects with name
     *  new_links: array of length two arrays [source_name, target_name]
     *  returns: true if current and new graph are homomorphic up to
     *  a single node id change. false otherwise
     */
    this.compareSubset = function(state, new_nodes, new_links) {
        // Note: the nodes include a state=='temp', type=='bubble' node
        // but it's ok since it exists both in new_nodes and in state_nodes
        var state_nodes = findNodes(null, state).filter(function (nd) {
            return nd.type !== 'bubble';
        });
        var state_links = findLinks(state).map(function(link) {
            return [link.__src.name, link.__dst.name];
        }).sort();
        var k;
        var state_source, state_target, new_source, new_target;
        var changed_nodes;
        var verbose = false; // XXX should be global.
        var set_old_name, set_new_name;

        new_nodes.map(function (f) {
            if (!f.name) {
                console.log('missing name on node. node follows');
                console.log(f);
            }
        });
        new_nodes.sort();
        new_links.sort();
        if (new_nodes.length != state_nodes.length || new_links.length != state_links.length) {
            if (verbose) {
                console.log('not same size: new/old ' + new_nodes.length + ' / ' + state_nodes.length + '; ' +
                            new_links.length + ' / ' + state_links.length);
            }
            return {graph_same: false};
        }
        changed_nodes = util.set_diff(util.set_from_array(state_nodes.map(function(d) { return d.name; })),
                                 util.set_from_array(new_nodes.map(function (f) { return f.name; })));
        // we allow any number of changed nodes as long as we it is 1 or 2 :)
        if (changed_nodes.a_b.length > 2) {
            if (verbose) {
                console.log('changed too many nodes');
                console.log(changed_nodes);
            }
            return {graph_same: false};
        }
        set_old_name = util.set_from_array(changed_nodes.a_b);
        set_new_name = util.set_from_array(changed_nodes.b_a);
        for (k = 0 ; k < state_links.length ; ++k) {
            state_source = state_links[k][0];
            state_target = state_links[k][1];
            new_source = new_links[k][0];
            new_target = new_links[k][1];
            if ((state_source !== new_source &&
                 !(state_source in set_old_name && new_source in set_new_name))
                ||
               (state_target !== new_target &&
                 !(state_target in set_old_name && new_target in set_new_name))) {
                if (verbose) {
                    console.log('not same link: ' +
                                state_source + '->' + state_target + ' != ' +
                                new_source + '->' + new_target);
                    console.log('state_source === new_source: ' + String(state_source === new_source));
                    console.log('state_target === new_target: ' + String(state_target === new_target));
                    console.log(set_old_name);
                    console.log(set_new_name);
                }
                return {graph_same: false};
            }
        }
        return {graph_same: true, old_name: changed_nodes.a_b, new_name: changed_nodes.b_a};
    }

    this.addLinkByName = function(src_name, dst_name, name, state, drop_conjugator_links) {
        var src = findNodeByName(src_name, null),
            dst = findNodeByName(dst_name, null),
            src_id = src ? src.id : null,
            dst_id = dst ? dst.id : null;

        if (src_id === null || dst_id === null) {
            console.log('error: link of missing nodes: ' + src_name + ' (' + src_id + ') -> '
                        + dst_name + ' (' + dst_id + ')');
            return;
        }
        this.addLink(src_id, dst_id, name, state, drop_conjugator_links);
    }

    this.addLink = function(src_id, dst_id, name, state, drop_conjugator_links) {
        var src = findNode(src_id, null);
        var dst = findNode(dst_id, null);
        var found = findLink(src_id,dst_id,name);

        if (drop_conjugator_links && name && (name.replace(/ /g,"") === "and")) {
            state = "temp";
        }
        if (undefined === src || undefined === dst) {
            console.log('addLink: undefined src / dst');
            return;
        }
        if (!found) {
            var link = model_core.create_link__set_random_id(src, dst, { name: name, state: state });
            links.push(link);
            diffBus.push({links: {add: [link]}});
        } else {
            found.name = name;
            found.state = state;
        }
    }

    this.editLink = function(src_id, dst_id, newname, newstate) {
        var link = findLink(src_id, dst_id, newname);

        if (link === undefined) {
            return;
        }
        link.name = newname;
        if (newstate !== undefined) {
            link.state = newstate;
        }
        rz_bus.names.push([newname]);
    }

    this.editLinkTarget = function(src_id, dst_id, newTarget) {
        var link = findLink(src_id, dst_id, null);
        if (link !== undefined) {
            link.__dst = findNode(newTarget, null);

        } else {

        }
    }

    this.editNameByName = function(old_name, new_name) {
        var node = findNodeByName(old_name, null);

        if (node === undefined) {
            console.log('editNameByName: error: cannot find node with name ' + old_name);
            return;
        }
        return this.editName(node.id, new_name); // TODO: introduce Node class (yes Amir, I'm now down with that).
    }

    this.editName = function(id, new_name) {
        var index2 = findNodeByName(new_name, null);
        var index = findNode(id, null);
        var acceptReplace=true;

        if (index === undefined) {
            return;
        }
        if (index.name == new_name) {
            return;
        }
        if (index2 !== undefined && index.state !== 'temp' && !compareNames(index.name, new_name)) {
            acceptReplace = confirm('"' + index2.name + '" will replace "' + index.name + '", are you sure?');
            if (acceptReplace){
                for (var i = 0; i < links.length; i++) {
                    if (links[i].__src === index) {
                        links[i].__src = index2;
                    }
                    if (links[i].__dst === index) {
                        links[i].__dst = index2;
                    }
                }
                this.removeNode(index.id,null);
            }
        } else {
            index.name = new_name;
        }
    }

    this.editDates = function(id, type, start, end) {
        var index = findNode(id, type);
        if ((index !== undefined)) {
            index.start = start;
            index.end = end;
        }
    }

    /**
     * editType:
     *
     * @return true if type changed
     */
    this.editType = function(id, state, newtype) {
        return this._editProperty(id, state, 'type', newtype);
    }

    this.editURL = function(id, state, url) {
        return this._editProperty(id, state, 'url', url);
    }

    this._editProperty = function(id, state, prop, value) {
        var index = findNode(id, state);
        if ((index === undefined)) {
            return false;
        }
        index[prop] = value;
        return true;
    }

    this.editStatus = function(id, state, status) {
        return this._editProperty(id, state, 'status', status);
    }

    this.editState = function(id, state, newstate) {
        return this._editProperty(id, state, 'state', newstate);
    }

    this.findCoordinates = function(id, type) {
        var index = findNode(id, type);
        if ((index !== undefined)) {
            $('.typeselection').css('top', index.y - 90);
            $('.typeselection').css('left', index.x - 230);
        }
    }

    this.removeLink = function(link) {
        var i;

        for (i = 0 ; i < links.length; ++i) {
            if (link.id !== undefined) {
                if (link.id === links[i].id) {
                    links.splice(i, 1);
                    return;
                }
            } else {
                if (link.__src.id === links[i].__src.id && link.__dst.id === links[i].__dst.id) {
                    links.splice(i, 1);
                    return;
                }
            }
        }
        console.log('bug: attempt to remove non existant link');
    }

    this.removeLinks = function(state) {
        var id = null;
        var ls = findLinks(state);
        for (var j = 0; j < ls.length; j++) {
            var l = ls[j];
            var i = 0;
            while (i < links.length) {
                if (links[i] === l) links.splice(i, 1);
                else i++;
            }
        }
    }

    var findLink = function(src_id, dst_id, name) {
        for (var i = 0; i < links.length; i++) {
            if (links[i].__src.id === src_id && links[i].__dst.id === dst_id) {
                return links[i];
            }
        }
    }

    var findLinks = function(state) {
        var foundLinks = [];
        for (var i = 0; i < links.length; i++) {
            if (links[i].state == state) {
                foundLinks.push(links[i]);
            }
        }
        return foundLinks;
    }

    var compareNames = function(name1, name2) {
        return name1.toLowerCase() === name2.toLowerCase();
    };

    var hasNodeByName = function(name, state) {
        return nodes.filter(function (n) {
            return compareNames(n.name, name) && n.state === state;
        }).length > 0;
    }
    this.hasNodeByName = hasNodeByName;

    var hasNodeByNameAndNotState = function(name, state) {
        return nodes.filter(function(n) {
            return compareNames(n.name, name) && n.state !== state;
        }).length > 0;
    }
    this.hasNodeByNameAndNotState = hasNodeByNameAndNotState;

    var hasNode = function(id, state) {
        var i;

        for (i = 0 ; i < nodes.length; ++i) {
            if (nodes[i].id === id && nodes[i].state === state) {
                return true;
            }
        }
        return false;
    }
    this.hasNode = hasNode;

    /**
     * return node whose id matches the given id or undefined if no node was found
     */
    var find_node__by_id = function(id) {
        return id_to_node_map[id];
    }

    var findNode = function(id, state) {
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id === id || nodes[i].state === state)
                return nodes[i];
        };
    }

    var findNodeByName = function(name, state) {
        state = state || null;
        for (var i = 0 ; i < nodes.length ; ++i) {
            if (compareNames(nodes[i].name, name) || nodes[i].state === state) {
                return nodes[i];
            }
        }
    }

    var findNodes = function(id, state) {
        // id=id.toLowerCase();
        var foundNodes = [];
        for (var i = 0; i < nodes.length; i++) {
            if ((id && nodes[i].id === id) || (state && nodes[i].state === state))
                foundNodes.push(nodes[i]);
        }
        return foundNodes;
    }

    var findNodeIndex = function(id, state) {
        for (var i = 0; i < nodes.length; i++) {
            if ((id && nodes[i].id === id) || (state && nodes[i].state === state))
                return i;
        };
    }

    function clear() {
        nodes.length = 0;
        links.length = 0;
    }
    this.clear = clear;

    function empty() {
        return nodes.length == 0 && links.length == 0;
    }
    this.empty = empty;

    // @ajax-trans
    this.commit_diff_set = function (diff_set) {

        function on_success(data){
            console.log('commit_diff_set:on_success: TODO impl');
        }

        rz_api_mesh.broadcast_possible_next_diff_block(diff_set);
    }

    /**
     * perform initial DB load from backend
     *
     * @param on_success: should be used by MVP presentors to trigger UI update
     */
    // @ajax-trans
    function load_from_backend(on_success) {

        function on_success__ajax(data){
            var n_set = []; // added node set
            var l_set = []; // added link set
            var len;

            data['node_set'].map(function(n_spec){
                var n_spec = model_util.adapt_format_read_node(n_spec);
                var n = __addNode(n_spec, false);
                n_set.push(n);
            });

            data['link_set'].map(function(l_spec){
                var l_spec = model_util.adapt_format_read_link(l_spec);
                var l = addLink(l_spec.__src_id, l_spec.__dst_id, l_spec.name, "perm");
                l_set.push(l);
            });

            undefined != on_success && on_success()
        }

        rz_api_backend.clone(0, on_success__ajax);
    }
    this.load_from_backend = load_from_backend;

    this.load_from_json = function(json) {
        var data = JSON.parse(json),
            added_names,
            that = this;

        clear();
        if (data == null) {
            console.log('load callback: no data to load');
            return;
        }
        added_names = data.nodes.map(function(node) {
            return that.__addNode({id:node.id, name:node.name ? node.name : node.id,
                                 type:node.type,state:"perm",
                                 start:new Date(node.start),
                                 end:new Date(node.end),
                                 status:node.status,
                                 url:node.url,
                                 x: node.x,
                                 y: node.y,
                                }, false).name;
        });
        data.links.forEach(function(link) {
            that.addLink(link.__src, link.__dst, link.name, "perm");
        });
        this.clear_history();
        rz_bus.names.push(added_names);
    }

    this.save_to_json = function() {
        var d = {"nodes":[], "links":[]};
        for(var i = 0 ; i < nodes.length ; i++){
          var node = nodes[i];
          d['nodes'].push({
            "id": node.id,
            "name": node.name,
            "type":node.type,
            "state":"perm",
            "start":node.start,
            "end":node.end,
            "status": node.status,
            "url": node.url,
            "x": node.x,
            "y": node.y,
          });
        }
        for(var j=0 ; j < links.length ; j++){
          var link = links[j];
          d['links'].push({
            "__src":link.__src.id,
            "__dst":link.__dst.id,
            "name":link.name
          });
        }
        return JSON.stringify(d);
    }

    this.set_user = function(user) {
        var elem = $('svg g.zoom')[0];
        this.user = user;
        this.history = new history.History(this.user, this, elem);
    }

    function clear_history() {
        if (this.history !== undefined) {
            this.history.clear();
        }
    }

    this.clear_history = clear_history;

    var get_nodes = function() { return nodes; };
    this.nodes = get_nodes;

    var get_links = function() { return links; };
    this.links = get_links;

    function setRegularState() {
        var x, node, link, s;

        for (x in nodes) {
            node = nodes[x];
            s = node.state;
            if (s === 'chosen' || s === 'enter' || s === 'exit') {
                node.state = 'perm';
            }
        }
        for (x in links) {
            link = links[x];
            s = link.state;
            if (s === 'chosen' || s === 'enter' || s === 'exit') {
                link.state = 'perm';
            }
        }
    }
    this.setRegularState = setRegularState;

    this.findByVisitors = function(node_visitor, link_visitor) {
        var n_length = nodes.length,
            l_length = links.length,
            selected = [],
            i,
            node,
            link,
            state;

        if (!node_visitor) {
            return;
        }

        for (i = 0 ; i < n_length; ++i) {
            node = nodes[i];
            if (node.state == 'temp') {
                continue;
            }
            if (node_visitor(node)) {
                selected.push(node);
            }
        }
        return selected;
    }

    function markRelated(names) {
        removeRelated();
        nodes.forEach(function (node) {
            names.forEach(function (name) {
                if (compareNames(node.name, name) && node.state != 'temp') {
                    node.state = 'related';
                }
            });
        });
    }
    this.markRelated = markRelated;

    function removeRelated() {
        nodes.forEach(function (node) {
            if (node.state == 'related') {
                node.state = 'perm';
            }
        });
    }
    this.removeRelated = removeRelated;

}

return {
    Graph: Graph,
};

});
