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

"use strict";

define(['underscore', 'Bacon', 'consts', 'util', 'model/core', 'model/util', 'model/diff', 'rz_api_backend',
        'local_backend', 'rz_api_mesh', 'history', 'model/types'],
function (_,           Bacon,   consts,   util,   model_core,   model_util,   model_diff,   rz_api_backend,
         local_backend,   rz_api_mesh,   history,   model_types) {

// aliases
var all_attributes = model_types.all_attributes;

var debug = false;

function Graph(spec) {

    var id_to_node_map,
        id_to_link_map,
        id_to_link_id_set,
        diffBus = new Bacon.Bus(),
        activityBus = new Bacon.Bus(),
        cached_links,
        invalidate_links = true,
        cached_nodes,
        invalidate_nodes = true,
        temporary = spec.temporary,
        base = spec.base,
        server_pending_objects = [],
        filtered_types = {}, // set of node types not to show
        backend;

    util.assert(spec.temporary || (spec.backend === 'rhizi' || spec.backend === 'local' || spec.backend === 'none'),
        'missing or wrong backend attribute on non temporary spec');
    this.temporary = temporary;
    this.base = base;
    this.backend = backend = (temporary || spec.backend === 'none') ? null :
        (spec.backend === 'local' ? local_backend : rz_api_backend);

    util.assert(temporary !== undefined, "specs.temporary is undefined");
    util.assert(base !== undefined, "specs.base is undefined");

    clear();

    // All operations done on the graph. When the server is used (i.e. always) this
    // bus contains the server events, not the user events (most of the time the same just with delay).
    this.diffBus = diffBus;

    // Same as diffBus, but includes operations done in the past, loaded when
    // the document is loaded (commit log)
    this.activityBus = activityBus;

    var links_forEach = function (f) {
        for (var link_key in id_to_link_map) {
            f(id_to_link_map[link_key]);
        }
    };

    var nodes_forEach = function (f) {
        for (var node_key in id_to_node_map) {
            f(id_to_node_map[node_key]);
        }
    };

    function key_count(obj) {
        return _.keys(obj).length;
    }

    var degree = function (node) {
        return key_count(id_to_link_id_set[node.id]);
    };
    this.degree = degree;

    /**
     * add node if no previous node is present whose id equals that of the node being added
     *
     * @return node if node was actually added
     */
    this.addTempNode = function(spec) {
	    if (temporary) {
            return this.__addNode(spec);
        }
    };

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

        return touched_links.map(function(l){ return l.id; });
    };

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

        backend.commit_diff__topo(topo_diff, __commit_diff_ajax__topo);
    };
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
            existing_node = find_node__by_name(spec.name);
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
        delete id_to_link_id_set[node_id];
        invalidate_nodes = true;
    };

    var _node_add_helper = function (node) {
        util.assert(node.id, "missing node id");
        id_to_node_map[node.id] = node;
        id_to_link_id_set[node.id] = [];
        invalidate_nodes = true;
    };

    var _link_remove_helper = function (link_id) {
        var link = id_to_link_map[link_id],
            src_id = link.__src.id,
            dst_id = link.__dst.id;

        util.assert(link_id, "missing link id");
        util.assert(link, "non existent link");
        delete id_to_link_id_set[src_id][dst_id];
        delete id_to_link_id_set[dst_id][src_id];
        delete id_to_link_map[link_id];
        util.assert(id_to_link_map[link_id] === undefined, "delete failed?!");
        invalidate_links = true;
    };

    var _link_add_helper = function (link) {
        var src_id = link.__src.id,
            dst_id = link.__dst.id;

        util.assert(link.id, "missing link id");
        id_to_link_map[link.id] = link;
        // link's nodes may not belong to this graph, check first - we add them if required to the id_to_link_id_set only
        if (id_to_link_id_set[src_id] === undefined) {
            id_to_link_id_set[src_id] = [];
        }
        if (id_to_link_id_set[dst_id] === undefined) {
            id_to_link_id_set[dst_id] = [];
        }
        id_to_link_id_set[src_id][dst_id] = 1;
        id_to_link_id_set[dst_id][src_id] = 1;
        invalidate_links = true;
        return link;
    };

    var _remove_node_set = function(node_id_set) {
        node_id_set.forEach(function (id) {
            if (undefined === id_to_node_map[id]) {
                console.log("warning: server returned an id we don't have " + id);
                return;
            }
            _node_remove_helper(id);
            console.log('_remove_node_set: ' + id);
        });
    };
    this._remove_node_set = _remove_node_set;

    function calc_neighbours() {
        return _.reduce(get_links(), function(d, link) {
                d[link.__src.id].src.push(link);
                d[link.__dst.id].dst.push(link);
                return d;
            }, _.object(_.map(get_nodes(), "id"),
                        get_nodes().map(function (n) {
                            return {node: n, src: [], dst: []};
                        })
                       ));
    }


    /**
     * Visitation constants for neighbourhood and shortest paths computation.
     */
    var kind_exit = 1,
        kind_enter = 2,
        kind_selected = 4;

    function kind_to_string(kind) {
        switch (kind) {
        case kind_exit: return 'exit';
        case kind_enter: return 'enter';
        case kind_selected: return 'selected';
        default:
            // TODO: add css for both
            return 'exit';
        }
    }

    function BFS(node_id) {
        var neighbours = calc_neighbours(),
            queue = [node_id],
            start_id,
            node_ids = get_node_ids(),
            V = _.object(node_ids, _.map(node_ids, function (id) {
                return {node_id: id, distance: Infinity, prev: {}};
            })),
            ret = {};

        V[node_id].distance = 0;
        while ((start_id = queue.shift()) !== undefined) {
            var src_ids = _.pluck(_.pluck(neighbours[start_id].src, "__dst"), "id"),
                dst_ids = _.pluck(_.pluck(neighbours[start_id].dst, "__src"), "id"),
                n_ids = src_ids.concat(dst_ids);

            _.each(n_ids, function(next_id) {
                var distance = V[start_id].distance + 1;

                if (V[next_id].distance >= distance) {
                    V[next_id].distance = distance;
                    V[next_id].prev[start_id] = true;
                    queue.push(next_id);
                }
            });
        }
        _.each(_.keys(V), function (k) {
            if (V[k].distance !== Infinity) {
                ret[k] = V[k];
            }
        });
        return ret;
    }
    this.BFS = BFS;

    /**
     * pairs_symmetric
     *
     * cb will be called for every pair in the input list but only in the order
     * lower_index, maybe_higher_index
     * where lower_index <= maybe_higher_index (i.e. diagonal is covered).
     *
     * i.e. for |list| = N, (N + 1) * N / 2 calls are made
     */
    function pairs_symmetric(list, cb) {
        var i, j, N = list.length;

        for (i = 0 ; i < N; ++i) {
            for (j = i; j < N ; ++j) {
                cb(list[i], list[j]);
            }
        }
    }

    /**
     * @sources - list of nodes
     *
     * returns all nodes in the shortest paths between all sources.
     *
     * returns same dictionary as neighbourhood.
     */
    function shortest_paths(sources) {

        function make_status(node, distance, prev_nodes) {
            return {node: node, distances: distance || 0, prev_nodes: prev_nodes || {}};
        }
        var ids = _.pluck(sources, 'id'),
            bfs = _.object(ids, _.map(ids, BFS)),
            nodes = {};

        function append_paths(bfs, start_id) {
            var queue = [bfs[start_id]],
                next,
                next_id;

            while ((next = queue.shift()) !== undefined) {
                next_id = next.node_id;
                if (nodes[next_id] === undefined) {
                    nodes[next_id] = {node_id: next_id, sources: {}};
                }
                _.each(_.keys(next.prev), function (p) {
                    nodes[next_id].sources[p] = true;
                    queue.push(bfs[p]);
                });
            }
        }

        pairs_symmetric(ids, function (one, two) {
            if (bfs[one][two] !== undefined && bfs[one][two].distance === Infinity) {
                return;
            }
            append_paths(bfs[one], two);
        });

        return {
            'nodes': _.values(nodes),
            'links': []
        };
    }
    this.shortest_paths = shortest_paths;

    /**
     *
     * neighbourhood
     *
     * @start - list of starting nodes
     * @d - radius of neighbours
     *
     * NOTE: Doesn't handle inter graph links
     * NOTE: return doesn't include original nodes
     *
     * @return - {
     *  'nodes': [{
     *      node: node,
     *      kind: kind,
     *      sources: {node_id: true}
     *   }]
     *  'links: [{link: link, kind: kind}]
     *  }
     *
     * kind: exit/enter
     *
     * TODO: implement for d !== 1
     *
     */
    this.neighbourhood = function(start, d) {
        var ret = {'nodes':[], 'links':[]};

        function addNode(node) {
            if (start.filter(function (n) { return n.id == node.id; }).length == 1) {
                return;
            }
            ret.nodes.push(node);
        }
        function get_name(node) {
            // XXX: using lowercase name comparison instead of id because nodes may be stale
            return node.name.toLowerCase();
        }

        if (start === undefined) {
            console.log('neighbourhood: bug: called with undefined node');
            return ret;
        }
        if (d > 1) {
            console.log('neighbourhood: bug: not implemented for d == ' + d);
        }
        if (d === 0) {
            // 0 depth is empty group of nodes and links
            return ret;
        }
        d = d || 1;

        if (start.length === undefined) {
            console.log('neighbourhood: expected array');
            return ret;
        }

        function make_status(kind, node) {
            return {node: node, kind: kind, links: [], depth: Infinity, sources: {}};
        }

        var nodes = get_nodes(),
            links = get_links(),
            neighbours = calc_neighbours(),
            visited = _.object(_.map(start, get_name),
                               _.map(start, _.partial(make_status, kind_selected)));

        function visit(source, link, getter, kind, depth) {
            var node = getter(link),
                name = get_name(node),
                data = visited[name];

            if (data === undefined) {
                data = visited[name] = make_status(0, node);
            }
            data.kind |= kind;
            data.links.push({link: link, kind: kind});
            data.depth = Math.min(data.depth, depth);
            data.sources[source.id] = true;
            return data;
        }

        _.each(start, function (node) {
            var N = neighbours[node.id];

            _.each(N.src, function (link) {
                visit(node, link, function (link) { return link.__dst; }, kind_enter);
            });
            _.each(N.dst, function (link) {
                visit(node, link, function (link) { return link.__src; }, kind_exit);
            });
        });
        _.values(visited).forEach(function (data) {
            var node = data.node,
                kind = data.kind,
                links = data.links;

            if ((kind & kind_selected) === kind_selected) {
                return;
            }
            ret.nodes.push({type: kind_to_string(kind), node: node, sources: data.sources});
            _.each(links, function (data) {
                ret.links.push({link: data.link, kind: kind_to_string(kind)});
            });
        });
        return ret;
    };

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
    };

    function __addLink(link) {

        var trimmed_name = link.name.trim();

        util.assert(link instanceof model_core.Link);

        if (link.name.length != trimmed_name.length) {
            console.log('bug: __addLink with name containing spaces - removing before sending to server');
        }
        link.name = trimmed_name;

        var existing_link = findLink(link.__src.id, link.__dst.id, link.name);

        if (undefined == existing_link) {
            existing_link = _link_add_helper(link);
        } else {
            existing_link.name = link.name;
            existing_link.state = link.state;
        }
        return existing_link;
    }
    // FIXME: good idea to add API based on constructor parameter?
    if (temporary) {
        this.addTempLink = function (link) {
            return __addLink(link);
        };
    }

    this.update_link = function(link, new_link_spec, on_success, on_error) {
        util.assert(link instanceof model_core.Link);

        // TODO - fake api for client only (debug, demo, ui work)
        if (!rz_config.backend_enabled) return;

        var attr_diff = model_diff.new_attr_diff();
        for (var key in new_link_spec) {
            attr_diff.add_link_attr_write(link.id, key, new_link_spec[key]);
        }

        var on_ajax_success = function(attr_diff_spec) {
            var attr_diff = model_util.adapt_format_read_diff__attr(attr_diff_spec),
		id_to_link_map = attr_diff.id_to_link_map,
		key,
		l_id = link.id; // original node id

            util.assert(id_to_link_map && id_to_link_map[l_id], "bad return value from ajax");

            var ret_link = id_to_link_map[l_id];
            for (key in ret_link['__attr_write']){
                link[key] = ret_link['__attr_write'][key];
            }
            for (key in ret_link['__attr_remove']){
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

        backend.commit_diff__attr(attr_diff, on_ajax_success, on_ajax_error);
    };

    function layout_x_key(layout_name) {
        return 'layouts_' + layout_name + '_x';
    }
    this.layout_x_key = layout_x_key;

    function layout_y_key(layout_name) {
        return 'layouts_' + layout_name + '_y';
    }
    this.layout_y_key = layout_y_key;

    function layout_fixed_key(layout_name) {
        return 'layouts_' + layout_name + '_fixed';
    }
    this.layout_fixed_key = layout_fixed_key;

    function close_to(a, b, eps) {
        return Math.abs(a - b) < eps;
    }

    var eps = 0.001;

    /**
     * Do an attribute commit with x, y for the current layout
     */
    this.nodes__store_layout_positions = function(layout_name, node_ids) {
        // TODO: fix when attribute diff supports nested keys to use:
        // layout.<layout_name>.{x,y}
        var x_key = layout_x_key(layout_name),
            y_key = layout_y_key(layout_name),
            fixed_key = layout_fixed_key(layout_name),
            changes = 0;

        if (node_ids && node_ids.forEach) {
            node_ids = node_ids.filter(function (node_id) {
                return id_to_node_map[node_id] !== undefined;
            });
        } else {
            node_ids = _.keys(id_to_node_map);
        }

        // commit x, y to layout
        node_ids.forEach(function (node_id) {
            var node = id_to_node_map[node_id],
                db_x = node[x_key],
                db_y = node[y_key],
                x = node.x,
                y = node.y;

            if (close_to(db_x, x, eps) && close_to(db_y, y, eps)) {
                return;
            }
            node[x_key] = node.x;
            node[y_key] = node.y;
            changes += 1;
        });
        if (changes === 0) {
            return;
        }
        console.log('sending ' + changes + ' nodes position for layout ' + layout_name);
        // commit all current nodes
        nodes__commit_attributes(node_ids, function (node) {
            var d = {};

            d[x_key] = node.x;
            d[y_key] = node.y;
            d[fixed_key] = node.fixed;
            return d;
        });
    };

    function nodes__commit_attributes(node_ids, getter) {
        var attr_diff = model_diff.new_attr_diff();
        node_ids.forEach(function (node_id) {
            var node = id_to_node_map[node_id],
                d = getter(node);
            _.keys(d).forEach(function (k) {
                attr_diff.add_node_attr_write(node.id, k, d[k]);
            });
        });
        var on_ajax_success = function() {
        };
        var on_ajax_error = function(){
            console.log('error with commit nodes properties to server');
        };
        backend.commit_diff__attr(attr_diff, on_ajax_success, on_ajax_error);
    }

    this.update_node = function(node, new_node_spec) {
        util.assert(node instanceof model_core.Node);

        // TODO - fake api for client only (debug, demo, ui work)
        if (!rz_config.backend_enabled) { return; }

        if (new_node_spec.name !== undefined && node.name !== new_node_spec.name){
            /*
             * handle name update collision: suggest removal first
             */
            var n_eq_name = find_node__by_name(new_node_spec.name);
            if (null !== n_eq_name && n_eq_name !== node) {
                if (window.confirm('really merge ' + node.name + ' into ' + n_eq_name.name + '?')) {
                    nodes__merge([n_eq_name.id, node.id]);
                }
            }

            node.name = new_node_spec.name; // [!] may still fail due to server NAK
        }

        var attr_diff = model_diff.new_attr_diff();
        for (var key in new_node_spec) {
            attr_diff.add_node_attr_write(node.id, key, new_node_spec[key]);
        }

        var on_ajax_success = function(attr_diff_spec){
            var attr_diff = model_util.adapt_format_read_diff__attr(attr_diff_spec),
                    id_to_node_map = attr_diff.id_to_node_map,
                    key,
                    n_id = node.id; // original node id

            util.assert(id_to_node_map && id_to_node_map[n_id], "bad return value from ajax");

            var ret_node = id_to_node_map[n_id];
            for (key in ret_node.__attr_write){
                node[key] = ret_node.__attr_write[key];
            }
            for (key in ret_node.__attr_remove){
                delete node[key];
            }

            diffBus.push(attr_diff);
        };

        var on_ajax_error = function(){
            console.log('error with commit to server: danger robinson!');
        };
        backend.commit_diff__attr(attr_diff, on_ajax_success, on_ajax_error);
    };
    var update_node = this.update_node;

    this.editNameByName = function(old_name, new_name) {
        var node = find_node__by_name(old_name);

        if (node === undefined) {
            console.log('editNameByName: error: cannot find node with name ' + old_name);
            return;
        }
        this.editName(node.id, new_name);
    };

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
    };

    /**
     * editType:
     *
     * @return true if type changed
     */
    this.editType = function(id, newtype) {
        return this._editProperty(id, 'type', newtype);
    };

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
    };

    this.links__delete = function(link_ids) {
        var topo_diff = model_diff.new_topo_diff({link_id_set_rm: link_ids});
        this.commit_and_tx_diff__topo(topo_diff);
    };

    this.nodes__delete = function(node_ids) {
        var topo_diff = model_diff.new_topo_diff({node_id_set_rm: node_ids});
        this.commit_and_tx_diff__topo(topo_diff);
    };

    /**
     * links the first node in the list to the rest of the list.
     */
    var nodes__link_fan = function(node_ids) {
        util.assert(node_ids.length > 1); // strictly speaking we can also treat 1 as correct usage
        var src_id = node_ids[0],
            src_node = find_node__by_id(src_id),
            added_links = node_ids.slice(1).map(function (tgt_id) {
                return model_core.create_link__set_random_id(src_node, find_node__by_id(tgt_id),
                                                             {name: consts.EMPTY_LINK_NAME});
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
                    name: src_link.name
                });
            });
            var dst_links = find_link__by_dst_id(node_id)
                .filter(function (dst_link) { return dst_link.__src.id !== merge_node_id; })
                .map(function (dst_link) {
                return model_core.create_link__set_random_id(dst_link.__src, merge_node, {
                    name: dst_link.name
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
    };
    this._remove_link_set = _remove_link_set;

    this.nodes_rm = function(state) {
        var node_ids = get_nodes().filter(function (n) { return n.state == state; })
                                 .map(function (n) { return n.id; }),
            topo_diff = model_diff.new_topo_diff({
                node_id_set_rm : node_ids
            });

        this.commit_and_tx_diff__topo(topo_diff);
    };

    var findLink = function(src_id, dst_id, name) {
        var link_key, link;

        for (link_key in id_to_link_map) {
            link = id_to_link_map[link_key];
            if (link.__src.id === src_id && link.__dst.id === dst_id) {
                return link;
            }
        }
	return undefined;
    };

    var find_links__by_nodes = function(nodes) {
        var ids = util.set_from_array(_.pluck(nodes, "id"));

        return get_links().filter(function (link) {
            return ids[link.__src.id] && ids[link.__dst.id];
        });
    };
    this.find_links__by_nodes = find_links__by_nodes;

    var find_links__by_state = function(state) {
        var foundLinks = [];
        links_forEach(function (link) {
            if (link.state == state) {
                foundLinks.push(link);
            }
        });
        return foundLinks;
    };

    var compareNames = function(name1, name2) {
        return name1.toLowerCase() === name2.toLowerCase();
    };

    var hasNodeByName = function(name, state) {
        return get_nodes().filter(function (n) {
            return compareNames(n.name, name) && (undefined === state || n.state === state);
        }).length > 0;
    };
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
    };
    this.find_node__by_id = find_node__by_id;

    var find_nodes__by_id = function(ids, recursive) {
        return _.map(ids, function (id) { return find_node__by_id(id, recursive); });
    };
    this.find_nodes__by_id = find_nodes__by_id;

    /**
     * @param filter: must return true in order for node to be included in the returned set
     */
    var find_nodes__by_filter = function(filter) {
        var ret = [];
        _.values(id_to_node_map).map(function(n) {
           if (true == filter(n)){
               ret.push(n);
           }
        });
        return ret;
    };

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
    };
    this.find_link__by_id = find_link__by_id;

    /**
     * @param id of source node
     * @return array of links whose source node is id
     * FIXME: none O(E) implementation (used by merge)
     */
    var find_link__by_src_id = function(src_id) {
        return _.filter(get_links(), function (link) { return link.__src.id == src_id; });
    };
    this.find_link__by_src_id = find_link__by_src_id;

    /**
     * @param id of destination node
     * @return array of links whose destination node is id
     * FIXME: none O(E) implementation (used by merge)
     */
    var find_link__by_dst_id = function(dst_id) {
        return _.filter(get_links(), function (link) { return link.__dst.id == dst_id; });
    };
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
    };
    this.find_node__by_name = find_node__by_name;

    var find_nodes__by_state = function(state) {
        var foundNodes = [];
        nodes_forEach(function (node) {
            if (node.state === state) {
                foundNodes.push(node);
            }
        });
        return foundNodes;
    };

    function clear(push_diff) {
        push_diff = push_diff === undefined ? true : push_diff;
        id_to_node_map = {};
        id_to_link_map = {};
        id_to_link_id_set = {};
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
    };

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

        if (null === link_spec.__src) {
            util.log_error("src_id not found: " + src_id);
            return null;
        }
        if (null === link_spec.__dst) {
            util.log_error("dst_id not found: " + dst_id);
            return null;
        }

        return link_spec;
    }

    function __commit_diff_ajax__clone(clone) {
        var topo = clone[0],
            commits = clone[1].reverse(), // [!] received in new to old order, need them reversed
            node_specs = topo.node_set_add.map(on_backend__node_add),
            nodes = _add_node_set(node_specs),
            link_specs = topo.link_set_add.map(on_backend__link_add).filter(function (link_spec) {
                return link_spec !== null;
            }),
            links = _add_link_set(link_specs);
        commits.forEach(function (commit) {
            activityBus.push(commit);
        });
        diffBus.push({node_set_add: nodes, link_set_add: links});
    }

    function __commit_diff_ajax__topo(diff) {
        if (diff.node_set_add === undefined) {
            diff.node_set_add = diff.node_id_set_add.map(_get_server_pending);
        }
        if (diff.link_set_add === undefined) {
            diff.link_set_add = diff.link_id_set_add.map(_get_server_pending);
        }
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
            return __addNode(node_spec);
        });
    }

    function _add_link_set(link_specs) {
        return link_specs.map(function (link_spec) {
            // resolve link ptr
            var src = (undefined !== link_spec.__src && null !== link_spec.__src &&
                       (find_node__by_id(link_spec.__src.id) || link_spec.__src)) ||
                        find_node__by_id(link_spec.__src_id),
                dst = (undefined !== link_spec.__dst && null !== link_spec.__dst &&
                       (find_node__by_id(link_spec.__dst.id) || link_spec.__dst)) ||
                        find_node__by_id(link_spec.__dst_id),
                link = model_core.create_link_from_spec(src, dst, link_spec);

            return __addLink(link);
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
        var total_count_d = 0,
            total_count_w = 0,
            count_n = 0;

        util.assert(model_diff.is_attr_diff(attr_diff), 'commit_diff__attr: argument type != Attr_Diff');

        // process nodes
        attr_diff.for_each_node(function(n_id, n_attr_diff) {
            var attr_key,
                node = id_to_node_map[n_id];

            if (undefined === node) {
                console.warn('commit_diff__attr: incoming attr diff for non-existing node, discarding');
                return;
            }

            // apply attr writes: node
            var count_w = 0;
            for (attr_key in n_attr_diff.__attr_write) {
                var attr_value = n_attr_diff.__attr_write[attr_key];
                node[attr_key] = attr_value; // write each new attr update
                count_w = count_w + 1;
            }

            // apply attr removals: node
            var count_d = 0;
            for (attr_key in n_attr_diff.__attr_remove) {
                delete node[attr_key];  // apply each attr removal
                count_d = count_d + 1;
            }
            if (count_w > 0 || count_d > 0) {
                count_n += 1;
            }
            total_count_w += count_w;
            total_count_d += count_d;
        });
        console.log('commit_diff__attr: nodes: ' + count_n + ', writes: ' + total_count_w + ', removals: ' + total_count_d);

        // process links
        attr_diff.for_each_link(function(l_id, n_attr_diff) {
            var attr_key,
                link = id_to_link_map[l_id];

            if (undefined === link) {
                console.warn('commit_diff__attr: incoming attr diff for non-existing link, discarding');
                return;
            }

            // apply attr writes: link
            var count_w = 0;
            for (attr_key in n_attr_diff.__attr_write) {
                var attr_value = n_attr_diff.__attr_write[attr_key];
                link[attr_key] = attr_value; // write each new attr update
                count_w = count_w + 1;
            }

            // apply attr removals: link
            var count_d = 0;
            for (attr_key in n_attr_diff.__attr_remove) {
                delete link[attr_key];  // apply each attr removal
                count_d = count_d + 1;
            }

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
    function load_from_backend(on_success, on_error) {

        function on_success_wrapper(clone) {
            __commit_diff_ajax__clone(clone);
            undefined != on_success && on_success();
        }

        backend.rzdoc_clone(on_success_wrapper, on_error);
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
                       x: ext_spec.x,
                       y: ext_spec.y
                    },
                    node;

                all_attributes.forEach(function (attr) {
                    node_spec[attr] = ext_spec[attr];
                });
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
                        state: 'perm' // FIXME: this is meaningless now with graph separation
                    });
                link.__src_id = src.id;
                link.__dst_id = dst.id;
                return link;
            });
        return diff;
    };
    this.new_topo_diff__from_nodes_links = new_topo_diff__from_nodes_links;

    this.load_from_nodes_links = function(nodes, links) {
        // FIXME: prompt for replace/merge; now defaulting to merge
        commit_and_tx_diff__topo(new_topo_diff__from_nodes_links(nodes, links));
    }

    this.load_from_json = function(json) {
        var data = JSON.parse(json);

        if (data == null) {
            console.log('load callback: no data to load');
            return;
        }
        this.load_from_nodes_links(data.nodes, data.links);
    };

    this.save_to_json = function() {
        var d = {"nodes":[], "links":[]},
            nodes = get_nodes(),
            links = get_links();

        for (var i = 0 ; i < nodes.length ; i++) {
            var node = nodes[i],
                node_dict = {id: node.id, x: node.x, y: node.y};

            all_attributes.forEach(function (attr) {
                  node_dict[attr] = node[attr];
            });
            d['nodes'].push(node_dict);
        }
        for (var j = 0 ; j < links.length ; j++) {
            var link = links[j];
            d['links'].push({
              "__src":link.__src.id,
              "__dst":link.__dst.id,
              "name":link.name
            });
        }
        return JSON.stringify(d);
    };

    this.set_user = function(user) {
        var elem = $('svg g.zoom')[0];
        this.user = user;
        this.history = new history.History(this.user, this, elem);
    };

    function clear_history() {
        if (this.history !== undefined) {
            this.history.clear();
        }
    }

    this.clear_history = clear_history;

    var get_nodes = function() {
        if (cached_nodes === undefined || invalidate_nodes) {
            cached_nodes = _.filter(id_to_node_map, function (node, node_id) {
                return filtered_types[node.type] === undefined;
            });
            invalidate_nodes = false;
        }
        return cached_nodes;
    };
    this.nodes = get_nodes;

    var get_node_ids = function() {
        return _.keys(id_to_node_map);
    };
    this.get_node_ids = get_node_ids;

    var get_links = function() {
        if (cached_links === undefined || invalidate_links) {
            cached_links = _.filter(id_to_link_map, function (link, link_id) {
                return filtered_types[link.__src.type] === undefined &&
                       filtered_types[link.__dst.type] === undefined;
            });
            invalidate_links = false;
        }
        return cached_links;
    };
    this.links = get_links;

    this.find__by_visitors = function(node_visitor, link_visitor) {
        var nodes = get_nodes(),
            links = get_links(),
            selected_nodes,
            selected_links;

        selected_nodes = node_visitor ? nodes.filter(node_visitor) : [];
        selected_links = link_visitor ? links.filter(link_visitor) : [];
        return {nodes: selected_nodes, links: selected_links};
    };

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
    this.node__set_filtered_types = function (new_filtered_types) {
        filtered_types = new_filtered_types;
        invalidate_links = true;
        invalidate_nodes = true;
    };
}

function is_node(item)
{
    return item.__src === undefined;
}

function is_link(item)
{
    return item.__src !== undefined;
}

return {
    Graph: Graph,
    is_node: is_node,
    is_link: is_link
};

});
