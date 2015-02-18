define(['view/completer', 'textanalysis', 'rz_core', 'view/selection'],
function(     completer,   textanalysis,   rz_core,        selection)
{
var search,
    search_completer;

var focus = function() {
    search.focus();
}

function init() {
    search = $('#search');
    search_completer = completer(search, $('#search-suggestion'),
                                 {
                                    triggerStart:' |',
                                    triggerEnd:' |',
                                    matchStartOfString: true,
                                 });

    search_completer.options.plug(textanalysis.suggestions_options);
    search.on('input', search_on_submit);
    search.on('keydown', function(e) {
        if (e.which == 13 && !search_completer.handleEnter()) {
            e.preventDefault();
            search_on_submit(e);
            return false;
        }
        return true;
    });

    function search_on_submit() {
        var text = search[0].value.trim(),
            r;

        try {
            r = new RegExp(text.replace(/ /, '|'), 'i');
        } catch (e) {
            return; // don't clear selection either
        }
        if (text.length > 0) {
            selection.byVisitors(function (n) { return n.name.match(r); });
        } else {
            selection.clear();
        }
        rz_core.update_view__graph(false);
    };

}



return {
    focus: focus,
    init: init,
};
}
);
