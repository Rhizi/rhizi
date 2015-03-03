define(['Bacon_wrapper', 'jquery', 'underscore'],
function(Bacon,           $,        _) {

var rz_core; // circular dependency, see get_rz_core

function list_from_list_like(list_like)
{
    var list = [],
        i;

    for (i = 0 ; i < list_like.length ; ++i) {
        list.push(list_like[i]);
    }
    return list;
}

function list_call(list, field)
{
    list.forEach(function (item) {
        item[field].apply(item, list_from_list_like(arguments).slice(2));
    });
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

var root_nodes = [], // these are the nodes that are requested via update
    selected_nodes = [],      // these are the nodes that are highlighted, generally the neighbours of selection_request
    selected_nodes__by_id = {},
    root_nodes__by_id = {},
    selectionChangedBus = new Bacon.Bus();

function listen_on_diff_bus(diffBus)
{
    diffBus
        .onValue(function (diff) {
            // update due to potentially removed nodes first
            root_nodes = root_nodes.filter(function (n) {
                return get_main_graph().find_node__by_id(n.id) !== null;
            });
            // reselect based on current graph
            inner_update(root_nodes);
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

function updateSelectedNodesBus(new_selected_nodes)
{
    selected_nodes = new_selected_nodes;
    selected_nodes__by_id = nodes_to_id_dict(selected_nodes);
    selectionChangedBus.push(new_selection(selected_nodes, root_nodes));
}

function byVisitors(node_selector, link_selector) {
    var new_selected_nodes = get_main_graph().find__by_visitors(node_selector, link_selector);

    inner_update(new_selected_nodes);
}

function connectedComponent(nodes) {
    var connected = get_main_graph().getConnectedNodesAndLinks(nodes, 1),
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
    nodes.forEach(function (n) { n.state = 'chosen'; });
    selected_nodes = connected.nodes.map(function (d) { return d.node; }).concat(nodes.slice());
    updateSelectedNodesBus(selected_nodes);
}

var node_selected = function(node) {
    return selected_nodes__by_id[node.id] !== undefined;
}

var node_root_selected = function(node) {
    return root_nodes__by_id[node.id] !== undefined;
}

var node_first_selected = function(node) {
    return node.id === root_nodes[0].id;
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

var clear = function() {
    root_nodes = [];
    root_nodes__by_id = {};
    updateSelectedNodesBus([]);
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

var inner_update = function(nodes)
{
    root_nodes = nodes;
    root_nodes__by_id = nodes_to_id_dict(nodes);
    get_main_graph_view().nodes__user_visible(nodes);
    connectedComponent(nodes);
}

var update = function(nodes)
{
    var new_nodes = nodes;
    var not_same = !arr_compare(new_nodes, root_nodes);

    if (not_same) {
        inner_update(new_nodes);
    }
}

var invert = function(nodes)
{
    update(_.union(_.difference(root_nodes, nodes), _.difference(nodes, root_nodes)));
}

var setup_toolbar = function(main_graph)
{
    var merge_root_selection = function() {
            main_graph.nodes__merge(root_nodes_ids());
        },
        delete_root_selection = function() {
            var ids = root_nodes_ids();

            if (confirm('you are deleting ' + ids.length + ' nodes, are you sure?')) {
                main_graph.nodes__delete(ids);
            }
        },
        link_fan_root_selection = function() {
            main_graph.nodes__link_fan(root_nodes_ids());
        },
        merge_btn = $('#btn_merge'),
        delete_btn = $('#btn_delete'),
        link_fan_btn = $('#btn_link_fan'),
        buttons = [merge_btn, delete_btn, link_fan_btn];

    merge_btn.asEventStream('click').onValue(merge_root_selection);
    delete_btn.asEventStream('click').onValue(delete_root_selection);
    link_fan_btn.asEventStream('click').onValue(link_fan_root_selection);

    selectionChangedBus.map(function (selection) { return selection.root_nodes.length > 1; })
        .skipDuplicates()
        .onValue(function (visible) {
            if (visible) {
                list_call(buttons, 'show');
            } else {
                list_call(buttons, 'hide');
                buttons.forEach(function (btn) { btn.hide(); });
            }
        });
}

return {
    byVisitors: byVisitors,
    connectedComponent: connectedComponent,
    clear: clear,
    invert: invert,
    update: update,
    selected_class__node: selected_class__node,
    selected_class__link: selected_class__link,
    node_selected: node_selected,
    link_selected: link_selected,
    selectionChangedBus: selectionChangedBus,
    setup_toolbar: setup_toolbar,

    __get_root_nodes: function() { return root_nodes; },
    __get_selected_nodes: function() { return selected_nodes; },
};

});
