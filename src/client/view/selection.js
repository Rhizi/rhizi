define(['Bacon', 'jquery', 'underscore', 'messages', 'util'],
function(Bacon,           $,        _,    messages,   util) {

var rz_core, // circular dependency, see get_rz_core
    selection_count_element = $('#selection-count');

function selected_nodes_ids() {
    return _.pluck(selected_nodes, 'id');
}

function Selection() {
}

function new_selection(selected_nodes, related_nodes)
{
    var ret = new Selection();

    ret.related_nodes = related_nodes;
    ret.selected_nodes = selected_nodes;
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
    related_nodes,  // these are not directly selected but we want to show them to users
    selected_nodes__by_id,
    related_nodes__by_id,
    selectionChangedBus = new Bacon.Bus();

function listen_on_diff_bus(diffBus)
{
    diffBus
        .onValue(function (diff) {
            // update due to potentially removed nodes first
            new_selected_nodes = selected_nodes.filter(function (n) {
                return get_main_graph().find_node__by_id(n.id) !== null;
            });
            new_related_nodes = related_nodes.filter(function (n) {
                return get_main_graph().find_node__by_id(n.id) !== null;
            });
            // reselect based on current graph
            inner_select(new_selected_nodes, new_related_nodes);
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

function updateSelectedNodesBus(new_selected_nodes, new_related_nodes)
{
    if (_.isEqual(selected_nodes, new_selected_nodes) && _.isEqual(related_nodes, new_related_nodes)) {
        return;
    }
    selected_nodes = new_selected_nodes;
    selected_nodes__by_id = nodes_to_id_dict(selected_nodes);
    related_nodes = new_related_nodes;
    related_nodes__by_id = nodes_to_id_dict(related_nodes);
    selection_count_element.text(related_nodes.length > 0 ? '' + selected_nodes.length + ', ' + related_nodes.length : '');
    selectionChangedBus.push(new_selection(selected_nodes, related_nodes));
}

/* add nodes in nodes_b to a copy of nodes_a in order, skipping duplicates */
function sum_nodes(nodes_a, nodes_b)
{
    var set_a_id = _.object(nodes_a.map(function (n) { return [n.id, 1]; })),
        ret = nodes_a.slice(0);

    for (var k in nodes_b) {
        if (set_a_id[nodes_b[k].id] === undefined) {
            ret.push(nodes_b[k]);
        }
    }
    return ret;
}

function links_to_nodes(links)
{
    return _.flatten(_.map(links, function (link) { return [link.__src, link.__dst]; }));
}

function byVisitors(node_selector, link_selector) {
    var new_selection = get_main_graph().find__by_visitors(node_selector, link_selector);

    inner_select_nodes(sum_nodes(new_selection.nodes, links_to_nodes(new_selection.links)));
}

function _type_to_state(type) {
    switch (type) {
    case 'exit':
        return 'exit';
        break;
    case 'enter':
        return 'enter';
        break;
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
    nodes.forEach(function (n) { n.state = 'selected'; });
    return connected.nodes.map(function (d) { return d.node; }).concat(nodes.slice());
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
    return related_nodes__by_id[node.id] !== undefined;
}

var node_selected = function(node) {
    return selected_nodes__by_id[node.id] !== undefined;
}

var node_first_selected = function(node) {
    return selected_nodes && selected_nodes.length > 0 && node.id === selected_nodes[0].id;
}

var link_related = function(link) {
    return node_related(link.__src) && node_related(link.__dst);
}

var class__node = function(node, temporary) {
    return (!temporary && (related_nodes.length > 0 || selected_nodes.length > 0)) ?
        (node_first_selected(node) ? 'first-selected' :
            (node_selected(node) ? 'selected' :
                (node_related(node) ? "related" : "notselected"))) : "";
}

var class__link = function(link, temporary) {
    return !temporary && related_nodes.length > 0 ? (link_related(link) ? "selected" : "notselected") : "";
}

var clear = function()
{
    updateSelectedNodesBus([], []);
}

function arr_compare(a1, a2)
{
    if (a1.length != a2.length) {
        return false;
    }
    for (var i = 0 ; i < a1.length ; ++i) {
        if (a1[i] != a2[i]) {
            return false;
        }
    }
    return true;
}

var inner_select_nodes = function(nodes)
{
    inner_select(nodes, nodes.length == 1 ? neighbours(nodes) : mutual_neighbours(nodes));
}

var select_nodes = function(nodes)
{
    var new_nodes = nodes;
    var not_same = !arr_compare(new_nodes, selected_nodes);

    if (not_same) {
        inner_select_nodes(new_nodes);
    }
}

var inner_select = function(new_selected_nodes, new_related_nodes)
{
    if (arr_compare(new_selected_nodes, selected_nodes) && arr_compare(new_related_nodes, related_nodes)) {
        // no change
        return;
    }
    updateSelectedNodesBus(new_selected_nodes, new_related_nodes);
}

function nodes_from_link(link)
{
    return [link.__src, link.__dst];
}

var select_link = function(link)
{
    var new_selected_nodes = nodes_from_link(link);

    inner_select(new_selected_nodes, new_selected_nodes);
}

function invert(initial, inverted)
{
    return _.union(_.difference(initial, inverted), _.difference(inverted, initial));
}

var invert_link = function(link)
{
    var link_nodes = nodes_from_link(link),
        new_selected_nodes = invert(selected_nodes, link_nodes),
        new_related_nodes = invert(related_nodes, link_nodes);

    inner_select(new_selected_nodes, new_related_nodes);
}

var invert_nodes = function(nodes)
{
    select_nodes(invert(selected_nodes, nodes));
}

var setup_toolbar = function(main_graph, main_graph_view)
{
    var merge_selection = function() {
            main_graph.nodes__merge(selected_nodes_ids());
        },
        delete_selection = function() {
            var ids = selected_nodes_ids();

            if (confirm(messages.delete_nodes_message(ids.length))) {
                main_graph.nodes__delete(ids);
            }
        },
        link_fan_selection = function() {
            main_graph.nodes__link_fan(selected_nodes_ids());
        },
        merge_btn = $('#btn_merge'),
        delete_btn = $('#btn_delete'),
        link_fan_btn = $('#btn_link_fan'),
        zen_mode_btn = $('#btn_zen_mode'),
        multiple_node_operations = $('#tool-bar-multiple-node-operations');

    merge_btn.asEventStream('click').onValue(merge_selection);
    delete_btn.asEventStream('click').onValue(delete_selection);
    link_fan_btn.asEventStream('click').onValue(link_fan_selection);

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

    // operations requiring 1 or more nodes
    selectionChangedBus.map(function (selection) { return selection.selected_nodes.length > 0; })
        .skipDuplicates()
        .onValue(function (visible) {
            show(zen_mode_btn, visible);
            show(delete_btn, visible);
        });

    zen_mode_btn.asEventStream('click').onValue(main_graph_view.zen_mode__toggle);
}

var is_empty = function() {
    return selected_nodes && selected_nodes.length == 0;
}

// initialize
clear();

return {
    byVisitors: byVisitors,
    is_empty: is_empty,
    clear: clear,
    select_nodes: select_nodes,
    invert_nodes: invert_nodes,
    select_link: select_link,
    invert_link: invert_link,
    class__node: class__node,
    class__link: class__link,
    node_selected: node_selected,
    node_related: node_related,
    link_related: link_related,
    selectionChangedBus: selectionChangedBus,
    setup_toolbar: setup_toolbar,

    selected_nodes: function() { return selected_nodes; },
    related_nodes: function() { return related_nodes; },
};

});
