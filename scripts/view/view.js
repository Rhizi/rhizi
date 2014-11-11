define(['view/node_info', 'view/internal'],
function(view_node_info,   view_internal) {
return {
    'node_info': view_node_info,
    'hide': view_internal.edit_tab.hide,
};
});
