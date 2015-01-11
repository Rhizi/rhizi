define(['rz_core', 'Bacon'],
function(rz_core,   Bacon) {

function get_rz_core()
{
    // circular dependency on rz_core, so require.js cannot solve it.
    if (rz_core === undefined) {
        rz_core = require('rz_core');
        listen_on_diff_bus(rz_core.main_graph.diffBus);
    }
    return rz_core;
}

var root_nodes = [], // these are the nodes that are requested via update
    selected_nodes = [],      // these are the nodes that are highlighted, generally the neighbours of selection_request
    selected_nodes__by_id = {},
    selectionChangedBus = new Bacon.Bus();

function listen_on_diff_bus(diffBus)
{
    diffBus
        .filter(".node_id_set_rm")
        .onValue(function (diff) {
            var node_node_cmp = (function (a, b) { return a.id > b.id; }),
                node_id_cmp = (function (a, b) { return a.id === b ? 0 : (a.id > b ? 1 : -1); });

            updateSelectedNodesBus(sortedArrayDiff(selected_nodes.sort(node_node_cmp),
                                             diff.node_id_set_rm.sort(), node_id_cmp));
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
        while (b_i < b.length && a_cmp_b(a[a_i], b[b_i]) == 1) {
            b_i += 1;
        }
    }
    for (; a_i < a.length ; ++a_i) {
        ret.push(a[a_i]);
    }
    return ret;
}

function updateSelectedNodesBus(new_selected_nodes)
{
    selected_nodes = new_selected_nodes;
    selected_nodes__by_id = selected_nodes.reduce(
        function(d, v) {
            d[v.id] = v;
            return d;
        }, {});
    selectionChangedBus.push(selected_nodes);
}

function byVisitors(node_selector, link_selector) {
    var new_selected_nodes = get_rz_core().main_graph.find__by_visitors(node_selector, link_selector);

    clear();
    connectedComponent(new_selected_nodes);
}

function connectedComponent(nodes) {
    var connected = get_rz_core().main_graph.getConnectedNodesAndLinks(nodes, 1),
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

var selected_class__node = function(node) {
    return selected_nodes.length > 0 ? (node_selected(node) ? "selected" : "notselected") : "";
}

var selected_class__link = function(link) {
    return selected_nodes.length > 0 ? (node_selected(link.__src) && node_selected(link.__dst) ?
        "selected" : "notselected") : "";
}

var clear = function() {
    root_nodes = [];
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

var update = function(nodes) {
    var set = !arr_compare(nodes, root_nodes);
    clear();
    if (set) {
        root_nodes = nodes;
        connectedComponent(nodes);
    }
}

return {
    byVisitors: byVisitors,
    connectedComponent: connectedComponent,
    clear: clear,
    update: update,
    selected_class__node: selected_class__node,
    selected_class__link: selected_class__link,
    node_selected: node_selected,
    selectionChangedBus: selectionChangedBus,
    __get_root_nodes: function() { return root_nodes; },
    __get_selected_nodes: function() { return selected_nodes; },
};

});
