/*
    This file is part of rhizi, a collaborative knowledge graph editor.
    Copyright (C) 2014-2015  Rhizi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

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
                                    triggerStart:'|',
                                    triggerEnd:'|',
                                    matchStartOfString: true,
                                    appendOnCompletion:'|',
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
            text_processed = text[text.length - 1] == '|' ? text.slice(0, text.length - 1) : text;

        try {
            r = new RegExp(text_processed, 'i');
        } catch (e) {
            return; // don't clear selection either
        }
        if (text_processed.length > 0) {
            selection.byVisitors(selector, selector);
        } else {
            selection.clear();
        }
        rz_core.main_graph_view.zen_mode__set(true);
        rz_core.update_view__graph(false);
    };

}

function clear() {
    search.val('');
}

return {
    focus: focus,
    init: init,
    clear: clear,
};
}
);
