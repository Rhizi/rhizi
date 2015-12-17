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

define('view/selection',
        ['Bacon', 'jquery', 'underscore', 'messages', 'util'],
function(Bacon,           $,        _,    messages,   util) {

"use strict";

var rz_core, // circular dependency, see get_rz_core
    selection_count_element = $('#selection-count');

function selected_nodes_ids() {
    return _.pluck(selected_nodes, 'id');
}

function Selection() {
}

function new_selection(selected_nodes, related_nodes, selected_links, related_links)
{
    var ret = new Selection();

    ret.is_empty = function() {
        return ret.selected_nodes && ret.selected_nodes.length === 0;
    };

    ret.related_nodes = related_nodes;
    ret.selected_nodes = selected_nodes;
    ret.related_links = related_links;
    ret.selected_links = selected_links;
    return ret;
}

function get_rz_core()
{
    // circular dependency on rz_core, so require.js cannot solve it.
    if (rz_core === undefined) {
        rz_core = require('rz_core');
        listen_on_diff_bus(rz_core.main_graph.diffBus);
    }
    return rz_core;
}

function get_main_graph()
{
    return get_rz_core().main_graph;
}

function get_main_graph_view()
{
    return get_rz_core().main_graph_view;
}


var selected_nodes, // these are the nodes that are requested via update
    selected_nodes__by_id,
    related_nodes,  // these are not directly selected but we want to show them to users
    related_nodes__by_id,
    selected_links, // explicitly selected via external call
    selected_links__by_id,
    selected_links__by_node_id,
    related_links,  // implicitly selected via selected_links. note that links
                    // are considered related if both nodes are related as well.
    related_links__by_id,
    related_links__by_node_id,
    selectionChangedBus = new Bacon.Bus(),
    selection = selectionChangedBus.toProperty(new_selection([], [], [], [])),
    shortest_paths = false;


function listen_on_diff_bus(diffBus)
{
    diffBus
        .onValue(function () {
            // update due to potentially removed nodes first
            var new_selected_nodes = selected_nodes.filter(function (n) {
                return get_main_graph().find_node__by_id(n.id) !== null;
                }),
                new_selected_links = selected_links.filter(function (n) {
                    return get_main_graph().find_link__by_id(n.id) !== null;
                }),
                new_related_nodes = related_nodes.filter(function (n) {
                    return get_main_graph().find_node__by_id(n.id) !== null;
                }),
                new_related_links = related_links.filter(function (n) {
                    return get_main_graph().find_link__by_id(n.id) !== null;
                });
            // reselect based on current graph
            inner_select(new_selected_nodes, new_related_nodes,
                         new_selected_links, new_related_links);
        });
}

function nodes_to_id_dict(nodes)
{
    return nodes.reduce(
            function(d, v) {
                d[v.id] = v;
                return d;
            }, {});
}

function links_to_id_dict(links)
{
    return links.reduce(
            function(d, v) {
                d[v.id] = v;
                return d;
            }, {});
}

function links_to_node_id_dict(links)
{
    return links.reduce(
            function(d, v) {
                d[v.__src.id] = v;
                d[v.__dst.id] = v;
                return d;
            }, {});
}

function updateSelectedNodesBus(new_selected_nodes, new_related_nodes, new_selected_links, new_related_links)
{
    var selection_empty = new_selected_nodes.length + new_selected_links.length === 0;

    if (_.isEqual(selected_nodes, new_selected_nodes) && _.isEqual(related_nodes, new_related_nodes) &&
        _.isEqual(selected_links, new_selected_links) && _.isEqual(related_links, new_related_links)) {
        return;
    }
    selected_nodes = new_selected_nodes;
    selected_nodes__by_id = nodes_to_id_dict(selected_nodes);
    related_nodes = new_related_nodes;
    related_nodes__by_id = nodes_to_id_dict(related_nodes);
    selected_links = new_selected_links;
    selected_links__by_id = links_to_id_dict(selected_links);
    related_links = new_related_links;
    related_links__by_id = links_to_id_dict(related_links);
    selected_links__by_node_id = links_to_node_id_dict(selected_links);
    related_links__by_node_id = links_to_node_id_dict(related_links);
    selection_count_element.text(
        selection_empty ? '' :
            '' + selected_nodes.length + ', ' + related_nodes.length + ' | ' +
            '' + selected_links.length + ', ' + related_links.length);
    selectionChangedBus.push(new_selection(selected_nodes, related_nodes, selected_links, related_links));
}

function byVisitors(node_selector, link_selector) {
    var new_selection = get_main_graph().find__by_visitors(node_selector, link_selector);

    inner_select_nodes(new_selection.nodes, new_selection.links);
}

function _type_to_state(type) {
    switch (type) {
    case 'exit':
        return 'exit';
    case 'enter':
        return 'enter';
    }
    return '';
}

function _select_nodes_helper(nodes, connected) {
    var main_graph_view = get_main_graph_view();

    _.each(connected.nodes.filter(function (data) {
        return main_graph_view.node__pass_filter(data.node);
    }), function (data) {
        data.node.state = _type_to_state(data.type);
    });
    _.each(connected.links.filter(function (data) {
        return main_graph_view.link__pass_filter(data.link);
    }), function (data) {
        data.link.state = _type_to_state(data.type);
    });
    return {
        nodes: connected.nodes.map(function (d) { return d.node; }).concat(nodes.slice()),
        links: connected.links.map(function (d) { return d.link; }),
    };
}

function mutual_neighbours(nodes) {
    var connected = get_main_graph().neighbourhood(nodes, 1),
        ids;

    connected.nodes = connected.nodes.filter(function (data) {
        return _.size(data.sources) > 1;
    });
    ids = util.set_from_array(_.map(connected.nodes, function (data) { return data.node.id; }));
    connected.links = connected.links.filter(function (data) {
        return ids[data.link.__src.id] || ids[data.link.__dst.id];
    });
    return _select_nodes_helper(nodes, connected);
}

function nodes__shortest_paths(nodes) {
    var ret = get_main_graph().shortest_paths(nodes);

    ret.nodes = get_main_graph().find_nodes__by_id(_.pluck(ret.nodes, "node_id"));
    return ret;
}

/**
 * neighbours(nodes)
 *
 * set state of graph nodes and links that are neighbours of the nodes,
 * and the nodes themselves.
 */
function neighbours(nodes) {
    var connected = get_main_graph().neighbourhood(nodes, 1);

    return _select_nodes_helper(nodes, connected);
}

var node_related = function(node) {
    return related_nodes__by_id[node.id] !== undefined ||
           related_links__by_node_id[node.id] !== undefined;
};

var node_selected = function(node) {
    return selected_nodes__by_id[node.id] !== undefined;
};

var node_first_selected = function(node) {
    return selected_nodes && selected_nodes.length > 0 && node.id === selected_nodes[0].id;
};

var link_related = function(link) {
    return related_links__by_id[link.id] !== undefined ||
           node_related(link.__src) && node_related(link.__dst);
};

var link_selected = function(link) {
    return selected_links__by_id[link.id] !== undefined;
};

function empty_selection() {
    return related_nodes.length === 0 && selected_nodes.length === 0 &&
           related_links.length === 0 && selected_links.length === 0;
}

var class__node = function(node, temporary) {
    return (!temporary && !empty_selection()) ?
        (node_first_selected(node) ? 'first-selected' :
            (node_selected(node) ? 'selected' :
                (node_related(node) ? "related" : "notselected"))) : "";
};

var class__link = function(link, temporary) {
    return !temporary && !empty_selection() ?
        (link_selected(link) ? 'selected' :
            (link_related(link) ? "related" : "notselected")) : "";
};

var clear = function()
{
    updateSelectedNodesBus([], [], [], []);
};

function arr_compare(a1, a2)
{
    if (a1.length !== a2.length) {
        return false;
    }
    for (var i = 0 ; i < a1.length ; ++i) {
        if (a1[i] !== a2[i]) {
            return false;
        }
    }
    return true;
}

var inner_select_nodes = function(nodes, keep_selected_links)
{
    select_both(nodes, keep_selected_links ? selected_links : []);
};

var select_nodes = function(nodes, keep_selected_links)
{
    var new_nodes = nodes;
    var not_same = !arr_compare(new_nodes, selected_nodes);

    if (not_same) {
        inner_select_nodes(new_nodes, keep_selected_links);
    }
};

var select_both = function(new_nodes, new_links) {
    var related = neighbours(new_nodes);

    inner_select(new_nodes, related.nodes, new_links, related.links);
};

var select_shortest_path = function(new_nodes, new_links) {
    var related = nodes__shortest_paths(new_nodes);

    inner_select(new_nodes, related.nodes, new_links, related.links);
};

var select_normal = function(new_nodes, new_links) {
    select_both(new_nodes, new_links);
};

var inner_select = function(new_selected_nodes, new_related_nodes, new_selected_links, new_related_links)
{
    if (arr_compare(new_selected_nodes, selected_nodes) && arr_compare(new_related_nodes, related_nodes) &&
        arr_compare(new_selected_links, selected_links) && arr_compare(new_related_links, related_links)) {
        // no change
        return;
    }
    updateSelectedNodesBus(new_selected_nodes, new_related_nodes, new_selected_links, new_related_links);
};


var all_related_nodes = function() {
    return _.union(related_nodes, nodes_from_links(related_links));
};

var select_link = function(link)
{
    inner_select([], nodes_from_links([link]), [link], [link]);
};

function invert(initial, inverted)
{
    return _.union(_.difference(initial, inverted), _.difference(inverted, initial));
}

var invert_link = function(link)
{
    var new_selected_links = invert(selected_links, [link]),
        new_related_links = _.union(invert(related_links, [link]), new_selected_links);

    inner_select(selected_nodes, all_related_nodes(), new_selected_links, new_related_links);
};

var invert_nodes = function(nodes, keep_selected_nodes)
{
    var single_node_and_same = selected_nodes.length === 1 &&
        nodes.length === 1 && nodes[0].id === selected_nodes[0].id;

    select_nodes(keep_selected_nodes ? invert(selected_nodes, nodes) :
            (single_node_and_same ? [] : nodes), false);
};

var invert_both = function(nodes, links)
{
    select_both(invert(selected_nodes, nodes), invert(selected_links, links));
};

var delete_selection = function(main_graph) {
    if (confirm(messages.delete_nodes_links_message(selected_nodes, selected_links))) {
        // FIXME: atomic undo
        main_graph.links__delete(_.map(selected_links, 'id'));
        main_graph.nodes__delete(_.map(selected_nodes, 'id'));
    }
};

var setup_toolbar = function(main_graph, main_graph_view)
{
    var merge_selection = function() {
            main_graph.nodes__merge(selected_nodes_ids());
        },
        link_fan_selection = function() {
            main_graph.nodes__link_fan(selected_nodes_ids());
        },
        merge_btn = $('#btn_merge'),
        delete_btn = $('#btn_delete'),
        link_fan_btn = $('#btn_link_fan'),
        zen_mode_btn = $('#btn_zen_mode'),
        select_shortest_path_bth = $('#btn_select_shortests_path'),
        multiple_node_operations = $('#tool-bar-multiple-node-operations');

    merge_btn.asEventStream('click').onValue(merge_selection);
    delete_btn.asEventStream('click').onValue(function () { delete_selection(main_graph); });
    link_fan_btn.asEventStream('click').onValue(link_fan_selection);
    zen_mode_btn.asEventStream('click').onValue(main_graph_view.zen_mode__toggle);
    select_shortest_path_bth.asEventStream('click').onValue(function () {
        shortest_paths = !shortest_paths;
        select_shortest_path_bth[0].style.borderStyle = shortest_paths ? 'dashed' : 'solid';
        if (shortest_paths) {
            select_shortest_path(selected_nodes, selected_links);
        } else {
            select_normal(selected_nodes, selected_links);
        }
    });

    function show(e, visible) {
        if (visible) {
            e.show();
        } else {
            e.hide();
        }
    }

    // operations requiring 2 or more nodes
    selectionChangedBus.map(function (selection) { return selection.selected_nodes.length > 1; })
        .skipDuplicates()
        .onValue(function (visible) {
            show(multiple_node_operations, visible);
        });

    // operations requiring 1 or more node or link
    selectionChangedBus
        .map(function (selection) {
            return selection.selected_nodes.length + selection.selected_links.length > 0;
         })
        .skipDuplicates()
        .onValue(function (visible) {
            show(delete_btn, visible);
        });

    // operations requiring 1 or more nodes
    selectionChangedBus
        .map(function (selection) { return selection.selected_nodes.length > 0; })
        .skipDuplicates()
        .onValue(function (visible) {
            show(zen_mode_btn, visible);
        });

    main_graph_view.zen_mode_bus
        .onValue(function (zenmode) {
            zen_mode_btn[0].style.borderStyle = zenmode ? 'dashed' : 'solid';
        });
};

var nodes_from_links = function(links) {
    return _.flatten(_.map(links, function (l) { return [l.__src, l.__dst]; }));
};

// initialize
clear();

return {
    class__node: class__node,
    class__link: class__link,
    node_selected: node_selected,
    node_related: node_related,
    link_related: link_related,

    delete_selection: delete_selection,

    // deprecated: need to be removed in favor of non explicit state, i.e. event streams / properties
    selected_nodes: function() { return selected_nodes; },
    related_nodes: function() { return related_nodes; },
    selected_links: function() { return selected_links; },
    related_links: function() { return related_links; },

    // initialization
    setup_toolbar: setup_toolbar,

    // input actions
    clear: clear,
    byVisitors: byVisitors,
    select_nodes: select_nodes,
    invert_nodes: invert_nodes,
    select_link: select_link,
    invert_link: invert_link,
    select_both: select_both,
    invert_both: invert_both,

    // output property
    selection: selection,
};

});
