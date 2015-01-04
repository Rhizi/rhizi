"use strict"

define(['jquery', 'd3', 'consts', 'rz_bus', 'util', 'model/graph', 'model/core', 'view/helpers', 'view/view', 'rz_observer', 'view/selection', 'rz_config', 'rz_mesh', 'model/diff', "view/graph_view"],
function($,        d3,   consts,   rz_bus,   util,   model_graph,   model_core,   view_helpers,   view,        rz_observer,   selection,        rz_config,   rz_mesh,   model_diff,   graph_view) {

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
    node_text_dy = '.30em',
    svg_input_fo_node_x = node_text_dx,
    svg_input_fo_node_y = '-.70em',
    svg_input_fo_height = '30px';

/**
 * svgInput - creates an embedded input element under a given
 *
 * edit_node(@sibling, @node)
 * edit_link(@sibling, @link)
 */
var svgInput = (function() {
    var measure_node = $('#measure-node')[0],
        measure_link = $('#measure-link')[0],
        original_element,
        is_link;

    function appendForeignElementInputWithID(base, elemid, width, height)
    {
        var input = document.createElement('input'),
            body = document.createElement('body'),
            fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');

        body.appendChild(input);

        fo.setAttribute('height', height || svg_input_fo_height);
        fo.style.pointerEvents = 'none';
        input.style.pointerEvents = 'all';
        fo.appendChild(body);
        base.appendChild(fo);
        input.setAttribute('id', elemid);
        return input;
    }

    function measure(text)
    {
        var span;

        span = is_link ? measure_link : measure_node;
        span.innerHTML = text;
        return span.getBoundingClientRect().width; // $().width() works too
    }

    function onkeydown(e) {
        var ret = undefined,
            jelement = createOrGetSvgInput(),
            element = jelement[0],
            newname = jelement.val(),
            fo = createOrGetSvgInputFO(),
            d;

        if (element != this) {
            console.log('unexpected editname_on_keypress this should be the svg-input element');
        }

        if (e.which == 13 || e.which == 27) {
            ret = false;
            d = jelement.data().d;
            if (e.which == 13 && newname != d.name) {
                if (d.hasOwnProperty('__src')) {
                    main_graph.update_link(d, {name: newname});
                } else {
                    // TODO - display hourglass
                    // TODO - use promises to make A follows B readable.
                    main_graph.update_node(d, {name: newname});
                }
            }
            hide();
        }
        rz_bus.ui_key.push({where: consts.KEYSTROKE_WHERE_EDIT_NODE, keys: [e.which]});
        return ret;
    };

    function resize_measure(e) {
        resize(measure($(e.target).val()) + 30);
    }

    function resize(new_width) {
        var svg_input = createOrGetSvgInput(),
            fo = createOrGetSvgInputFO();

        svg_input.css('width', new_width);
        fo.attr('width', new_width);
    }

    // FIXME: element being deleted. Some delete is legit - removal of related element. Some isn't (a click).
    // Instead of investigating (time constraint) reparenting as sibling, and introducing
    // this function. Cost of creation of element is negligble, it's just ugly..
    function createOrGetSvgInput()
    {
        var svg_input_name = 'svg-input',
            svg_input_selector = '#' + svg_input_name,
            svg_input = $(svg_input_selector);

        if (svg_input.length == 0) {
            console.log('creating new svg-input');
            svg_input = $(appendForeignElementInputWithID(vis[0][0], svg_input_name));
            svg_input.on('keydown', onkeydown);
            svg_input.bind('change keypress', resize_measure);
        }
        return svg_input;
    }

    function createOrGetSvgInputFO()
    {
        return createOrGetSvgInput().parent().parent();
    }

    /*
     * @param e visual node element
     * @param n node model object
     */
    function enable(e, n) {
        var oldname = n.name,
            svg_input = createOrGetSvgInput(),
            fo = createOrGetSvgInputFO();

        is_link = n.hasOwnProperty('__src');

        e.parentNode.appendChild(fo[0]); // This will unparent from the old parent
        if (is_link) {
            fo.attr('transform', e.getAttribute('transform'));
            // XXX links set the text-anchor middle attribute. no idea how to do that
            fo.attr('x', -$(e).width() / 2);
            fo.attr('y', -$(e).height() / 2 - 3); // XXX This minus 3 is only kinda ok.
            fo.attr('class', 'svg-input-fo-link');
        } else {
            fo.attr('x', svg_input_fo_node_x);
            fo.attr('y', svg_input_fo_node_y);
            fo.attr('transform', null);
            fo.attr('class', 'svg-input-fo-node');
        }
        // Set width correctly
        resize(measure(oldname) + 30);
        fo.show();
        svg_input.val(oldname);
        svg_input.data().d = n;
        svg_input.focus();
        if (original_element) {
            original_element.show();
        }
        original_element = $(e);
        original_element.hide();
        // TODO: set cursor to correct location in text
    }

    function hide() {
        createOrGetSvgInputFO().hide();
        if (original_element && original_element.show) {
            original_element.show();
        }
    }

    return {
        enable: enable,
        hide: hide,
    };
}());

var zoomProgress = false;
var zoomBus = new Bacon.Bus();
var zoomProperty = zoomBus.toProperty();
zoomBus.push(zoomProgress); // set initial value

function svg_click_handler(e) {
    if (zoomProgress) {
        zoomProgress = false;
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

main_graph = new model_graph.Graph(false);
edit_graph = new model_graph.Graph(true);

var initDrawingArea = function () {

    function zoom() {
        zoomProgress = true;
        vis.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        d3.event.sourceEvent.stopPropagation();
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
        function() { update_view__graph(false);
    });

    var user_id = $('#user_id'),
        user = user_id.text();

    if (user_id.length > 0) {
        console.log('found user ID: \'' + user + '\'');
        main_graph.set_user(user);
        edit_graph.set_user(user);
    }

    var el = document.body;
    vis = d3.select(el).append("svg:svg")
        .attr('id', 'canvas_d3')
        .attr("width", '100%')
        .attr("height", '100%')
        .attr("pointer-events", "all")
        .append("g")
        .attr("class", "zoom");

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
    zoom_obj(d3.select('#canvas_d3'));
    d3.select("svg").on("dblclick.zoom", null); // disable zoom on double click

    $('svg').click(svg_click_handler);

    main_graph_view = graph_view.GraphView({
            vis: vis.append('g'),
            graph_name: "main",
            graph: main_graph,
            zoomProperty: zoomProperty,
            forceEnabled: true,
            node_text_dx: node_text_dx,
            node_text_dy: node_text_dy,
        });
    edit_graph_view = graph_view.GraphView({
            vis: vis.append('g'),
            graph_name: "edit",
            graph: edit_graph,
            zoomProperty: zoomProperty,
            forceEnabled: false,
            node_text_dx: node_text_dx,
            node_text_dy: node_text_dy,
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
    if (0 == id_sel.length){
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

    var n_ve = locate_visual_element(n); // locate visual element

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

function showNodeInfo(node, i) {
    var closed = false;

    view.node_info.on_save(function(e, form_data) {
        closed = true;
        main_graph.update_node(node, form_data, function() {
            var old_type = node.type,
                new_type = form_data.type;

        });
        view.node_info.hide();
        return false;
    });

    // FIXME - attribute diff, ignore uninteresting diffs via filtering
    main_graph.diffBus.onValue(function () {
        if (closed) {
            return Bacon.noMore;
        }
        view.node_info.show(node);
    });

    view.node_info.on_delete(function() {
        var topo_diff = model_diff.new_topo_diff({
                node_set_rm: [node.id]
            });
        console.log("closing node info");
        closed = true;
        view.node_info.hide();
        main_graph.commit_and_tx_diff__topo(topo_diff);
    });

    view.node_info.show(node);
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
