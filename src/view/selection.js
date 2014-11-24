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

var selection = false;

function byVisitors(node_selector, link_selector) {
    selection = true;
    var selected_nodes = get_rz_core().graph.findByVisitors(node_selector, link_selector);

    clear();
    connectedComponent(selected_nodes);
}

function connectedComponent(nodes) {
    var nodes,
        connected = get_rz_core().graph.getConnectedNodesAndLinks(nodes, 1),
        i,
        node,
        link,
        data;

    selection = true;
    nodes.forEach(function (n) { n.state = 'chosen'; });

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
}

var node_selected = function(node) {
    return node.state == 'chosen' || node.state == 'enter' || node.state == 'exit' || node.state == 'selected';
}

var selected_class = function(node) {
    return selection ? (node_selected(node) ? "selected" : "notselected") : "";
}

var clear = function() {
    selection = false;
    get_rz_core().graph.setRegularState();
}

return {
    'byVisitors': byVisitors,
    'connectedComponent': connectedComponent,
    'clear': clear,
    'selected_class': selected_class,
};

});
