define(['view/tab'],
function(tab) {

var EDGE_INFO_SELECTOR = '.edge_info',
    NODE_INFO_SELECTOR = '.info',
    edit_tab = new tab.Tab({edge: EDGE_INFO_SELECTOR, node: NODE_INFO_SELECTOR});

return {
    EDGE_INFO_SELECTOR: EDGE_INFO_SELECTOR,
    NODE_INFO_SELECTOR: NODE_INFO_SELECTOR,
    edit_tab: edit_tab,
};

});
