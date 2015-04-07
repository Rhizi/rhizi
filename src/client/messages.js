define( ['util', 'model/graph'],
function (util,         graph) {



function delete_items_message(items) {
    util.assert(items && items.length && items.length > 0);

    return delete_items_message_helper(graph.is_node(items[0]) ? 'node' : 'link', items.length);
}

function delete_nodes_message(count) {
    return delete_items_message_helper('node', count);
}

function delete_items_message_helper(type, count) {
    var descriptor = count > 1 ? '' + count + ' ' + type + 's' : 'a ' + type;

    return 'You are about to delete ' + descriptor + ', are you sure you want to do that?' ;
}

return {
    delete_items_message: delete_items_message,
    delete_nodes_message: delete_nodes_message,
};
});
