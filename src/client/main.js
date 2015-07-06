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

/**
 * [!] order must match function args order
 */
define([
        'buttons',
        'devtools',
        'drag_n_drop',
        'feedback',
        'history',
        'keyshortcuts',
        'model/core',
        'robot',
        'rz_core',
        'textanalysis',
        'textanalysis.ui',
        'util',
        'view/filter_menu',
        'view/search',
        'view/selection',
        'view/filter',
        ],

/**
 * [!] order must match define element order
 */
function(
         buttons,
         devtools,
         drag_n_drop,
         feedback,
         history,
         keyshortcuts,
         model_core,
         robot,
         rz_core,
         textanalysis,
         textanalysis_ui,
         util,
         filter_menu,
         search,
         selection,
         view_filter
         ) {

    function fix_feedback_scrolling_to_visibility_causing_topbar_to_slide_slowly_in_webkit() {
        $('.feedback-btn').attr('tabindex', -1);
    }

    function expand(obj){
        if (!obj.savesize) {
            obj.savesize = obj.size;
        }
        obj.size = Math.max(obj.savesize, obj.value.length);
    }

    this.main = function() {
        var json;

        console.log('Rhizi main started');
        $('#editname').onkeyup = function() { expand(this); };
        $('#editlinkname').onkeyup = function() { expand(this); };
        $('#textanalyser').onkeyup = function() { expand(this); };

        textanalysis_ui.main();

        json = util.getParameterByName('json');
        if (json) {
            rz_core.load_from_json(json);
        }
        keyshortcuts.install();

        var intro_task_elem = $('#intro-task');
        // TODO: messages (why tasks?) - this one is special but we want them to be handled in their own file.
        if (false && !localStorage.intro_task_hide) {
            intro_task_elem.show();
        }
        $('#intro-task .task-close-button').click(function(e) {
            localStorage.intro_task_hide = true;
            intro_task_elem.hide();
        });

        // TODO: interaction between the hack above and this
        view_filter.init();
        model_core.init(rz_config);
        rz_core.init();
        textanalysis.init(rz_core.main_graph);
        search.init();
        filter_menu.init();
        selection.setup_toolbar(rz_core.main_graph, rz_core.main_graph_view);
        $.feedback({ajaxURL: rz_config.feedback_url});
        fix_feedback_scrolling_to_visibility_causing_topbar_to_slide_slowly_in_webkit();

        // setup debug
        if (util.getParameterByName('debug')) {
            $('#devtools').show();
            rz_core.edit_graph.set_user('fakeuser');
            rz_core.main_graph.set_user('fakeuser');
            drag_n_drop.init();
        } else {
            // drag and drop prevented in normal operation (debug not set)
            drag_n_drop.prevent_default_drop_behavior();
        }
    }

    return {
        main: main };
    }
);
