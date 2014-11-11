"use strict"

define(['view/node_info', 'view/edge_info', 'view/internal'],
function(view_node_info,   view_edge_info,   view_internal) {
return {
    'node_info': view_node_info,
    'edge_info': view_edge_info,
    'hide': function() {
        view_internal.edit_tab.hide();
    },
};
});
