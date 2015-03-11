define(['jquery', 'view/selection'],
function($,             selection)
{
var rz_core; // circular dependency

function get_rz_core()
{
    if (rz_core === undefined) {
        rz_core = require('rz_core');
    }
    return rz_core;
}

function get_graph_view(element)
{
    var dict = get_rz_core().root_element_id_to_graph_view;

    while (undefined !== element && null !== element && undefined === dict[element.id]) {
        element = element.parentElement;
    }
    return element !== undefined && element !== null ? dict[element.id] : undefined;
}

function install() {
    document.body.onkeydown = function(e) {
        var key = ((e.key && String(e.key))
                   || (e.charCode && String.fromCharCode(e.charCode))
                   || (e.which && String.fromCharCode(e.which))).toLowerCase(),
            handled = false,
            graph_view = get_graph_view(e.target);

        if (e.altKey && e.ctrlKey && 'i' === key) {
            $('#textanalyser').focus();
        }
        if (e.altKey && e.ctrlKey && 'o' === key) {
            search.focus();
        }
        if (e.ctrlKey && 'a' === key && e.target === document.body) {
            selection.update(get_rz_core().main_graph.nodes(), false);
            handled = true;
        }
        if (e.ctrlKey && 'z' === key && e.target.nodeName !== 'INPUT') {
            // TODO: rz_core.main_graph.undo();
        }
        // SVG elements cannot handle any keys directly - pass the key to them in this case
        if (undefined !== graph_view) {
            graph_view.keyboard_handler(e);
        }
        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    };
}
return {
        install: install
       };
}
);