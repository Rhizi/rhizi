"use strict"

define(['Bacon', 'consts', 'util', 'model/core', 'model/util', 'model/diff', 'rz_api_backend', 'rz_api_mesh', 'history', 'rz_config'],
function (Bacon, consts, util, model_core, model_util, model_diff, rz_api_backend, rz_api_mesh, history, rz_config) {

var debug = false;

function Graph(spec) {

    var id_to_node_map = {},
        node_map = {},
        id_to_link_map = {},
        link_map = {},
        diffBus = new Bacon.Bus(),
        cached_links,
        invalidate_links,
        cached_nodes,
        invalidate_nodes,
        temporary = spec.temporary,
        base = spec.base;

    this.temporary = temporary;
    this.base = base;

    util.assert(temporary !== undefined && base !== undefined, "missing inputs");

    // All operations done on the graph. When the server is used (i.e. always) this
    // bus contains the server events, not the user events (most of the time the same just with delay).
    this.diffBus = diffBus;

    var links_forEach = function (f) {
        for (var link_key in link_map) {
            f(link_map[link_key]);
        }
    }

    var nodes_forEach = function (f) {
        for (var node_key in node_map) {
            f(node_map[node_key]);
        }
    }

    /**
     * add node if no previous node is present whose id equals that of the node being added
     *
     * @return node if node was actually added
     */
    // FIXME: is this a good idea? i.e. changing API based on constructor? just in dynamic city
    if (temporary) {
        this.addTempNode = function(spec) {
            return this.__addNode(spec);
        }
    }

    var nodes_to_touched_links = function (node_id_set) {
        var touched_links = [];

        node_id_set.forEach(function (n_id) {
            var n = id_to_node_map[n_id];
            links_forEach(function (link) {
                if ((link['__src'].equals(n)) || (link['__dst'].equals(n))) { // compare by id
                    touched_links.push(link);
                }
            });
        });
        console.dir(touched_links);

        return touched_links.map(function(l){ return l.id; });
    }

    /**
     *
     * @param a topo_diff but that might be missing a few things, sanitize it first.
     * all sanitation should be idempotent, but probably isn't.
     *
     * NOTE: currently this function transmits only. Later we want to optimistically
     * first commit and then transmit.
     */
    var commit_and_tx_diff__topo = function (topo_diff) {
        $.merge(topo_diff.link_set_rm, nodes_to_touched_links(topo_diff.node_set_rm));
        topo_diff.node_set_add = topo_diff.node_set_add.map(function(n) {
            util.assert(n.id !== undefined, "undefined id in node in topo diff");
            return model_util.adapt_format_write_node(n);
        });

        topo_diff.link_set_add = topo_diff.link_set_add.map(function(l) {
            util.assert(l.id !== undefined, "undefined id in link in topo diff");
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

        var graph_on_error = function(error) {
            console.log('error:');
            console.dir(error);
        }
        console.log("COMMIT DIFF   TOPO");
        console.dir(topo_diff);
        rz_api_backend.commit_diff__topo(topo_diff, __commit_diff_ajax__topo, graph_on_error);
    }
    this.commit_and_tx_diff__topo = commit_and_tx_diff__topo;

    /**
     * Inner implementation
     *
     * @param notify whether or not a presenter notification will be sent, default = true
     */
    function __addNode(spec) {
        var existing_node,
            node;

        if (undefined == spec.id) {
            existing_node = find_node__by_name(spec.name)
            if (existing_node){
                return existing_node;
            } else {
                node = model_core.create_node__set_random_id(spec);
                if (debug) {
                    console.log('__addNode: stamping node id: ' + node.id + ', name: \'' + node.name + '\'');
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
        _node_add_helper(node);
        console.log('__addNode: node added: id: ' + node.id + ' state ' + node.state);

        return node;
    }
    this.__addNode = __addNode;

    var _node_key = function (node) {
        return node.name + '|' + node.id
    }

    var _link_key = function (link) {
        return link.name + '|' + link.id
    }

    var _node_remove_helper = function (node) {
        if (node.id !== undefined) {
            delete id_to_node_map[node.id];
        }
        delete node_map[_node_key(node)];
        invalidate_nodes = true;
    }

    var _node_add_helper = function (node) {
        if (node.id !== undefined) {
            id_to_node_map[node.id] = node;
        }
        node_map[_node_key(node)] = node;
        invalidate_nodes = true;
    }

    var _link_remove_helper = function (link) {
        if (link.id !== undefined) {
            delete id_to_link_map[link.id];
        }
        delete link_map[_link_key(link)];
        invalidate_links = true;
    }

    var _link_add_helper = function (link) {
        if (link.id !== undefined) {
            id_to_link_map[link.id] = link;
        }
        link_map[_link_key(link)] = link;
        invalidate_links = true;
    }

    var _remove_node_set = function(node_id_set) {
        node_id_set.forEach(function (id) {
            if (undefined === id_to_node_map[id]) {
                console.log("warning: server returned an id we don't have " + id);
                return;
            }
            _node_remove_helper(id);
            console.log('_remove_node_set: ' + id);
        });
    }
    this._remove_node_set = _remove_node_set;

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
     * NOTE: Doesn't handle inter graph links
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

        links_forEach(function(link) {
            chosen_nodes.forEach(function (n) {
                var adjacentnode;
                if (same(link.__src, n)) {
                    adjacentnode = find_node__by_id(link.__dst.id);
                    addNode({type: 'exit', node: adjacentnode});
                    ret.links.push({type: 'exit', link: link});
                    if (link.__dst.type === "chainlink") {
                        links_forEach(function(link2) {
                            if (link.__dst.id === link2.__dst.id &&
                                link2.__dst.type === "chainlink") {
                                adjacentnode = find_node__by_id(link2.__src.id);
                                addNode({type: 'enter', node: adjacentnode});
                                ret.links.push({type: 'enter', link: link2});
                            }
                        });
                    }
                }
                if (same(link.__dst, n)) {
                    adjacentnode = find_node__by_id(link.__src.id);
                    addNode({type: 'enter', node: adjacentnode});
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
        var state_nodes = find_nodes__by_state(state);
        var state_links = find_links__by_state(state).map(function(link) {
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

    function __addLink(link) {

        var trimmed_name = link.name.trim();

        util.assert(link instanceof model_core.Link);

        if (link.name.length != trimmed_name.length) {
            console.log('bug: __addLink with name containing spaces - removing before sending to server');
        }
        link.name = trimmed_name;

        var existing_link = findLink(link.__src.id, link.__dst.id, link.name);

        if (undefined == existing_link) {
            _link_add_helper(link);
        } else {
            existing_link.name = link.name;
            existing_link.state = link.state;
        }
    }
    // FIXME: good idea to add API based on constructor parameter?
    if (temporary) {
        this.addTempLink = function (link) {
            return __addLink(link);
        }
    }

    this.update_link = function(link, new_link_spec, on_success, on_error) {
        util.assert(link instanceof model_core.Link);

        // TODO - fake api for client only (debug, demo, ui work)
        if (!rz_config.backend_enabled) return;

        var attr_diff = model_diff.new_attr_diff();
        for (var key in new_link_spec){
            attr_diff.add_link_attr_write(link.id, key, new_link_spec[key]);
        }

        var on_ajax_success = function(id_to_link_map) {
            var link_id = link.id; // original link id
            if (id_to_link_map[link_id].id != link_id) {
                // TODO: handle incoming ID update
                util.assert(false, 'update_link: id attr change');
            }

            var ret_link = id_to_link_map[link_id];
            for (var key in ret_link) {
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
            var n_eq_name = find_node__by_name(new_node_spec.name);
            if (undefined != n_eq_name) {
                // delete colliding node on rename
                console.warn('update_node: name collision blocked due to node rename');
                undefined != on_error && on_error();
                return;
            }

            node['name'] = new_node_spec['name']; // [!] may still fail due to server NAK
        }

        var attr_diff = model_diff.new_attr_diff();
        for (var key in new_node_spec) {
            attr_diff.add_node_attr_write(node.id, key, new_node_spec[key]);
        }

        var on_ajax_success = function(id_to_node_map){
            var node_id = node.id; // original node id

            util.assert(id_to_node_map && id_to_node_map[node_id], "bad return value from ajax");

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
        var node = find_node__by_name(old_name);

        if (node === undefined) {
            console.log('editNameByName: error: cannot find node with name ' + old_name);
            return;
        }
        return this.editName(node.id, new_name);
    }

    this.editName = function(id, new_name) {
        var n_eq_name = find_node__by_name(new_name);
        var n_eq_id = find_node__by_id(id);
        var acceptReplace=true;

        if (n_eq_id === undefined) {
            return;
        }
        if (n_eq_id.name == new_name) {
            return;
        }
        util.assert(temporary, 'editName should now only be used on temporary graphs');
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

    function new_attr_diff_prop_value(id, prop, value)
    {
        var diff = rz_diff.new_attr_diff();

        diff.add_node_attr_write(id, prop, value);
        return diff;
    }

    this._editProperty = function(id, state, prop, value) {
        var n = find_node__by_id(id);

        if (state !== null && state != n.state){
            return false;
        }

        if ((n === undefined)) {
            return false;
        }
        console.debug("deprecated and broken probably");
        // cannot assert state is temp since robot code still uses it
        if (state != 'temp') {
            console.log('warning: I hope robot is doing this not-through-backend property change');
        }
        n[prop] = value;
        diffBus.push(new_attr_diff_prop_value(id, prop, value));
        return true;
    }

    this.findCoordinates = function(id) {
        var n = find_node__by_id(id);

        if (n !== undefined) {
            $('.typeselection').css('top', n.y - 90);
            $('.typeselection').css('left', n.x - 230);
        }
    }

    this.removeLink = function(link) {

        util.assert(link.id !== undefined, 'bug: link without an id');

        this._remove_link_set([link]);
    }

    var _remove_link_set = function(link_id_set) {
        link_id_set.forEach(function (id) {
            var link = id_to_link_map[id];
            if (undefined === link) {
                console.log("warning: server returned an id we don't have " + id);
                return;
            }
            _link_remove_helper(link);
            console.log('_remove_link_set: ' + id);
        });
    }
    this._remove_link_set = _remove_link_set;

    this.removeNodes = function(state) {
        var node_ids = get_nodes().filter(function (n) { return n.state == state; })
                                 .map(function (n) { return n.id; }),
            topo_diff = model_diff.new_topo_diff({
                node_set_rm : node_ids,
            });

        this.commit_diff__topo(topo_diff);
    }

    this.removeLinks = function(state) {
        var ls = find_links__by_state(state);
        ls.map(_link_remove_helper);
    }

    var findLink = function(src_id, dst_id, name) {
        var link_key, link;

        for (link_key in link_map) {
            link = link_map[link_key];
            if (link.__src.id === src_id && link.__dst.id === dst_id) {
                return link;
            }
        }
    }

    var find_links__by_state = function(state) {
        var foundLinks = [];
        links_forEach(function (link) {
            if (link.state == state) {
                foundLinks.push(link);
            }
        });
        return foundLinks;
    }

    var compareNames = function(name1, name2) {
        return name1.toLowerCase() === name2.toLowerCase();
    };

    var hasNodeByName = function(name, state) {
        return get_nodes().filter(function (n) {
            return compareNames(n.name, name) && (undefined === state || n.state === state);
        }).length > 0;
    }
    this.hasNodeByName = hasNodeByName;

    /**
     * return node whose id matches the given id or undefined if no node was found
     */
    var find_node__by_id = function(id) {
        if (base) {
            var base_node = base.find_node__by_id(id);
            if (base_node) {
                console.log('!!! returning base node');
                return base_node;
            }
        }
        return id_to_node_map[id];
    }
    this.find_node__by_id = find_node__by_id;

    /**
     * @param filter: must return true in order for node to be included in the returned set
     */
    var find_nodes__by_filter = function(filter) {
        var ret = [];
        nodes.map(function(n){
           if (true == filter(n)){
               ret.push(n);
           }
        });
        return ret;
    }

    var find_node__by_name = function(name) {
        for (var k in node_map) {
            if (compareNames(node_map[k].name, name)) {
                return node_map[k];
            }
        }
    }
    this.find_node__by_name = find_node__by_name;

    var find_nodes__by_state = function(state) {
        var foundNodes = [];
        nodes_forEach(function (node) {
            if (node.state === state) {
                foundNodes.push(node);
            }
        });
        return foundNodes;
    }

    function clear(push_diff) {
        push_diff = push_diff === undefined ? true : push_diff;
        id_to_node_map = {};
        node_map = {}
        id_to_link_map = {};
        link_map = {};
        invalidate_links = true;
        invalidate_nodes = true;
        if (push_diff) {
            diffBus.push({}); // FIXME: better value
        }
    }
    this.clear = clear;

    function empty() {
        // FIXME: O(|nodes|+|links|)
        return get_nodes().length == 0 && get_links().length == 0;
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

        return n_spec;
    }

    function on_backend__link_add(l_spec) {
        var src_id = l_spec.__src_id,
            dst_id = l_spec.__dst_id,
            l_ptr = model_util.adapt_format_read_link_ptr(l_spec);

        util.assert(undefined != l_ptr.id, 'load_from_backend: l_ptr missing id');
        util.assert(undefined != src_id, 'load_from_backend: link missing __src_id');
        util.assert(undefined != dst_id, 'load_from_backend: link missing __dst_id');

        // cleanup & reuse as link_spec
        delete l_ptr.__src_id;
        delete l_ptr.__dst_id;
        var link_spec = l_ptr;
        link_spec.__src = find_node__by_id(src_id);
        link_spec.__dst = find_node__by_id(dst_id);
        return link_spec;
    }

    function __commit_diff_ajax__topo(diff) {
        _add_node_set(diff.node_set_add.map(on_backend__node_add));
        _add_link_set(diff.link_set_add.map(on_backend__link_add));
        // FIXME: this diff is not the same as that pushed by commit_diff__topo
        diffBus.push(diff);
    }

    function _add_node_set(node_specs) {
        node_specs.map(function (node_spec) {
            __addNode(node_spec);
        });
    }

    function _add_link_set(link_specs) {
        link_specs.map(function (link_spec) {
            // resolve link ptr
            var src = (link_spec.__src && (find_node__by_id(link_spec.__src.id) || link_spec.__src))
                        || find_node__by_id(link_spec.__src_id),
                dst = (link_spec.__dst && (find_node__by_id(link_spec.__dst.id) || link_spec.__dst))
                        || find_node__by_id(link_spec.__dst_id),
                link = model_core.create_link_from_spec(src, dst, link_spec);

            __addLink(link);
        });
    }

    /*
     * Inputs are specs, not raw - after adaptation from the on wire format.
     *
     * FIXME: use a different object? different properties in the same object?
     */
    function commit_diff__topo(diff) {
        console.dir(diff);
        _add_node_set(diff.node_set_add);
        _add_link_set(diff.link_set_add);
        // done under protest
        _remove_link_set(diff.link_set_rm);
        _remove_node_set(diff.node_set_rm);
        diffBus.push(diff);
    }
    this.commit_diff__topo = commit_diff__topo;

    /**
     * perform initial DB load from backend
     *
     * @param on_success: should be used by MVP presentors to trigger UI update
     */
    // @ajax-trans
    function load_from_backend(on_success) {

        function on_success__ajax(diff) {
            console.dir(diff);
            __commit_diff_ajax__topo(diff);
            undefined != on_success && on_success()
        }

        rz_api_backend.clone(0, on_success__ajax);
    }
    this.load_from_backend = load_from_backend;

    var new_topo_diff__from_nodes_links = function (nodes, links) {
        var diff,
            node_by_id = {};

        diff = model_diff.new_topo_diff();
        diff.node_set_add = nodes.map(function(node) {
                return model_core.create_node_from_spec({
                       id: node.id,
                       name: node.name ? node.name : node.id,
                       type: node.type,
                       state: "perm",
                       start: new Date(node.start),
                       end: new Date(node.end),
                       status: node.status,
                       url: node.url,
                       x: node.x,
                       y: node.y,
                });
            });
        diff.node_set_add.forEach(function (node) {
            node_by_id[node.id] = node;
        });
        diff.link_set_add = links.map(function (link_spec) {
                var src = node_by_id[link_spec.__src],
                    dst = node_by_id[link_spec.__dst],
                    link = model_core.create_link__set_random_id(src, dst, {
                        name: link_spec.name,
                        state: 'perm', // FIXME: this is meaningless now with graph separation
                    });
                link.__src_id = src.id;
                link.__dst_id = dst.id;
                return link;
            });
        return diff;
    }
    this.new_topo_diff__from_nodes_links = new_topo_diff__from_nodes_links;

    this.load_from_json = function(json) {
        var data = JSON.parse(json);

        if (data == null) {
            console.log('load callback: no data to load');
            return;
        }
        // FIXME: prompt for replace/merge; now defaulting to merge
        commit_and_tx_diff__topo(new_topo_diff__from_nodes_links(data.nodes, data.links));
    }

    this.save_to_json = function() {
        var d = {"nodes":[], "links":[]},
            nodes = get_nodes(),
            links = get_links();

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

    var object_values = function (obj) {
        var values = [];
        for (var o in obj) {
            values.push(obj[o]);
        }
        return values;
    }

    var get_nodes = function() {
        if (cached_nodes === undefined || invalidate_nodes) {
            cached_nodes = object_values(node_map);
            invalidate_nodes = false;
        }
        return cached_nodes;
    };
    this.nodes = get_nodes;

    var get_links = function() {
        if (cached_links === undefined || invalidate_links) {
            cached_links = object_values(link_map);
            invalidate_links = false;
        }
        return cached_links;
    };
    this.links = get_links;

    function setRegularState() {
        var x, node, link, s;

        for (x in node_map) {
            node = node_map[x];
            s = node.state;
            if (s === 'chosen' || s === 'enter' || s === 'exit') {
                node.state = 'perm';
            }
        }
        for (x in link_map) {
            link = link_map[x];
            s = link.state;
            if (s === 'chosen' || s === 'enter' || s === 'exit') {
                link.state = 'perm';
            }
        }
    }
    this.setRegularState = setRegularState;

    this.find__by_visitors = function(node_visitor, link_visitor) {
        var nodes = get_nodes(),
            links = get_links(),
            n_length = nodes.length,
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
            if (node_visitor(node)) {
                selected.push(node);
            }
        }
        return selected;
    }

    function markRelated(names) {
        removeRelated();
        nodes_forEach(function (node) {
            names.forEach(function (name) {
                if (compareNames(node.name, name)) {
                    node.state = 'related';
                }
            });
        });
    }
    this.markRelated = markRelated;

    function removeRelated() {
        // FIXME: related should use separate variable, not overload 'state' (bad bad bad)
        nodes_forEach(function (node) {
            if (node.state === 'related') {
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
