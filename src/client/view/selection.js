define(['Bacon', 'jquery', 'underscore', 'messages'],
function(Bacon,           $,        _,    messages) {

var rz_core, // circular dependency, see get_rz_core
    selection_count_element = $('#selection-count');

function list_from_list_like(list_like)
{
    var list = [],
        i;

    for (i = 0 ; i < list_like.length ; ++i) {
        list.push(list_like[i]);
    }
    return list;
}

function root_nodes_ids() {
    return _.pluck(root_nodes, 'id');
}

function Selection() {
}

function new_selection(nodes, root_nodes)
{
    var ret = new Selection();

    ret.nodes = nodes;
    ret.root_nodes = root_nodes;
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

var root_nodes, // these are the nodes that are requested via update
    selected_nodes,      // these are the nodes that are highlighted, generally the neighbours of selection_request
    selected_nodes__by_id,
    root_nodes__by_id,
    selectionChangedBus = new Bacon.Bus();

function listen_on_diff_bus(diffBus)
{
    diffBus
        .onValue(function (diff) {
            // update due to potentially removed nodes first
            new_root_nodes = root_nodes.filter(function (n) {
                return get_main_graph().find_node__by_id(n.id) !== null;
            });
            new_selected_nodes = selected_nodes.filter(function (n) {
                return get_main_graph().find_node__by_id(n.id) !== null;
            });
            // reselect based on current graph
            inner_select(new_root_nodes, new_selected_nodes);
        });
}

function sortedArrayDiff(a, b, a_cmp_b)
{
    var a_i = 0,
        b_i = 0,
        ret = [];

    while (a_i < a.length && b_i < b.length) {
        while (a_i < a.length && a_cmp_b(a[a_i], b[b_i]) == -1) {
            ret.push(a[a_i]);
            a_i += 1;
        }
        while (b_i < b.length && a_i < a.length && a_cmp_b(a[a_i], b[b_i]) == 0) {
            b_i += 1;
            a_i += 1;
        }
        while (b_i < b.length && a_i < a.length && a_cmp_b(a[a_i], b[b_i]) == 1) {
            b_i += 1;
        }
    }
    for (; a_i < a.length ; ++a_i) {
        ret.push(a[a_i]);
    }
    return ret;
}

function nodes_to_id_dict(nodes)
{
    return nodes.reduce(
            function(d, v) {
                d[v.id] = v;
                return d;
            }, {});
}

function updateSelectedNodesBus(nodes, new_selected_nodes)
{
    if (_.isEqual(root_nodes, nodes) && _.isEqual(selected_nodes, new_selected_nodes)) {
        return;
    }
    root_nodes = nodes;
    root_nodes__by_id = nodes_to_id_dict(nodes);
    selected_nodes = new_selected_nodes;
    selected_nodes__by_id = nodes_to_id_dict(selected_nodes);
    selection_count_element.text(selected_nodes.length > 0 ? '' + nodes.length + ', ' + selected_nodes.length : '');
    selectionChangedBus.push(new_selection(selected_nodes, root_nodes));
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

function connectedComponent(nodes) {
    var connected = get_main_graph().neighbourhood(nodes, 1),
        i,
        node,
        link,
        data;

    for (i = 0 ; i < connected.nodes.length ; ++i) {
        data = connected.nodes[i];
        node = data.node;
        switch (data.type) {
        case 'exit':
            node.state = 'exit';
            break;
        case 'enter':
            node.state = 'enter';
            break;
        };
    }
    for (i = 0 ; i < connected.links.length ; ++i) {
        data = connected.links[i];
        link = data.link;
        switch (data.type) {
        case 'exit':
            link.state = 'exit';
            break;
        case 'enter':
            link.state = 'enter';
            break;
        };
    }
    // XXX side effect, should not be here
    nodes.forEach(function (n) { n.state = 'chosen'; });
    return connected.nodes.map(function (d) { return d.node; }).concat(nodes.slice());
}

var node_selected = function(node) {
    return selected_nodes__by_id[node.id] !== undefined;
}

var node_root_selected = function(node) {
    return root_nodes__by_id[node.id] !== undefined;
}

var node_first_selected = function(node) {
    return root_nodes && root_nodes.length > 0 && node.id === root_nodes[0].id;
}

var link_selected = function(link) {
    return node_selected(link.__src) && node_selected(link.__dst);
}

var selected_class__node = function(node, temporary) {
    return !temporary && selected_nodes.length > 0 ?
        (node_first_selected(node) ? 'first-selected' :
            (node_root_selected(node) ? 'root-selected' :
                (node_selected(node) ? "selected" : "notselected"))) : "";
}

var selected_class__link = function(link, temporary) {
    return !temporary && selected_nodes.length > 0 ? (link_selected(link) ? "selected" : "notselected") : "";
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
    inner_select(nodes, connectedComponent(nodes));
}

var select_nodes = function(nodes)
{
    var new_nodes = nodes;
    var not_same = !arr_compare(new_nodes, root_nodes);

    if (not_same) {
        inner_select_nodes(new_nodes);
    }
}

var inner_select = function(new_root_nodes, new_selected_nodes)
{
    if (arr_compare(new_root_nodes, root_nodes) && arr_compare(new_selected_nodes, selected_nodes)) {
        // no change
        return;
    }
    updateSelectedNodesBus(new_root_nodes, new_selected_nodes);
}

function nodes_from_link(link)
{
    return [link.__src, link.__dst];
}

var select_link = function(link)
{
    var new_root_nodes = nodes_from_link(link);

    inner_select(new_root_nodes, new_root_nodes);
}

function invert(initial, inverted)
{
    return _.union(_.difference(initial, inverted), _.difference(inverted, initial));
}

var invert_link = function(link)
{
    var link_nodes = nodes_from_link(link),
        new_root_nodes = invert(root_nodes, link_nodes),
        new_selected_nodes = invert(selected_nodes, link_nodes);

    inner_select(new_root_nodes, new_selected_nodes);
}

var invert_nodes = function(nodes)
{
    select_nodes(invert(root_nodes, nodes));
}

var setup_toolbar = function(main_graph)
{
    var merge_root_selection = function() {
            main_graph.nodes__merge(root_nodes_ids());
        },
        delete_root_selection = function() {
            var ids = root_nodes_ids();

            if (confirm(messages.delete_nodes_message(ids.length))) {
                main_graph.nodes__delete(ids);
            }
        },
        link_fan_root_selection = function() {
            main_graph.nodes__link_fan(root_nodes_ids());
        },
        merge_btn = $('#btn_merge'),
        delete_btn = $('#btn_delete'),
        link_fan_btn = $('#btn_link_fan'),
        multiple_node_operations = $('#tool-bar-multiple-node-operations');

    merge_btn.asEventStream('click').onValue(merge_root_selection);
    delete_btn.asEventStream('click').onValue(delete_root_selection);
    link_fan_btn.asEventStream('click').onValue(link_fan_root_selection);

    selectionChangedBus.map(function (selection) { return selection.root_nodes.length > 1; })
        .skipDuplicates()
        .onValue(function (visible) {
            if (visible) {
                multiple_node_operations.show();
            } else {
                multiple_node_operations.hide();
            }
        });
}

var is_empty = function() {
    return root_nodes.length == 0;
}

// initialize
clear();

return {
    byVisitors: byVisitors,
    connectedComponent: connectedComponent,
    is_empty: is_empty,
    clear: clear,
    select_nodes: select_nodes,
    invert_nodes: invert_nodes,
    select_link: select_link,
    invert_link: invert_link,
    selected_class__node: selected_class__node,
    selected_class__link: selected_class__link,
    node_selected: node_selected,
    link_selected: link_selected,
    selectionChangedBus: selectionChangedBus,
    setup_toolbar: setup_toolbar,

    root_nodes: function() { return root_nodes; },
    selected_nodes: function() { return selected_nodes; },
};

});
