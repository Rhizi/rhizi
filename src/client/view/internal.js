define(['view/tab'],
function(tab) {

var LINK_INFO_SELECTOR = '#link_info',
    NODE_INFO_SELECTOR = '#info',
    edit_tab = new tab.Tab({edge: LINK_INFO_SELECTOR, node: NODE_INFO_SELECTOR});

return {
    LINK_INFO_SELECTOR: LINK_INFO_SELECTOR,
    NODE_INFO_SELECTOR: NODE_INFO_SELECTOR,
    edit_tab: edit_tab,
};

});
