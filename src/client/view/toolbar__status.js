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

"use strict"

/**
 * Manage backend websocket connection
 */
define(['jquery'],
function($) {

    var close_btn,
        toolbar__status;

    function toolbar__status() {

        close_btn = $('<div>x</div>');
        close_btn.addClass('toolbar__close_btn');

        toolbar__status = $('#status-bar');
        toolbar__status.append(close_btn);
    }

    /**
     * display given HTML fragment as status line body
     */
    function display_html_frag(toolbar__status_body) {
        toolbar__status.children().remove();

        toolbar__status.append(close_btn);
        toolbar__status.append(toolbar__status_body);
        toolbar__status_body.addClass('status-bar__body');

        close_btn.click(function() {
            toolbar__status.hide();
        });

        toolbar__status.show();
    }

    toolbar__status();

    return {
        display_html_frag : display_html_frag,
        hide: function () {
            toolbar__status.hide();
        }
    };

});
