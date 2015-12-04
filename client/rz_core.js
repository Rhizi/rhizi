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

"use strict";

define(['jquery', 'd3', 'consts', 'rz_bus', 'util', 'model/graph', 'model/core', 'view/item_info', 'rz_observer',
        'view/selection', 'rz_mesh', 'model/diff', "view/graph_view", 'view/svg_input', 'view/filter_menu',
        'view/activity', 'rz_api_backend', 'local_backend', 'view/toolbar__status'],
function($,        d3,   consts,   rz_bus,   util,   model_graph,   model_core,        item_info,   rz_observer,
         selection,        rz_mesh,   model_diff,   graph_view,       svg_input,              filter_menu,
         activity,        rz_api_backend,   local_backend,        toolbar__status) {

// fix circular module dependency
var search;
function get_search()
{
    if (search === undefined) {
        search = require('view/search');
    }
    return search;
}

var addednodes = [],
    vis,
    graphinterval = 0,
    timeline_timer = 0,
    deliverables = [],
    circle, // <-- should not be module globals.
    scrollValue = 0,
    edit_graph,
    main_graph,
    main_graph_view,
    edit_graph_view,
    root_element_id_to_graph_view,
    backend = rz_config.backend_enabled ? rz_api_backend : local_backend;


var zoomProgress = false,
    zoomBus = new Bacon.Bus(),
    zoom_property = zoomBus.toProperty(zoomProgress),
    svgInput;

function updateZoomProgress(val)
{
    zoomProgress = val;
    zoomBus.push(val);
}

function svg_click_handler(e) {
    if (zoomProgress) {
        updateZoomProgress(false);
        return;
    }
    if (e.originalEvent.target.nodeName != 'svg') {
        return;
    }
    svgInput.hide();
    selection.clear();
    item_info.hide(false);
    filter_menu.hide();
    main_graph_view.zen_mode__cancel();
    main_graph_view.hide_layout_menu();
    update_view__graph(false);
}

function recenterZoom() {
    vis.attr("transform", "translate(0,0)scale(1)");
}

function init_graphs() {
    var user_id = $('#user_id'),
        user = user_id.text();

    main_graph = new model_graph.Graph({temporary: false, base: null, backend: 'rhizi'});
    edit_graph = new model_graph.Graph({temporary: true, base: main_graph});

    if (user_id.length > 0) {
        console.log('found user ID: \'' + user + '\'');
        main_graph.set_user(user);
        edit_graph.set_user(user);
    }
    activity.incomingActivityBus.plug(main_graph.activityBus);
}

var init_graph_views = function () {

    function zoom() {
        zoom_g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        d3.event.sourceEvent != null && d3.event.sourceEvent.stopPropagation();
        updateZoomProgress(true);
    }

    // TODO: we are listening both on graph.diffBus and selection.selectionChangedBus,
    //  but the relation is actually:
    //
    //  diffBus -> SelectedNodesBus -> us
    //  diffBus         ->             us
    //
    //  we need to deduplicate this event
    // but there is no coordination, resulting in double updates.
    selection.selectionChangedBus.onValue(
        function() {
            update_view__graph(false);
        }
    );

    var el = document.body;
    vis = d3.select('#graph-view__canvas').append("svg:svg")
        .attr('id', 'canvas_d3')
        .attr("width", '100%')
        .attr("height", '100%')
        .attr("pointer-events", "all");

    var defs = vis.append('defs');

    defs.append('filter').attr('id', 'f_blur__creation-circle')
                          .attr('y', '-10%')
                          .attr('x', '-10%').append('feGaussianBlur').attr('in', 'SourceGraphic')
                                                                      .attr('stdDeviation', '15');
    defs.append('g')
        .attr('class', 'nodefilter-group');

    var zoom_g = vis
        .append("g")
        .attr("class", "zoom");

    var nozoom_g = vis.append("g");

    svgInput = svg_input(vis, main_graph);

    d3.select(el).select("svg").append("svg:defs")
        .data(["end"]) // Different link/path types can be defined here
        .append("svg:marker") // This section adds in the arrows
        .attr("id", String)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 22)
        .attr("refY", -1.5)
        .attr("markerWidth", 4)
        .attr("markerHeight", 4)
        .attr("orient", "auto")
        .append("svg:path")
        .attr("d", "M0,-5L10,0L0,5");

    /*
     * init zoom behavior
     */
    var zoom_obj = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);
    zoom_obj(vis);
    d3.select("svg").on("dblclick.zoom", null); // disable zoom on double click

    $('svg').click(svg_click_handler);
    var bubble_property =
        edit_graph.diffBus.map(function () {
            return edit_graph.nodes().length == 0 ? 0 : 180;
        }).skipDuplicates();

    main_graph_view = graph_view.GraphView({
            parent_element: zoom_g,
            graph_name: "main",
            graph: main_graph,
            zoom_obj: zoom_obj,
            zoom_obj_element: vis,
            parent_graph_zoom_obj: null,
            zoom_property: zoom_property,
            temporary: false,
            svgInput: svgInput,
            // FIXME: good place to animate bubble radius
            bubble_property: bubble_property,
    });
    edit_graph_view = graph_view.GraphView({
            parent_element: nozoom_g,
            graph_name: "edit",
            graph: edit_graph,
            zoom_obj: null,
            zoom_obj_element: null,
            parent_graph_zoom_obj: zoom_obj,
            zoom_property: zoom_property,
            temporary: true,
            bubble_property: bubble_property,
    });

    // $('#canvas_d3').dblclick(canvas_handler_dblclick); - see #138

    root_element_id_to_graph_view = {};
    root_element_id_to_graph_view[main_graph_view.root_element.id] =  main_graph_view;
    root_element_id_to_graph_view[edit_graph_view.root_element.id] = edit_graph_view;

    // publish vars
    published_var_dict.root_element_id_to_graph_view = root_element_id_to_graph_view;
    published_var_dict.main_graph = main_graph;
    published_var_dict.main_graph_view = main_graph_view;
    published_var_dict.edit_graph = edit_graph;
    published_var_dict.edit_graph_view = edit_graph_view;
};

/**
 * Initialize backend websocket connection - this will have no effect if
 * rz_config.backend__maintain_ws_connection is set to 'false'
 */
function init_ws_connection(){
    if (true == rz_config.backend__maintain_ws_connection){
        rz_mesh.init({graph: main_graph});

        // attempt to actively disconnect on tab/window close
        // ref: https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers.onbeforeunload
        window.addEventListener("beforeunload", function(e){
            var cur_rzdoc_name = rzdoc__current__get_name();
            rz_mesh.emit__rzdoc_unsubscribe(cur_rzdoc_name);
            rz_mesh.destroy();
        });
    }
}

function init() {
    init_graphs();
    init_graph_views();
    init_ws_connection();
    activity.init(main_graph, main_graph_view, $('.graph-view'));
    var cur_rzdoc_name = rzdoc__current__get_name();
    rzdoc__open(cur_rzdoc_name);
}

/**
 * find the visual element counterpart of a given model object. This relies on
 * the visual element having an id attribute equal to the object's id.
 *
 * @return null if visual element is not found
 */
function locate_visual_element(model_obj){
    var id_sel = $('#' + model_obj.id);
    if (0 === id_sel.length) {
        console.warn('unable to find visual element for model object: object id: ' + model_obj.id.toString());
        return null;
    }
    return id_sel[0];
}

/**
 * add node on canvas double click
 */
function canvas_handler_dblclick(){
    var n = model_core.create_node__set_random_id();
    n.name = ''; // will be set by user

    main_graph.commit_and_tx_diff__topo(model_diff.new_topo({
            node_set_add : [n].map(model_util.adapt_format_write_node),
        }));

    var n_ve = locate_visual_element(n);

    var on_slowdown_cb =  function(){
        svgInput.enable($(n_ve).find('.nodetext'), n);
        observer.disconnect();
    };
    var mutation_handler = rz_observer.new_Mutation_Handler__on_dxy_slowdown(on_slowdown_cb);
    var observer = rz_observer.new_MutationObserver(mutation_handler);
    mutation_handler.on_slowdown_threshold_reached;

    observer.observe(n_ve, {
        subtree: false,
        childList : false,
        attributes: true,
        attributeOldValue : true,
    });
}

function update_view__graph(relayout) {
    main_graph_view.update_view(relayout);
    edit_graph_view.update_view(relayout);
}

function load_from_json(result) {
    main_graph.load_from_json(result);
    recenterZoom();
    update_view__graph(true);
}

function page_title(rzdoc_name)
{
    // [!] needs to be synced with server provided title (index.html). double the code, half the latency.
    return rzdoc_name + ' -- Rhizi Prototype';
}

function url_for_doc(rzdoc_name)
{
    // [!] needs to be synced with server
    return '/rz/' + rzdoc_name;
}

function rzdoc__create_and_open(rzdoc_name) {

    var on_success = function (clone_obj) {
        rzdoc__open(rzdoc_name);
    };

    var on_error = function(xhr, status, err_thrown) {
        // TODO: handle malformed doc name
        var toolbar__status_body;

        toolbar__status_body = $('<div>Cannot create document titled \'' + rzdoc_name + '\', document already exists.</div>');
        toolbar__status.display_html_frag(toolbar__status_body);
    };

    // TODO: validate rzdoc name
    backend.rzdoc_create(rzdoc_name, on_success, on_error);
}

function rzdoc__current__get_name() {
    return rz_config.rzdoc_cur__name;
}

/**
 * open rzdoc:
 *    - set rz_config.rzdoc_cur__name
 *    - load rzdoc frombackend
 *    - do nothing if name of current rzdoc equals requested rzdoc
 */
function rzdoc__open(rzdoc_name) {

    function on_success() {
        get_search().clear();
        main_graph_view.zen_mode__cancel();
        window.history.replaceState(null, page_title(rzdoc_name), url_for_doc(rzdoc_name) + location.search);

        var rzdoc_bar = $('#rzdoc-bar_doc-label');
        var rzdoc_bar__doc_label = $('#rzdoc-bar_doc-label');
        rzdoc_bar.fadeToggle(500, 'swing', function() {
            rzdoc_bar__doc_label.text(rzdoc_name);
            rzdoc_bar.fadeToggle(500);
        });

        rz_mesh.emit__rzdoc_subscribe(rzdoc_name);
        console.log('rzdoc: opened rzdoc : \'' + rzdoc_name + '\'');
    };

    function on_error(xhr, status, err_thrown) {
        var create_btn,
            rzdoc_name,
            toolbar__status_body;

        rzdoc_name = xhr.responseJSON.data.rzdoc_name;

        create_btn = $('<span>');
        create_btn.text('Create document');
        create_btn.addClass('status-bar__btn_rzdoc_create_post_404');

        toolbar__status_body = $('<div>');
        toolbar__status_body.text('Rhizi could not find a document titled \'' + rzdoc_name + '\'.');
        toolbar__status_body.append(create_btn);

        create_btn.click(function() {
            rzdoc__create_and_open(rzdoc_name);
            toolbar__status.hide();
        });

        toolbar__status.display_html_frag(toolbar__status_body);
    }

    rz_config.rzdoc_cur__name = rzdoc_name;
    main_graph.clear();
    edit_graph.clear();
    activity.clear();
    main_graph.load_from_backend(on_success, on_error);
}

function rzdoc__open_default() {
    return rzdoc__open(rz_config.rzdoc__mainpage_name);
}

function rzdoc__search(search_query) {

    var cmd_bar,
    close_btn,
    result_body;

    cmd_bar = $('#cmd-bar__rzdoc-search');
    if (cmd_bar.length > 0) { // cmd bar present
        cmd_bar.remove();
    }

    cmd_bar = $('<div class="cmd-bar" id="cmd-bar__rzdoc-search">');
    cmd_bar.css('display', 'none');

    close_btn = $('<div id="cmd_bar__rzdoc_close">x</div>');
    close_btn.addClass('toolbar__close_btn');
    cmd_bar.append(close_btn);

    result_body = $('<div id="cmd-bar__rzdoc-search__result-body">');
    cmd_bar.append(result_body);

    cmd_bar.append($('<div class="cmd-bar__close_bar">Search results</div>'));

    function on_error(rzdoc_name_list) {
        // TODO: impl
    }

    function on_success(rzdoc_name_list) {

        if (0 === rzdoc_name_list.length) { // no document found, suggest creation
            var create_btn,
                msg,
                query_echo,
                block_div_wrapper;

            create_btn = $('<span>');
            create_btn.text('Create document');
            create_btn.addClass('cmd-bar_btn');

            query_echo = '<span id=\"cmd-bar__rzdoc-search__query-echo\">\'' + search_query + '\'</span>';
            msg = $('<span>No document titled ' + query_echo + ' was found.</span>');

            block_div_wrapper = $('<div id="cmd-bar__rzdoc-search__no-results">');
            block_div_wrapper.append(msg);
            block_div_wrapper.append(create_btn);

            result_body.append(block_div_wrapper);

            create_btn.click(function() {
                rzdoc__create_and_open(search_query);
                cmd_bar.remove();
            });

            return;
        }

        rzdoc_name_list.sort();
        for (var i = 0; i < rzdoc_name_list.length; i++) {
            var rzdoc_item = $('<div title="Open Rhizi">' + rzdoc_name_list[i] + '</div>');
            rzdoc_item.addClass('cmd_bar__rzdoc_open__item');
            result_body.append(rzdoc_item);
        }

        $('.cmd_bar__rzdoc_open__item').click(function(click_event) { // attach common click handler
            var rzdoc_name = click_event.currentTarget.textContent;
            var rzdoc_cur_name = rzdoc__current__get_name();
            if (rzdoc_name == rzdoc_cur_name) {
                console.log('rzdoc__open: ignoring request to reopen currently rzdoc: name: ' + rzdoc_cur_name);
                $("#rzdoc-bar_doc-label").fadeOut(400).fadeIn(400); // signal user
            } else {
                rzdoc__open(rzdoc_name);
                cmd_bar.remove();
            }
        });
    }

    // close
    close_btn.on('click', function() {
        cmd_bar.remove();
    });

    backend.rzdoc_search(search_query, on_success, on_error); // TODO: handle doc list timeout

    cmd_bar.insertAfter('#top-bar');
    cmd_bar.fadeToggle(400);
}

var published_var_dict = {
    // functions
    init: init,
    load_from_json: load_from_json,
    rzdoc__create_and_open: rzdoc__create_and_open,
    rzdoc__open: rzdoc__open,
    rzdoc__current__get_name: rzdoc__current__get_name,
    rzdoc__open_default: rzdoc__open_default,
    rzdoc__search: rzdoc__search,
    update_view__graph : update_view__graph,

    // vars, set by init
    main_graph: undefined,
    main_graph_view: undefined,
    edit_graph: undefined,
    edit_graph_view: undefined,
    root_element_id_to_graph_view: undefined,
};

return published_var_dict;
}); /* close define call */
