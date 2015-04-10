define(['consts', 'view/completer', 'textanalysis', 'rz_core', 'view/selection'],
function(consts,        completer,   textanalysis,   rz_core,        selection)
{
var search = $('#search'),
    search_btn = $('#btn_search'),
    search_completer_element = $('#search-suggestion'),
    search_completer;

var focus = function() {
    search.focus();
}

function init() {
    search_completer = completer(search, search_completer_element,
                                 {
                                    triggerStart:' |',
                                    triggerEnd:' |',
                                    matchStartOfString: true,
                                 });

    search_completer.options.plug(textanalysis.suggestions_options.map('.nodes'));
    search.asEventStream('keydown').filter(
            function(e) {
            if (e.which === consts.VK_ENTER && search_completer.handleEnter()) {
                e.preventDefault();
            }
            return (e.which === consts.VK_ENTER);
        })
        .merge($('#btn_search').asEventStream('click'))
        .merge(search_completer.completionsBus)
        .map(function () { return search[0].value.trim(); })
        .skipDuplicates()
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
