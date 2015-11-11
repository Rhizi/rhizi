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

define(['jquery', 'rz_core', 'view/selection', 'view/cmd_bar'],
function ($,       rz_core,        selection,   view__cmd_bar) {
$('.tutorial').click(function(){});

var key="#47989379";

var logout_button = $('#top-bar__logout-btn');
logout_button.click(function() {
    $.ajax({
        type: "POST",
        url: '/logout',
        success: function () {
            document.location = "/login";
        },
        error: function () {
            console.log("failed to logout");
            document.location = "/login";
        },
    }); // server should redirect back to /login
});

$('a.save-history').click(function () {
    if (rz_core.main_graph.history === undefined) {
        throw "History is undefined";
    }
    rz_core.main_graph.history.save_to_file();
});

$('#menu-bar__rzdoc-open').click(function() {

    var cmd_bar;

    cmd_bar = $('#cmd-bar__rzdoc-search');
    if (cmd_bar.length > 0) { // cmd bar present
        cmd_bar.remove();
        return;
    }

    rz_core.rzdoc__search(''); // this should match all existing documents
});

$('#menu-bar__rzdoc-new').click(function() {

    var cmd_bar,
        cmd_bar_body,
        e_input,
        submit_btn;

    cmd_bar = $('#cmd-bar__rzdoc-new');
    if (cmd_bar.length > 0) { // cmd bar present
        cmd_bar.remove();
        return;
    }

    cmd_bar = view__cmd_bar.new_cmdbar("rzdoc-new");

    cmd_bar_body = $('<div>')
    submit_btn = $('<span class="cmd-bar_btn" id="cmd_bar__rzdoc_new__submit">Create</span>');
    e_input = $('<input id="cmd_bar__rzdoc_new__input">');
    e_input.attr('placeholder', 'Rhizi Title');
    cmd_bar_body.append(e_input);
    cmd_bar_body.append(submit_btn);

    cmd_bar.append_to_body(cmd_bar_body);

    // submit
    submit_btn.attr('tabindex', 1); // assume focus on next tab key press
    submit_btn.on('click', function() {
        var rzdoc_name = $('#cmd_bar__rzdoc_new__input').val();
        rz_core.rzdoc__create_and_open(rzdoc_name);
        cmd_bar.hide();
        cmd_bar.remove();
    });
    cmd_bar_body.on('keyup', function(event) { // create on Enter key pressed
        if(event.keyCode == 13) {
            submit_btn.click();
        }
    });

    cmd_bar.insert();
    cmd_bar.show();
});

$('#menu-bar__rzdoc-search').on('keypress', function(e) {

    var search_query;

    if (13 != e.keyCode) {
        return true;
    }

    search_query = $('#menu-bar__rzdoc-search__input').val();
    rz_core.rzdoc__search(search_query);
});

function log_scale(max_in, min_out, max_out) {
    var t = (min_out * max_out - 1) / (min_out + max_out - 2),
        k = 1 / max_in * Math.log((max_out - t) / (1 - t));

    return function (x) { return (1 - t) * Math.exp(x * k) + t; };
}

function exp_scale(max_in, min_out, max_out) {
    var t = (min_out * max_out - 1) / (min_out + max_out - 2),
        k = 1 / max_in * Math.log((max_out - t) / (1 - t));

    return function (y) { return (1 / k) * Math.log((y - t) / (1 - t)); };
}

function clip(min, max, v) {
    return Math.max(min, Math.min(max, v));
}

var zoom_range = 10,
    zoom_min = 0.1,
    zoom_max = 3,
    zoom_exp_to_linear = exp_scale(zoom_range, zoom_min, zoom_max);

$('#btn_zoom_in').asEventStream('click')
    .map(1)
    .merge($('#btn_zoom_out').asEventStream('click').map(-1))
    .map(function (change) {
        return clip(-zoom_range, zoom_range, zoom_exp_to_linear(rz_core.main_graph_view.zoom_obj.scale()) + change);
    })
    .map(log_scale(zoom_range, zoom_min, zoom_max))
    .onValue(function (val) {
        rz_core.main_graph_view.scale__absolute(val);
    });

$('#btn_zoom_to_selection').asEventStream('click')
    .map(selection.related_nodes)
    .onValue(function (selected) {
        rz_core.main_graph_view.nodes__user_visible(selected, true);
    });

return {'buttons': 'nothing here'};
}); // define
