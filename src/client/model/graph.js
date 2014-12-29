"use strict"

define(['Bacon', 'consts', 'util', 'model/core', 'model/util', 'model/diff', 'rz_api_backend', 'rz_api_mesh', 'history', 'rz_config'],
function (Bacon, consts, util, model_core, model_util, model_diff, rz_api_backend, rz_api_mesh, history, rz_config) {

var debug = false;

function Graph() {

    var nodes = [],
        id_to_node_map = {},
        links = [],
        diffBus = new Bacon.Bus();

    // All operations done on the graph. When the server is used (i.e. always) this
    // bus contains the server events, not the user events (most of the time the same just with delay).
    this.diffBus = diffBus;

    // debug
    diffBus.onValue(function (v) {
        console.log("=================");
        console.dir(v);
    });

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
     *
     * @param a topo_diff but that might be missing a few things, sanitize it first.
     * all sanitation should be idempotent, but probably isn't.
     */
    this.commit_diff__topo = function (topo_diff, on_success, on_error) {
        var name_to_node = {};
        topo_diff.node_set_add = topo_diff.node_set_add.map(function(n) {
            if (n.id === undefined) {
                var existing = findNodeByName(n.name);
                if (existing) {
                    n = existing;
                } else {
                    n.id = model_core.random_node_name();
                }
            }
            name_to_node[n.name] = n;
            return model_util.adapt_format_write_node(n);
        });

        topo_diff.link_set_add = topo_diff.link_set_add.map(function(l) {
            if (l.id === undefined) {
                l.id = model_core.random_node_name();
            }
            if (typeof l.__src === 'string') {
                l.__src = name_to_node[l.__src];
            }
            if (typeof l.__dst === 'string') {
                l.__dst = name_to_node[l.__dst];
            }
            if (l.source === undefined) {
                l.source = l.__src;
            }
            if (l.target === undefined) {
                l.target = l.__dst;
            }
            if (l.name == undefined) {
                l.name = 'is'; // cannot have a zero length name, using name as label in neo4j
            }
            if (l.__type === undefined) {
                l.__type = l.name;
            }
            return model_util.adapt_format_write_link(l);
        });
        // filter already existing nodes now, after we conveniently used them
        // for name_to_node map
        topo_diff.node_set_add = topo_diff.node_set_add.filter(function(n) {
            return !hasNodeByName(n.name);
        });
        var graph_on_success = function(diff) {
            on_backend__diff(diff);
            if (on_success) {
                on_success(nodes);
            }
        }
        var graph_on_error = function(error) {
            if (on_error) {
                on_error(error);
            }
        }
        console.log("COMMIT DIFF   TOPO");
        console.dir(topo_diff);
        rz_api_backend.commit_diff__topo(topo_diff, graph_on_success, graph_on_error);
    }

    /**
     * Inner implementation
     *
     * @param notify whether or not a presenter notification will be sent, default = true
     */
    function __addNode(spec, notify, peer_notify) {
        var existing_node,
            node;

        notify = undefined === notify ? true : notify;
        peer_notify = undefined === peer_notify ? spec.state != 'temp' : peer_notify;

        if (undefined == spec.id) {
            existing_node = findNodeByName(spec.name)
            if (existing_node){
                return existing_node;
            } else {
                node = model_core.create_node__set_random_id(spec);
                if (debug) {
                    if ('bubble' != node.type){
                        console.log('__addNode: stamping node id: ' + node.id + ', name: \'' + node.name + '\' (bubble)');
                    }else {
                        console.log('__addNode: stamping node id: ' + node.id + ', name: \'' + node.name + '\'');
                    }
                }
            }
        } else {
            node = model_core.create_node_from_spec(spec);
        }

        existing_node = find_node__by_id(node.id);
        if (existing_node) {
            console.log('__addNode: id collision: existing-node.id: \'' + existing_node.id + '\', ' + 'new-node.id: \'' + node.id + '\'');
            return existing_node;
        }

        util.assert(undefined != node.id, '__addNode: node id missing');
        nodes.push(node);
        id_to_node_map[node.id] = node;
        console.log('__addNode: node added: id: ' + node.id + ' state ' + node.state +
            (rz_config.backend_enabled && peer_notify ? ' _commit_ ' : ''));

        if (rz_config.backend_enabled && peer_notify){
            var topo_diff = model_diff.new_topo_diff({
                node_set_add : [node].map(model_util.adapt_format_write_node),
            });
            var on_success = function(){
                // FIXME: handle possible outcomes:
                // - id merge: node already exists -> update id
                // - link-merge: node already exists -> merge links, recurse?
            };
            var on_error = function(){
                // TODO: add problem emblem to node
            };
            rz_api_backend.commit_diff__topo(topo_diff, on_success, on_error);
        }

        return node;
    }
    this.__addNode = __addNode;

    this._remove_node_set = function(ns, peer_notify) {

        peer_notify = undefined === peer_notify ? true : peer_notify;

        var cascade_link_rm_set = [], // track cascading link removals
            has_non_temp = false;
        for (var j = 0; j < ns.length; j++) {
            var n = ns[j];
            var i = 0;
            if (n.state != 'temp') {
                has_non_temp = true;
            }
            while (i < links.length) {
                var link = links[i];
                if ((link['__src'].equals(n)) || (link['__dst'].equals(n))) { // compare by id
                    links.splice(i, 1);
                    cascade_link_rm_set.push(link);
                }
                else {
                    i++;
                }
            }
            var index = findNodeIndex(n.id, n.state);
            if (index !== undefined) {
                nodes.splice(index, 1);

                util.assert(undefined != n.id, '_remove_node_set: node id missing');
                delete id_to_node_map[n.id];
            }
        }

        cascade_link_rm_set.forEach(function(n){
            console.log('_remove_node_set: removed node: id: ' + n.id);
        });

        if (rz_config.backend_enabled && peer_notify && has_non_temp) {
            var topo_diff = model_diff.new_topo_diff({
                node_set_rm : ns.map(function(n){ return n.id; }),
                link_set_rm : cascade_link_rm_set.map(function(l){ return l.id; }),
            });
            var on_success = function(){
                // FIXME: handle possible outcomes:
                // - rm cascade of connected links
            };
            var on_error = function(){
                // TODO: add problem emblem to node
            };
            rz_api_backend.commit_diff__topo(topo_diff, on_success, on_error);
        }
    }

    this.removeNode = function(id) {
        var n = find_node__by_id(id);
        if (n === undefined) {
            console.log('bug: nonexistent node cannot be removed: ' + id);
            return;
        }
        this._remove_node_set([n]);
    }

    this.removeNodes = function(n_filer) {
        var ns = find_node_set_by_filer(n_filer);
        this._remove_node_set(ns);
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
                    adjacentnode = find_node__by_id(link.__dst.id);
                    if (adjacentnode.state !== "temp") {
                        addNode({type: 'exit', node: adjacentnode});
                    }
                    ret.links.push({type: 'exit', link: link});
                    if (link.__dst.type === "chainlink") {
                        links.forEach(function(link2) {
                            if (link.__dst.id === link2.__dst.id &&
                                link2.__dst.type === "chainlink" &&
                                link2.__dst.state !== "temp") {
                                adjacentnode = find_node__by_id(link2.__src.id);
                                if (adjacentnode.state !== "temp") {
                                    addNode({type: 'enter', node: adjacentnode});
                                }
                                ret.links.push({type: 'enter', link: link2});
                            }
                        });
                    }
                }
                if (same(link.__dst, n)) {
                    adjacentnode = find_node__by_id(link.__src.id);
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

        var src = findNodeByName(src_name),
            dst = findNodeByName(dst_name),
            src_id = src ? src.id : null,
            dst_id = dst ? dst.id : null;

        if (src_id === null || dst_id === null) {
            console.log('error: link of missing nodes: ' + src_name + ' (' + src_id + ') -> '
                        + dst_name + ' (' + dst_id + ')');
            return;
        }

        var link = model_core.create_link__set_random_id(src, dst, { name: name,
                                                                     state: state });
        this.addLink(link);
    }

    function addLink(link, peer_notify) {

        var trimmed_name = link.name.trim();

        util.assert(link instanceof model_core.Link);

        peer_notify = undefined === peer_notify ? link.state != 'temp' : peer_notify;

        if (link.name.length != trimmed_name.length) {
            console.log('bug: addLink with name containing spaces - removing before sending to server');
        }
        link.name = trimmed_name;

        var existing_link = findLink(link.__src.id, link.__dst.id, link.name);

        if (undefined == existing_link) {

            links.push(link);

            if (rz_config.backend_enabled && peer_notify){
                var topo_diff = model_diff.new_topo_diff({
                    link_set_add : [link].map(model_util.adapt_format_write_link),
                });
                var on_success = function(){
                    // FIXME: handle possible outcomes:
                    // - id merge: link already exists -> update id
                    // - attr-merge: link already exists -> merge attrs
                };
                var on_error = function(){
                    // TODO: add problem emblem to node
                };
                rz_api_backend.commit_diff__topo(topo_diff, on_success, on_error);
            }
        } else {
            existing_link.name = link.name;
            existing_link.state = link.state;
        }
    }
    this.addLink = addLink;

    this.update_link = function(link, new_link_spec, on_success, on_error) {
        util.assert(link instanceof model_core.Link);

        // TODO - fake api for client only (debug, demo, ui work)
        if (!rz_config.backend_enabled) return;

        var attr_diff = model_diff.new_attr_diff();
        for (var key in new_link_spec){
            attr_diff.add_link_attr_write(link.id, key, new_link_spec[key]);
        }

        var on_ajax_success = function(id_to_link_map){
            var link_id = link.id; // original link id
            if (id_to_link_map[link_id].id != link_id){
                // TODO: handle incoming ID update
                util.assert(false, 'update_link: id attr change');
            }

            var ret_link = id_to_link_map[link_id];
            for (var key in ret_link){
                if ('id' == key){
                    continue;
                }
                var matching = null;
                link[key] = ret_link[key];
                // this part is askew right now
                if (key == '__type') {
                    matching = 'name';
                }
                if (key == 'name') {
                    matching = '__type';
                }
                if (matching) {
                    link[matching] = link[key];
                }
            }

            // TODO: handle NAK: add problem emblem to link
            on_success();
        };

        var on_ajax_error = function(){
            console.log('error with commit to server: danger robinson!');
        };

        rz_api_backend.commit_diff__attr(attr_diff, on_ajax_success, on_ajax_error);
    }

    this.update_node = function(node, new_node_spec, on_success, on_error) {
        util.assert(node instanceof model_core.Node);

        // TODO - fake api for client only (debug, demo, ui work)
        if (!rz_config.backend_enabled) return;

        if (node.name != new_node_spec.name){
            /*
             * handle name update collision: suggest removal first
             */
            var n_eq_name = findNodeByName(new_node_spec.name);
            if (undefined != n_eq_name) {
                // delete colliding node on rename
                console.warn('update_node: name collision blocked due to node rename');
                undefined != on_error && on_error();
                return;
            }

            node['name'] = new_node_spec['name']; // [!] may still fail due to server NAK
        }

        var attr_diff = model_diff.new_attr_diff();
        for (var key in new_node_spec){
            attr_diff.add_node_attr_write(node.id, key, new_node_spec[key]);
        }

        var on_ajax_success = function(id_to_node_map){
            var node_id = node.id; // original node id
            if (id_to_node_map[node_id].id != node_id){
                // TODO: handle incoming ID update
                util.assert(false, 'update_node: id attr change');
            }

            var ret_node = id_to_node_map[node_id];
            for (var key in ret_node){
                if ('name' == key || 'id' == key){
                    continue;
                }
                node[key] = ret_node[key];
            }

            // TODO: handle NAK: add problem emblem to node
            on_success();
        };

        var on_ajax_error = function(){
            console.log('error with commit to server: danger robinson!');
        };
        rz_api_backend.commit_diff__attr(attr_diff, on_ajax_success, on_ajax_error);
    }

    this.editNameByName = function(old_name, new_name) {
        var node = findNodeByName(old_name);

        if (node === undefined) {
            console.log('editNameByName: error: cannot find node with name ' + old_name);
            return;
        }
        return this.editName(node.id, new_name);
    }

    this.editName = function(id, new_name) {
        var n_eq_name = findNodeByName(new_name);
        var n_eq_id = find_node__by_id(id);
        var acceptReplace=true;

        if (n_eq_id === undefined) {
            return;
        }
        if (n_eq_id.name == new_name) {
            return;
        }
        util.assert(n_eq_id.state === 'temp', 'editName should now only be used by textanalysis');
        util.assert(n_eq_name === undefined);

        n_eq_id.name = new_name;
    }

    /**
     * editType:
     *
     * @return true if type changed
     */
    this.editType = function(id, state, newtype) {
        return this._editProperty(id, state, 'type', newtype);
    }

    this._editProperty = function(id, state, prop, value) {
        var n = find_node__by_id(id);
        if (state !== null && state != n.state){
            return false;
        }

        if ((n === undefined)) {
            return false;
        }
        // cannot assert state is temp since robot code still uses it
        if (state != 'temp') {
            console.log('warning: I hope robot is doing this not-through-backend property change');
        }
        n[prop] = value;
        return true;
    }

    this.findCoordinates = function(id) {
        var n = find_node__by_id(id);

        if (n !== undefined) {
            $('.typeselection').css('top', n.y - 90);
            $('.typeselection').css('left', n.x - 230);
        }
    }

    var linkGetIndexFromId = function(link_id) {
        for (var i = 0 ; i < links.length ; ++i) {
            if (links[i].id == link_id) {
                return i;
            }
        }
    }

    this.removeLink = function(link, on_success, on_error) {
        var i;

        if (link.id === undefined) {
            console.log('bug: link without an id');
        }

        function graph_on_success(ret) {
            ret.link_rm.forEach(function (link_id) {
                links.splice(linkGetIndexFromId(link_id), 1);
            });
            if (on_success) {
                on_success();
            }
        }

        for (i = 0 ; i < links.length; ++i) {
            if (link.id !== undefined) {
                if (link.id === links[i].id) {
                    if (link.state == 'temp') {
                        links.splice(i, 1);
                        if (on_success) {
                            on_success();
                        }
                    } else {
                        if (rz_config.backend_enabled) {
                            var topo_diff = model_diff.new_topo_diff({
                                link_set_rm: [link.id]
                                });
                            rz_api_backend.commit_diff__topo(topo_diff, graph_on_success, on_error);
                        }
                    }
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
            return compareNames(n.name, name) && (undefined === state || n.state === state);
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

    /**
     * @param filer: must return true in order for node to be included in the returned set
     */
    var find_node_set_by_filer = function(filter) {
        var ret = [];
        nodes.map(function(n){
           if (true == filter(n)){
               ret.push(n);
           }
        });
        return ret;
    }

    var findNodeByName = function(name) {
        for (var i = 0 ; i < nodes.length ; ++i) {
            if (compareNames(nodes[i].name, name)) {
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

    function on_backend__node_add(n_spec) {
        n_spec = model_util.adapt_format_read_node(n_spec);

        util.assert(undefined != n_spec.id, 'load_from_backend: n_spec missing id');

        var n = __addNode(n_spec, false, false);
    }

    function on_backend__link_add(l_spec) {
        var l_ptr = model_util.adapt_format_read_link_ptr(l_spec);

        util.assert(undefined != l_ptr.id, 'load_from_backend: l_ptr missing id');

        // resolve link ptr
        var src = find_node__by_id(l_ptr.__src_id),
            dst = find_node__by_id(l_ptr.__dst_id);

        // cleanup & reuse as link_spec
        delete l_ptr.__src_id;
        delete l_ptr.__dst_id;
        var link_spec = l_ptr;
        var link = model_core.create_link_from_spec(src, dst, link_spec);
        var l = addLink(link, false);
    }

    function on_backend__diff(data) {
        data['node_set'].map(on_backend__node_add);

        data['link_set'].map(on_backend__link_add);
        diffBus.push(data);
    }

    /**
     * perform initial DB load from backend
     *
     * @param on_success: should be used by MVP presentors to trigger UI update
     */
    // @ajax-trans
    function load_from_backend(on_success) {

        function on_success__ajax(data) {
            on_backend__diff(data);
            undefined != on_success && on_success()
        }

        rz_api_backend.clone(0, on_success__ajax);
    }
    this.load_from_backend = load_from_backend;

    this.load_from_json = function(json) {
        var data = JSON.parse(json),
            added_nodes,
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
                                }, false, false).name;
        });
        data.links.forEach(function(link) {
            that.addLink(link.__src, link.__dst, link.name, "perm");
        });
        this.clear_history();
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

    var get_nodes = function() {
        return nodes;
    };
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
