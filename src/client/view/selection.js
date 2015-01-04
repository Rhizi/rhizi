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

var selected_nodes = [],
    selectionChangedBus = new Bacon.Bus();

function listen_on_diff_bus(diffBus)
{
    diffBus
        .filter(".node_set_rm")
        .onValue(function (diff) {
            var node_node_cmp = (function (a, b) { return a.id > b.id; }),
                node_id_cmp = (function (a, b) { return a.id === b ? 0 : (a.id > b ? 1 : -1); });

            updateSelectedNodesBus(sortedArrayDiff(selected_nodes.sort(node_node_cmp),
                                             diff.node_set_rm.sort(), node_id_cmp));
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
    selectionChangedBus.push(selected_nodes);
}

function byVisitors(node_selector, link_selector) {
    var new_selected_nodes = get_rz_core().main_graph.findByVisitors(node_selector, link_selector);

    clear();
    connectedComponent(new_selected_nodes);
}

function connectedComponent(nodes) {
    var connected = get_rz_core().main_graph.getConnectedNodesAndLinks(nodes, 1),
        i,
        node,
        link,
        data;

    updateSelectedNodesBus(nodes.map(function(x) { return x; }));

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
}

var node_selected = function(node) {
    return node.state == 'chosen' || node.state == 'enter' || node.state == 'exit' || node.state == 'selected'
           || node.state == 'temp' || node.state == 'related';
}

var selected_class = function(node) {
    return selected_nodes.length > 0 ? (node_selected(node) ? "selected" : "notselected") : "";
}

var clear = function() {
    selected_nodes.length = 0;
    get_rz_core().main_graph.setRegularState();
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
    var set = !arr_compare(nodes, selected_nodes);
    clear();
    if (set) {
        connectedComponent(nodes);
    }
}

return {
    byVisitors: byVisitors,
    connectedComponent: connectedComponent,
    clear: clear,
    update: update,
    selected_class: selected_class,
    node_selected: node_selected,
    selectionChangedBus: selectionChangedBus,
};

});
