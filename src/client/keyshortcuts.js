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

function install() {
    document.body.onkeydown = function(e) {
        var key = ((e.key && String(e.key))
                   || (e.charCode && String.fromCharCode(e.charCode))
                   || (e.which && String.fromCharCode(e.which))).toLowerCase();

        if (e.altKey && e.ctrlKey && 'i' === key) {
            $('#textanalyser').focus();
        }
        if (e.altKey && e.ctrlKey && 'o' === key) {
            search.focus();
        }
        if (e.ctrlKey && 'a' === key && e.target === document.body) {
            selection.update(get_rz_core().main_graph.nodes(), false);
            e.preventDefault();
            e.stopPropagation();
        }
        if (e.ctrlKey && 'z' === key && e.target.nodeName !== 'INPUT') {
            // TODO: rz_core.main_graph.undo();
        }
    };
}
return {
        install: install
       };
}
);
