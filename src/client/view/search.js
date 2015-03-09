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

    search_completer.options.plug(textanalysis.suggestions_options.map('.nodes'));
    search.asEventStream('input')
        .merge(search.asEventStream('keydown').filter(
            function(e) {
            if (e.which == 13 && !search_completer.handleEnter()) {
                e.preventDefault();
                return false;
            }
            return true;
        }))
        .map(function () { return search[0].value.trim(); })
        .skipDuplicates()
        .debounce(300)
        .onValue(search_on_submit);

    function attribute_match(obj, regexp) {
        var v, k;

        for (k in obj) {
            if (obj.hasOwnProperty(k)) {
                v = obj[k];
                if ("string" === typeof(v) && v.match(regexp)) {
                    return true;
                }
            }
        }
        return false;
    }

    function search_on_submit(text) {
        var r,
            selector = function (obj) { return attribute_match(obj, r); };

        try {
            r = new RegExp(text.replace(/ /, '|'), 'i');
        } catch (e) {
            return; // don't clear selection either
        }
        if (text.length > 0) {
            selection.byVisitors(selector, selector);
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
