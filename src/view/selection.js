define(['rz_core'],
function(rz_core) {

function get_rz_core()
{
    // circular dependency on rz_core, so require.js cannot solve it.
    if (rz_core === undefined) {
        rz_core = require('rz_core');
    }
    return rz_core;
}

var selected_nodes = [];

function byVisitors(node_selector, link_selector) {
    var new_selected_nodes = get_rz_core().graph.findByVisitors(node_selector, link_selector);

    clear();
    connectedComponent(new_selected_nodes);
}

function connectedComponent(nodes) {
    var connected = get_rz_core().graph.getConnectedNodesAndLinks(nodes, 1),
        i,
        node,
        link,
        data;

    selected_nodes = nodes.map(function(x) { return x; });

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
           || node.state == 'temp';
}

var selected_class = function(node) {
    return selected_nodes.length > 0 ? (node_selected(node) ? "selected" : "notselected") : "";
}

var clear = function() {
    selected_nodes.length = 0;
    get_rz_core().graph.setRegularState();
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
};

});
