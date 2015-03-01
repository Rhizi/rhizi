"use strict"

define(['underscore', 'Bacon_wrapper', 'consts', 'util', 'model/core', 'model/util', 'model/diff', 'rz_api_backend', 'rz_api_mesh', 'history'],
function (_,           Bacon,           consts,   util,   model_core,   model_util,   model_diff,   rz_api_backend,   rz_api_mesh,   history) {

var debug = false;

function Graph(spec) {

    var id_to_node_map = {},
        id_to_link_map = {},
        diffBus = new Bacon.Bus(),
        cached_links,
        invalidate_links,
        cached_nodes,
        invalidate_nodes,
        temporary = spec.temporary,
        base = spec.base,
        server_pending_objects = [];

    this.temporary = temporary;
    this.base = base;

    util.assert(temporary !== undefined && base !== undefined, "missing inputs");

    // All operations done on the graph. When the server is used (i.e. always) this
    // bus contains the server events, not the user events (most of the time the same just with delay).
    this.diffBus = diffBus;

    var links_forEach = function (f) {
        for (var link_key in id_to_link_map) {
            f(id_to_link_map[link_key]);
        }
    }

    var nodes_forEach = function (f) {
        for (var node_key in id_to_node_map) {
            f(id_to_node_map[node_key]);
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
        util.assert(temporary === false, "cannot be temporary");
        $.merge(topo_diff.link_id_set_rm, nodes_to_touched_links(topo_diff.node_id_set_rm));
        topo_diff.node_set_add = topo_diff.node_set_add
            .filter(function(n) {
                util.assert(undefined !== n.id, "undefined id in node in topo diff");
                util.assert(undefined === server_pending_objects[n.id], "cache full at id");
                return find_node__by_id(n.id) === null;
            })
            .map(function(n_spec) {
                server_pending_objects[n_spec.id] = n_spec;
                return model_util.adapt_format_write_node(n_spec);
            });

        topo_diff.link_set_add = topo_diff.link_set_add.map(function(l_spec) {
            util.assert(l_spec.id !== undefined, "undefined id in link in topo diff");
            if (l_spec.source === undefined) {
                l_spec.source = l_spec.__src;
            }
            if (l_spec.target === undefined) {
                l_spec.target = l_spec.__dst;
            }
            if (l_spec.name == undefined) {
                // cannot have a zero length name, using name as label in neo4j
                l_spec.name = 'is';
            }
            if (l_spec.__type === undefined) {
                l_spec.__type = l_spec.name;
            }
            server_pending_objects[l_spec.id] = l_spec;
            return model_util.adapt_format_write_link(l_spec);
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
            console.warn('__addNode: id collision: existing-node.id: \'' + existing_node.id);
            return existing_node;
        }

        util.assert(undefined != node.id, '__addNode: node id missing');
        _node_add_helper(node);
        if (debug) {
            console.log('__addNode: node added: id: ' + node.id + ' state ' + node.state);
        }

        return node;
    }
    this.__addNode = __addNode;

    var _node_remove_helper = function (node_id) {
        util.assert(node_id, "missing node id");
        delete id_to_node_map[node_id];
        invalidate_nodes = true;
    }

    var _node_add_helper = function (node) {
        util.assert(node.id, "missing node id");
        id_to_node_map[node.id] = node;
        invalidate_nodes = true;
    }

    var _link_remove_helper = function (link_id) {
        util.assert(link_id, "missing link id");
        delete id_to_link_map[link_id];
        util.assert(id_to_link_map[link_id] === undefined, "delete failed?!");
        invalidate_links = true;
    }

    var _link_add_helper = function (link) {
        util.assert(link.id, "missing link id");
        id_to_link_map[link.id] = link;
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

        var on_ajax_success = function(attr_diff_spec) {
            var attr_diff = model_util.adapt_format_read_diff__attr(attr_diff_spec);
            var id_to_link_map = attr_diff.id_to_link_map
            var l_id = link.id; // original node id

            util.assert(id_to_link_map && id_to_link_map[l_id], "bad return value from ajax");

            var ret_link = id_to_link_map[l_id];
            for (var key in ret_link['__attr_write']){
                link[key] = ret_link['__attr_write'][key];
            }
            for (var key in ret_link['__attr_remove']){
                delete link[key];
            }

            // TODO: handle NAK: add problem emblem to link
            if (on_success !== undefined) {
                on_success();
            }
            diffBus.push(attr_diff);
        };

        var on_ajax_error = function(){
            console.log('error with commit to server: danger robinson!');
        };

        rz_api_backend.commit_diff__attr(attr_diff, on_ajax_success, on_ajax_error);
    }

    this.update_node = function(node, new_node_spec) {
        util.assert(node instanceof model_core.Node);

        // TODO - fake api for client only (debug, demo, ui work)
        if (!rz_config.backend_enabled) return;

        if (new_node_spec.name !== undefined && node.name != new_node_spec.name){
            /*
             * handle name update collision: suggest removal first
             */
            var n_eq_name = find_node__by_name(new_node_spec.name);
            if (null !== n_eq_name && n_eq_name !== node) {
                if (window.confirm('really merge ' + node.name + ' into ' + n_eq_name.name + '?')) {
                    return nodes__merge([n_eq_name.id, node.id]);
                } else {
                    return; // do nothing
                }
            }

            node['name'] = new_node_spec['name']; // [!] may still fail due to server NAK
        }

        var attr_diff = model_diff.new_attr_diff();
        for (var key in new_node_spec) {
            attr_diff.add_node_attr_write(node.id, key, new_node_spec[key]);
        }

        var on_ajax_success = function(attr_diff_spec){
            var attr_diff = model_util.adapt_format_read_diff__attr(attr_diff_spec);
            var id_to_node_map = attr_diff.id_to_node_map
            var n_id = node.id; // original node id

            util.assert(id_to_node_map && id_to_node_map[n_id], "bad return value from ajax");

            var ret_node = id_to_node_map[n_id];
            for (var key in ret_node['__attr_write']){
                node[key] = ret_node['__attr_write'][key];
            }
            for (var key in ret_node['__attr_remove']){
                delete node[key];
            }

            diffBus.push(attr_diff);
        };

        var on_ajax_error = function(){
            console.log('error with commit to server: danger robinson!');
        };
        rz_api_backend.commit_diff__attr(attr_diff, on_ajax_success, on_ajax_error);
    }
    var update_node = this.update_node;

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
    this.editType = function(id, newtype) {
        return this._editProperty(id, 'type', newtype);
    }

    function new_attr_diff_prop_value(id, prop, value)
    {
        var diff = model_diff.new_attr_diff();

        diff.add_node_attr_write(id, prop, value);
        return diff;
    }

    this._editProperty = function(id, prop, value) {
        var n = find_node__by_id(id),
            local = find_node__by_id(id, false);

        if ((n === undefined)) {
            return false;
        }
        if (local === null) {
            return base._editProperty(id, prop, value);
        }
        if (temporary) {
            n[prop] = value;
            diffBus.push(new_attr_diff_prop_value(id, prop, value));
        } else {
            // FIXME: should not do a server roundtrip, should keep this data local
            // and part of the temporary graph, and send it on user enter in a single commit.
            // The current implementation is just a quick way to get sorta the same outcome.
            // it misses atomicity (since we create a commit for every tab click on an existing node),
            // and responsiveness (since there is a roundtrip to the server and it isn't client side)
            var props = {};
            props[prop] = value;
            update_node(n, props);
        }
        return true;
    }

    this.links_rm = function(links) {
        var ids = links.map(function (link) {
            util.assert(link.id !== undefined, 'bug: link without an id');
            return link.id;
        });

        var topo_diff = model_diff.new_topo_diff({link_id_set_rm: ids});
        this.commit_and_tx_diff__topo(topo_diff);
    }

    /**
     * links the first node in the list to the rest of the list.
     */
    var nodes__link_fan = function(node_ids) {
        util.assert(node_ids.length > 1); // strictly speaking we can also treat 1 as correct usage
        var src_id = node_ids[0],
            src_node = find_node__by_id(src_id),
            added_links = node_ids.slice(1).map(function (tgt_id) {
                return model_core.create_link__set_random_id(src_node, find_node__by_id(tgt_id),
                                                             {name: 'link'});
            });
        commit_and_tx_diff__topo(model_diff.new_topo_diff({link_set_add: added_links}));
    };
    this.nodes__link_fan = nodes__link_fan;

    var nodes__merge = function(node_ids) {
        util.assert(node_ids.length > 1); // strictly speaking we can also treat 1 as correct usage
        var merged = _.rest(node_ids);
        var merge_node_id = node_ids[0];
        var merge_node = find_node__by_id(merge_node_id);
        var topo_diff;
        util.assert(merge_node != null);
        var added_links = _.flatten(_.map(merged, function (node_id) {
            var src_links = find_link__by_src_id(node_id)
                .filter(function (src_link) { return src_link.__dst.id !== merge_node_id; })
                .map(function (src_link) {
                return model_core.create_link__set_random_id(merge_node, src_link.__dst, {
                    name: src_link.name,
                });
            });
            var dst_links = find_link__by_dst_id(node_id)
                .filter(function (dst_link) { return dst_link.__src.id !== merge_node_id; })
                .map(function (dst_link) {
                return model_core.create_link__set_random_id(dst_link.__src, merge_node, {
                    name: dst_link.name,
                });
            });
            return _.union(src_links, dst_links);
        }));
        topo_diff = model_diff.new_topo_diff({
            link_set_add: added_links,
            node_id_set_rm: merged});
        commit_and_tx_diff__topo(topo_diff);
    };
    this.nodes__merge = nodes__merge;

    var _remove_link_set = function(link_id_set) {
        link_id_set.forEach(function (id) {
            var link = id_to_link_map[id];
            if (undefined === link) {
                console.log("warning: server returned an id we don't have " + id);
                return;
            }
            _link_remove_helper(id);
            console.log('_remove_link_set: ' + id);
        });
    }
    this._remove_link_set = _remove_link_set;

    this.nodes_rm = function(state) {
        var node_ids = get_nodes().filter(function (n) { return n.state == state; })
                                 .map(function (n) { return n.id; }),
            topo_diff = model_diff.new_topo_diff({
                node_id_set_rm : node_ids,
            });

        this.commit_and_tx_diff__topo(topo_diff);
    }

    var findLink = function(src_id, dst_id, name) {
        var link_key, link;

        for (link_key in id_to_link_map) {
            link = id_to_link_map[link_key];
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
    var find_node__by_id = function(id, recursive) {
        // default to recursion
        recursive = recursive === undefined ? true : recursive;
        if (recursive && base) {
            var base_node = base.find_node__by_id(id, recursive);
            if (base_node) {
                return base_node;
            }
        }
        return id_to_node_map[id] || null;
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

    /**
     * @param id unique id of link
     * @return Link with given id
     */
    var find_link__by_id = function(id, recursive) {
        // default to recursion
        recursive = recursive === undefined ? true : recursive;
        if (recursive && base) {
            var base_link = base.find_link__by_id(id, recursive);
            if (base_link) {
                return base_link;
            }
        }
        return id_to_link_map[id] || null;
    }
    this.find_link__by_id = find_link__by_id;

    /**
     * @param id of source node
     * @return array of links whose source node is id
     * FIXME: none O(E) implementation (used by merge)
     */
    var find_link__by_src_id = function(src_id) {
        return _.filter(get_links(), function (link) { return link.__src.id == src_id; });
    }
    this.find_link__by_src_id = find_link__by_src_id;

    /**
     * @param id of destination node
     * @return array of links whose destination node is id
     * FIXME: none O(E) implementation (used by merge)
     */
    var find_link__by_dst_id = function(dst_id) {
        return _.filter(get_links(), function (link) { return link.__dst.id == dst_id; });
    }
    this.find_link__by_dst_id = find_link__by_dst_id;


    var find_node__by_name = function(name, recursive) {
        // default to recursion
        recursive = recursive === undefined ? true : recursive;
        if (recursive && base) {
            var node = base.find_node__by_name(name, true);
            if (node !== null) {
                return node;
            }
        }
        for (var k in id_to_node_map) {
            if (compareNames(id_to_node_map[k].name, name)) {
                return id_to_node_map[k];
            }
        }
        return null;
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
        id_to_node_map = {}
        id_to_link_map = {};
        id_to_link_map = {};
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

        util.assert(undefined !== l_ptr.id, 'load_from_backend: l_ptr missing id');
        util.assert(undefined !== src_id, 'load_from_backend: link missing __src_id');
        util.assert(undefined !== dst_id, 'load_from_backend: link missing __dst_id');

        // cleanup & reuse as link_spec
        delete l_ptr.__src_id;
        delete l_ptr.__dst_id;
        var link_spec = l_ptr;
        link_spec.__src = find_node__by_id(src_id);
        link_spec.__dst = find_node__by_id(dst_id);

        util.assert(undefined !== link_spec.__src, "src_id not found");
        util.assert(undefined !== link_spec.__dst, "dst_id not found");

        return link_spec;
    }

    function __commit_diff_ajax__clone(clone) {
        var node_specs = clone.node_set_add.map(on_backend__node_add),
            nodes = _add_node_set(node_specs),
            link_specs = clone.link_set_add.map(on_backend__link_add),
            links = _add_link_set(link_specs);
        diffBus.push({node_set_add: nodes, link_set_add: links});
    }

    function __commit_diff_ajax__topo(diff) {
        diff.node_set_add = diff.node_id_set_add.map(_get_server_pending);
        diff.link_set_add = diff.link_id_set_add.map(_get_server_pending);
        commit_diff__topo(diff);
    }

    function _get_server_pending(id) {
        // FIXME: should track cache
        var spec;

        util.assert(undefined !== server_pending_objects[id]);

        spec = server_pending_objects[id];
        delete server_pending_objects[id];
        return spec;
    }

    function _add_node_set(node_specs) {
        return node_specs.map(function (node_spec) {
            __addNode(node_spec);
        });
    }

    function _add_link_set(link_specs) {
        return link_specs.map(function (link_spec) {
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
        _add_node_set(diff.node_set_add);
        _add_link_set(diff.link_set_add);
        // done under protest
        _remove_link_set(diff.link_id_set_rm);
        _remove_node_set(diff.node_id_set_rm);
        diffBus.push(diff);
    }
    this.commit_diff__topo = commit_diff__topo;

    /**
     * Apply a Attr_Diff:
     *    - commit diff to the local graph instanse
     *    - emit a diffBus event
     *
     * This function should not trigger remote transmission of diff object
     */
    function commit_diff__attr(attr_diff) {
        util.assert(model_diff.is_attr_diff(attr_diff), 'commit_diff__attr: argument type != Attr_Diff');

        // process nodes
        attr_diff.for_each_node(function(n_id, n_attr_diff) {

            var node = id_to_node_map[n_id];
            if (undefined == node) {
                console.warn('commit_diff__attr: incoming attr diff for non-existing node, discarding');
                return;
            }

            // apply attr writes: node
            var count_w = 0;
            for (var attr_key in n_attr_diff['__attr_write']) {
                var attr_value = n_attr_diff['__attr_write'][attr_key];
                node[attr_key] = attr_value; // write each new attr update
                count_w = count_w + 1;
            };

            // apply attr removals: node
            var count_d = 0;
            for (var attr_key in n_attr_diff['__attr_remove']) {
                delete node[attr_key];  // apply each attr removal
                count_d = count_d + 1;
            };

            console.log('commit_diff__attr: n_id: \'' + n_id + '\', write-count: ' + count_w + ', rm-count: ' + count_d);
        });

        // process links
        attr_diff.for_each_link(function(l_id, n_attr_diff) {

            var link = id_to_link_map[l_id];
            if (undefined == link) {
                console.warn('commit_diff__attr: incoming attr diff for non-existing link, discarding');
                return;
            }

            // apply attr writes: link
            var count_w = 0;
            for (var attr_key in n_attr_diff['__attr_write']) {
                var attr_value = n_attr_diff['__attr_write'][attr_key];
                link[attr_key] = attr_value; // write each new attr update
                count_w = count_w + 1;
            };

            // apply attr removals: link
            var count_d = 0;
            for (var attr_key in n_attr_diff['__attr_remove']) {
                delete link[attr_key];  // apply each attr removal
                count_d = count_d + 1;
            };

            console.log('commit_diff__attr: l_id: \'' + l_id + '\', write-count: ' + count_w + ', rm-count: ' + count_d);
        });

        diffBus.push(attr_diff);
    }
    this.commit_diff__attr = commit_diff__attr;

    /**
     * perform initial DB load from backend
     *
     * @param on_success: should be used by MVP presentors to trigger UI update
     */
    // @ajax-trans
    function load_from_backend(on_success) {

        function on_success__ajax(clone) {
            __commit_diff_ajax__clone(clone);
            undefined != on_success && on_success();
        }

        rz_api_backend.clone(0, on_success__ajax);
    }
    this.load_from_backend = load_from_backend;

    var new_topo_diff__from_nodes_links = function (nodes, links) {
        var diff,
            node_by_id = {},
            old_id_to_new_id = {};

        diff = model_diff.new_topo_diff();
        diff.node_set_add = nodes.map(function(ext_spec) {
                var node_spec = {
                       name: ext_spec.name ? ext_spec.name : ext_spec.id,
                       type: ext_spec.type,
                       state: "perm",
                       status: ext_spec.status,
                       url: ext_spec.url,
                       x: ext_spec.x,
                       y: ext_spec.y,
                    },
                    node;

                if (ext_spec.start) {
                    node_spec.start = new Date(ext_spec.start);
                }
                if (ext_spec.end) {
                    node_spec.end = new Date(ext_spec.end);
                }
                node = model_core.create_node__set_random_id(node_spec);
                old_id_to_new_id[ext_spec.id] = node.id,
                node_by_id[node.id] = node;
                return node;
            });
        diff.link_set_add = links.map(function (link_spec) {
                var src = node_by_id[old_id_to_new_id[link_spec.__src]],
                    dst = node_by_id[old_id_to_new_id[link_spec.__dst]],
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
            cached_nodes = object_values(id_to_node_map);
            invalidate_nodes = false;
        }
        return cached_nodes;
    };
    this.nodes = get_nodes;

    var get_links = function() {
        if (cached_links === undefined || invalidate_links) {
            cached_links = object_values(id_to_link_map);
            invalidate_links = false;
        }
        return cached_links;
    };
    this.links = get_links;

    function setRegularState() {
        var x, node, link, s;

        for (x in id_to_node_map) {
            node = id_to_node_map[x];
            s = node.state;
            if (s === 'chosen' || s === 'enter' || s === 'exit') {
                node.state = 'perm';
            }
        }
        for (x in id_to_link_map) {
            link = id_to_link_map[x];
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
