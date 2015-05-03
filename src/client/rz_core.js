"use strict"

define(['jquery', 'd3', 'consts', 'rz_bus', 'util', 'model/graph', 'model/core', 'view/item_info', 'rz_observer', 'view/selection', 'rz_mesh', 'model/diff', "view/graph_view", 'view/svg_input', 'view/filter_menu'],
function($,        d3,   consts,   rz_bus,   util,   model_graph,   model_core,        item_info,   rz_observer,   selection,        rz_mesh,   model_diff,   graph_view,       svg_input,              filter_menu) {

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
    root_element_id_to_graph_view;


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

var initDrawingArea = function () {

    function zoom() {
        zoom_g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        d3.event.sourceEvent != null && d3.event.sourceEvent.stopPropagation();
        updateZoomProgress(true);
    }

    main_graph = new model_graph.Graph({temporary: false, base: null});
    edit_graph = new model_graph.Graph({temporary: true, base: main_graph});

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

    var user_id = $('#user_id'),
        user = user_id.text();

    if (user_id.length > 0) {
        console.log('found user ID: \'' + user + '\'');
        main_graph.set_user(user);
        edit_graph.set_user(user);
    }

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
}

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
    initDrawingArea();
    init_ws_connection();

    if (rz_config.backend_enabled) {
        var cur_rzdoc_name = rzdoc__current__get_name();
        rzdoc__open(cur_rzdoc_name);
    }
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
        console.warn('unable to find visual element for model object: object id: ' + model_obj.id.toString())
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
    }
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

/**
 * open rzdoc:
 *    - set rz_config.rzdoc_cur__name
 *    - load rzdoc frombackend
 *    - do nothing if name of current rzdoc equals requested rzdoc
 */
function rzdoc__open(rzdoc_name) {
    rz_config.rzdoc_cur__name = rzdoc_name;
    main_graph.clear();
    edit_graph.clear();
    main_graph.load_from_backend();
    get_search().clear();
    main_graph_view.zen_mode__cancel();
    window.history.replaceState(null, page_title(rzdoc_name), url_for_doc(rzdoc_name));

    var rzdoc_bar = $('#rzdoc-bar_doc-label');
    var rzdoc_bar__doc_lable = $('#rzdoc-bar_doc-label');
    rzdoc_bar.fadeToggle(500, 'swing', function() {
        rzdoc_bar__doc_lable.text(rzdoc_name);
        rzdoc_bar.fadeToggle(500);
    });

    rz_mesh.emit__rzdoc_subscribe(rzdoc_name);
    console.log('rzdoc: opened rzdoc : \'' + rzdoc_name + '\'');
}

function rzdoc__current__get_name() {
    return rz_config.rzdoc_cur__name;
}

function rzdoc__open_default() {
    return rzdoc__open(rz_config.rzdoc__mainpage_name);
}

var published_var_dict = {
    // functions
    init: init,
    load_from_json: load_from_json,
    rzdoc__open: rzdoc__open,
    rzdoc__current__get_name: rzdoc__current__get_name,
    rzdoc__open_default: rzdoc__open_default,
    update_view__graph : update_view__graph,

    // vars, set by init
    main_graph: undefined,
    main_graph_view: undefined,
    edit_graph: undefined,
    edit_graph_view: undefined,
    root_element_id_to_graph_view: undefined,
}

return published_var_dict;
}); /* close define call */
