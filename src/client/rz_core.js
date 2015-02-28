"use strict"

define(['jquery', 'd3', 'consts', 'rz_bus', 'util', 'model/graph', 'model/core', 'view/helpers', 'view/view', 'rz_observer', 'view/selection', 'rz_mesh', 'model/diff', "view/graph_view", 'view/svg_input'],
function($,        d3,   consts,   rz_bus,   util,   model_graph,   model_core,   view_helpers,   view,        rz_observer,   selection,        rz_mesh,   model_diff,   graph_view,       svg_input) {

var addednodes = [],
    vis,
    graphinterval = 0,
    timeline_timer = 0,
    deliverables = [],
    circle, // <-- should not be module globals.
    scrollValue = 0,
    main_graph,
    edit_graph,
    main_graph_view,
    edit_graph_view;

// "CSS" for SVG elements. Reused for editing elements.
var node_text_dx = 15,
    node_text_dy = '.30em';

var zoomProgress = false;
var zoomBus = new Bacon.Bus();
var zoom_property = zoomBus.toProperty(zoomProgress);
var svgInput;

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
    view.hide();
    update_view__graph(false);
}

function recenterZoom() {
    vis.attr("transform", "translate(0,0)scale(1)");
}

main_graph = new model_graph.Graph({temporary: false, base: null});
edit_graph = new model_graph.Graph({temporary: true, base: main_graph});

var initDrawingArea = function () {

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
            main_graph.setRegularState();
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
            node_text_dx: node_text_dx,
            node_text_dy: node_text_dy,
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
            node_text_dx: node_text_dx,
            node_text_dy: node_text_dy,
            bubble_property: bubble_property,
        });

    // $('#canvas_d3').dblclick(canvas_handler_dblclick); - see #138
    if (rz_config.backend_enabled) {
        main_graph.load_from_backend();
    }
}

/**
 * Initialize backend websocket connection - this will have no effect if
 * rz_config.backend__maintain_ws_connection is set to 'false'
 */
function init_ws_connection(){
    if (true == rz_config.backend__maintain_ws_connection){
        rz_mesh.init({graph: main_graph});
    }
}

initDrawingArea();
init_ws_connection();

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

function update_view__graph(relayout)
{
    main_graph_view.update_view(relayout);
    edit_graph_view.update_view(relayout);
}

return {
    main_graph: main_graph,
    edit_graph: edit_graph,
    main_graph_view: main_graph_view,
    edit_graph_view: edit_graph_view,
    load_from_json: function(result) {
        main_graph.load_from_json(result);
        recenterZoom();
        update_view__graph(true);
    },
    update_view__graph : update_view__graph,
}
}); /* close define call */
