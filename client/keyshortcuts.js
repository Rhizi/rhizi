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

define(['jquery', 'rz_core', 'view/selection'],
function($, rz_core, selection) {

function get_graph_view(element)
{
    var dict = rz_core.root_element_id_to_graph_view;

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
        if (e.ctrlKey && '9' === key) {
            rz_core.main_graph_view.nodes__user_visible(selection.related_nodes(), true);
            handled = true;
        }
        if (e.ctrlKey && '0' === key) {
            if (!selection.is_empty()) {
                rz_core.main_graph_view.zen_mode__toggle();
            }
            handled = true;
        }
        if (e.altKey && e.ctrlKey && 'o' === key) {
            search.focus();
            handled = true;
        }
        if (e.ctrlKey && 'a' === key && e.target === document.body) {
            selection.select_nodes(rz_core.main_graph.nodes());
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
