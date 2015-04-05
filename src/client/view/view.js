"use strict"

define(['view/node_info', 'view/link_info', 'view/internal'],
function(view_node_info,   view_link_info,   view_internal) {
return {
    'node_info': view_node_info,
    'link_info': view_link_info,
    'hide': function() {
        view_internal.edit_tab.hide();
    },
};
});
