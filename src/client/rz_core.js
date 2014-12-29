"use strict"

define(['jquery', 'd3', 'consts', 'rz_bus', 'util', 'model/graph', 'model/core', 'view/helpers', 'view/view', 'rz_observer', 'view/selection', 'rz_config', 'rz_mesh'],
function($, d3, consts, rz_bus, util, model_graph, model_core, view_helpers, view, rz_observer, selection, rz_config, rz_mesh) {

var addednodes = [],
    vis,
    graphinterval = 0,
    timeline_timer = 0,
    deliverables = [],
    circle, // <-- should not be module globals.
    scrollValue = 0,
    graph,
    drag,
    force;

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
                    graph.update_link(d, {name: newname}, function() {
                        update_view__graph(true);
                    });
                } else {
                    graph.update_node(d, {name: newname}, function() {
                        update_view__graph(true);
                    });
                    // TODO - 'updating' graphic
                    // TODO - use promises to make A follows B readable.
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



function recenterZoom() {
    vis.attr("transform", "translate(0,0)scale(1)");
}

// zoom or drag
var zoomInProgress = false;

var initDrawingArea = function () {

    function zoom() {
        zoomInProgress = true;
        vis.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        d3.event.sourceEvent.stopPropagation();
    }

    function dragstarted(d) {
        d3.event.sourceEvent.stopPropagation();
        d3.select(this).classed("dragging", true);
        d.dragstart = {clientX:d3.event.sourceEvent.clientX, clientY:d3.event.sourceEvent.clientY};
        force.stop();
    }

    function dragged(d) {
        d.x = d3.event.x;
        d.y = d3.event.y;
        tick();
    }

    function dragended(d) {
        d3.select(this).classed("dragging", false);
        d3.select(this).classed("fixed", true); // TODO: this is broken since we override all the classes. Need to switch to class addition/removal (i.e. use classed for everything) or set class in one location (so here just set a value on the node, not the element)
        if (d.dragstart.clientX - d3.event.sourceEvent.clientX != 0 ||
            d.dragstart.clientY - d3.event.sourceEvent.clientY != 0) {
            tick();
            force.resume();
        }
    }

    graph = new model_graph.Graph();
    graph.diffBus.onValue(function (diff) {
        var relayout = false == rz_diff.is_attr_diff(diff);
        update_view__graph(relayout);
    });

    var user_id = $('#user_id'),
        user = user_id.text();

    if (user_id.length > 0) {
        console.log('found user ID: \'' + user + '\'');
        graph.set_user(user);
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
    zoom_obj(d3.select('#canvas_d3'))
    d3.select("svg").on("dblclick.zoom", null); // disable zoom on double click

    $('svg').click(svg_click_handler);

    // SVG rendering order is last rendered on top, so to make sure
    // all links are below the nodes we group them under a single g
    vis.append("g").attr("id", "link-group");
    vis.append("g").attr("id", "selected-link-group");

    drag = d3.behavior.drag()
             .origin(function(d) { return d; })
             .on("dragstart", dragstarted)
             .on("drag", dragged)
             .on("dragend", dragended);

    // $('#canvas_d3').dblclick(canvas_handler_dblclick); - see #138
    if (rz_config.backend_enabled){
        graph.load_from_backend( function(){
            update_view__graph(false);
        });
    }
}

function init_force_layout(){
    var el = document.body;
    var w = $(el).innerWidth(),
        h = $(el).innerHeight();

    force = d3.layout.force()
              .distance(120)
              .gravity(0.12)
              .charge(-1800)
              .size([w, h])
              .on("tick", tick)
              .start();
}

/**
 * Initialize backend websocket connection - this will have no effect if
 * rz_config.backend__maintain_ws_connection is set to 'false'
 */
function init_ws_connection(){
    if (true == rz_config.backend__maintain_ws_connection){
        rz_mesh.init({graph: graph});
    }
}

initDrawingArea();
init_force_layout();
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

    graph.addNode(n);
    update_view__graph();

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

/**
 * update view: graph
 */
function update_view__graph(no_relayout) {
    var node,
        link,
        link_g,
        linktext,
        nodetext,
        unselected_link_group = document.querySelector('#link-group'),
        selected_link_group = document.querySelector('#selected-link-group');

    link = vis.selectAll("g.link")
        .data(graph.links(), function(d) { return d.id; });

    link_g = link.enter().append('g')
        .attr('id', function(d){ return d.id; }) // append link id to enable data->visual mapping
        .attr('class', 'link graph')

    link_g.append("path")
        .attr("class", function(d) {
            return d.state + ' link graph';
        })
        .attr('id', function(d){ return d.id; }) // append link id to enable data->visual mapping
        .attr("marker-end", "url(#end)");

    // second path for larger click area
    link_g.append("path")
        .attr("class", "ghostlink")
        .on("click", function(d, i) {
            if (zoomInProgress) {
                // don't disable zoomInProgress, it will be disabled by the svg_click_handler
                // after this events bubbles to the svg element
                return;
            }
            var that = this,
                src = this.link.__src,
                dst = this.link.__dst;

            view.edge_info.on_delete(function () {
                view.edge_info.hide();
                graph.removeLink(that.link, function() {
                    update_view__graph(true);
                }, function() {
                    console.log("error: could not remove link");
                });
            });
            view.edge_info.show(d);
            selection.update([src, dst]);
            update_view__graph(true);
        });

    link.attr("class", function(d, i){
            var temp_and = (d.name && d.name.replace(/ /g,"")=="and" && d.state==="temp") ? "temp_and" : "";

            return ["graph link", temp_and, selection.selected_class(d)].join(' ');
        });

    link.selectAll('path.link')
        .attr('class', function(d) {
            return [d.state, selection.selected_class(d), "link graph"].join(' ');
        });

    link.exit().remove();

    vis.selectAll('.ghostlink')
        .data(graph.links())
        .each(function (d) {
            this.link = d;
        });

    linktext = vis.selectAll(".linklabel")
        .data(graph.links(), function(d) { return d.id; });
    linktext.enter()
        .append("text")
        .attr('id', function(d){ return d.id; }) // append link id to enable data->visual mapping
        .attr("class", function(d) {
            return ["linklabel graph", selection.selected_class(d)].join(' ');
        })
        .attr("text-anchor", "middle")
        .on("click", function(d, i) {
            if (d.state !== "temp") {
                svgInput.enable(this, d);
            }
        });

    linktext
        .text(function(d) {
            var name = d.name || "";
            if (!(d.__dst.state === "temp" ||
                d.__src.state === "chosen" || d.__dst.state === "chosen")) {
                return "";
            }
            if (name.length < 25 || d.__src.state === "chosen" ||
                d.__dst.state === "chosen" || d.state==="temp") {
                return name;
            } else {
                return name.substring(0, 14) + "...";
            }
        });

    linktext.exit().remove();

    node = vis.selectAll(".node")
        .data(graph.nodes(), function(d) {
            return d.id;
        });

    var nodeEnter = node.enter()
        .append("g")
        .attr('id', function(d){ return d.id; }) // append node id to enable data->visual mapping
        .attr('visibility', 'hidden') // made visible on first tick
        .call(drag);

    // reorder nodes so selected are last, and so rendered last, and so on top.
    (function () {
        var ontop = [],
            bubble;

        node.each(function (d) {
                this.node = d;
            })
            .attr('class', function(d) {
                if (selection.node_selected(d)) {
                    if (d.type == 'bubble') {
                        bubble = this;
                    } else {
                        ontop.push(this);
                    }
                }
                return ['node', selection.selected_class(d)].join(' ');
            });
        if (bubble === undefined) {
            // nothing to do if there is no bubble
            return;
        }
        function reparent(new_parent, element) {
            if (element.parentNode == new_parent) {
                return;
            }
            new_parent.appendChild(element);
        }
        // move link to correct group
        // O(|links|*|ontop|)
        link.each(function (d) {
            if (ontop.some(function (node) {
                    var d_node = node.node;
                    return d.__src == d_node || d.__dst == d_node;
                }))
            {
                reparent(selected_link_group, this);
            } else {
                reparent(unselected_link_group, this);
            }
        });
        linktext.each(function (d) {
            if (selection.node_selected(d)) {
                ontop.push(this);
            }
        });
        function moveToEnd(e) {
            e.parentNode.appendChild(e);
        }
        moveToEnd(bubble);
        ontop.reverse().forEach(function (e) {
            moveToEnd(e);
        });
        var count_links = function() {
            return selected_link_group.childElementCount + unselected_link_group.childElementCount;
        };
        // put back on top link group on top
        selected_link_group.parentNode.insertBefore(selected_link_group, bubble.nextSibling);
    })();

    nodetext = nodeEnter.insert("text")
        .attr("class", "nodetext graph")
        .attr("dx", node_text_dx)
        .attr("dy", node_text_dy)
        .on("click", function(d, i) {
            if (d3.event.defaultPrevented) {
                // drag happened, ignore click https://github.com/mbostock/d3/wiki/Drag-Behavior#on
                return;
            }
            if (d.state !== "temp") {
                svgInput.enable(this, d);
                selection.update([d]);
                showNodeInfo(this.parentNode.node, i);
            }
            d3.event.stopPropagation();
        });

    node.select('g.node text')
        .text(function(d) {
            if (!d.name) {
                return d.type == 'bubble' ? "" : "_";
            }
            if (d.state === "temp" || d.state === 'chosen'
             || d.state === "enter" || d.state === "exit") {
                 return d.name;
            } else {
                if (d.name.length < 28) {
                    return d.name;
                } else {
                    return d.name.substring(0, 25) + "...";
                }
            }
        });

    circle = nodeEnter.insert("circle");
    node.select('g.node circle')
        .attr("class", function(d) {
            return d.type + " " + d.state + " circle graph";
        })
        .attr("r", function(d) {
            return view_helpers.customSize(d.type) - 2;
        })
        .on("click", function(d, i) {
            if (d3.event.defaultPrevented) {
                // drag happened, ignore click https://github.com/mbostock/d3/wiki/Drag-Behavior#on
                return;
            }
            d3.event.stopPropagation();
            selection.update([d]);
            if(d.state !== "temp") {
                showNodeInfo(d, i);
            }
        });
    circle.append("svg:image")
        .attr("class", "status graph")
        .attr('x', -7)
        .attr('y', -8)
        .attr('width', 15)
        .attr('height', 15)
        .attr("xlink:href", function(d) {
            switch (d.status) {
                case "done":
                    return "res/img/check.png";
                    break;
                case "current":
                    return "res/img/wait.png";
                    break;
                case "waiting":
                    return "res/img/cross.png";
                    break;
            }
        });

    node.exit().remove();

    //update deliverables
    deliverables = [];
    var nodes = graph.nodes();
    for (var i = 0; i < nodes.length; i++) {
        var current = nodes[i];
        if (current.type === "third-internship-proposal") {
            deliverables.push({
                "id": nodes[i].id,
                "startdate": nodes[i].start,
                "enddate": nodes[i].end
            });
        }
        //Do something
    }

    force.nodes(graph.nodes())
        .links(graph.links())

    if (no_relayout) {
        // XXX If we are stopped we need to update the text of the links at least,
        // and this is the simplest way
        tick();
    } else {
        force.alpha(0.1).start();
    }
}



var debug_print = function(message) {
    var element = $(".debug");
    if (element.length == 1) {
        element.html(message);
    } else {
        console.log(message);
    }
}

function check_for_nan(x) {
    if (Number.isNaN(x)) {
        console.log('nan problem');
        force.stop();
    }
    return Number.isNaN(x);
}

var newnodes=1;
function tick(e) {
    //console.log(e);
    //$(".debug").html(force.alpha());
    var node = vis.selectAll(".node")
        .data(force.nodes(), function(d) {
            return d.id;
        });
    var link = vis.selectAll("path.link")
        .data(graph.links(), function(d) {
            return d.id;
        });
    var linktext = vis.selectAll(".linklabel").data(graph.links());

    function transform(d) {
        if (check_for_nan(d.x) || check_for_nan(d.y)) {
            return;
        }
        return "translate(" + d.x + "," + d.y + ")";
    }

    //circles animation
    var tempcounter = 0,
        temptotal = graph.nodes().filter(function(d){
            return d.state === "temp" && d.type !== "chainlink" && d.type !== "bubble";
        }).length;
    if (temptotal !== newnodes) {
        newnodes += temptotal / 15 / (newnodes * newnodes);
    }
    newnodes = Math.max(1, Math.min(newnodes, temptotal));
    graph.nodes().forEach(function(d, i) {
        var r, a;
        if (d.state === "temp") {
            tempcounter++;
            if (d.type==="chainlink" || d.type==="bubble") {
                 d.x = window.innerWidth / 2;
                 d.y = window.innerHeight / 2;
            } else {
                r = 60 + newnodes * 20;
                a = -Math.PI + Math.PI * 2 * (tempcounter-1) / newnodes + 0.3;
                d.x = window.innerWidth / 2 + r * Math.cos(a);
                d.y = window.innerHeight / 2 + r * Math.sin(a);
            }
            check_for_nan(d.x);
            check_for_nan(d.y);
        }
    });

    link.attr("d", function(d, i) {
        var d_val,
            ghost;

        var dx = d.__dst.x - d.__src.x,
            dy = d.__dst.y - d.__src.y,
            dr = Math.sqrt(dx * dx + dy * dy);
        d_val = "M" + d.__src.x + "," + d.__src.y + "L" + d.__dst.x + "," + d.__dst.y;
        // update ghostlink position
        ghost = $(this.nextElementSibling);
        ghost.attr("d", d_val);
        return d_val;
    });

    linktext.attr("transform", function(d) {
        return "translate(" + (d.__src.x + d.__dst.x) / 2 + "," + (d.__src.y + d.__dst.y) / 2 + ")";
    });

    node.attr("transform", transform);

    // After initial placement we can make the nodes visible.
    //links.attr('visibility', 'visible');
    node.attr('visibility', 'visible');
}

function showNodeInfo(d, i) {
    view.node_info.on_save(function(e, form_data) {

        graph.update_node(d, form_data, function(){
            var old_type = d.type,
                new_type = form_data.type;

            if (new_type != old_type) {
                view.node_info.show(d);
            }

            view.node_info.hide();
            update_view__graph(true);
        });

        return false;
    });

    view.node_info.on_delete(function() {
        graph.removeNode(d.id); // async
        update_view__graph(false);
        view.node_info.hide();
    });

    view.node_info.show(d);
}

function svg_click_handler(e) {
    if (zoomInProgress) {
        zoomInProgress = false;
        return;
    }
    if (e.originalEvent.target.nodeName != 'svg') {
        return;
    }
    svgInput.hide();
    selection.clear();
    view.hide();
    update_view__graph(true);
}

return {
    graph: graph,
    force: force,
    load_from_json: function(result) {
        graph.load_from_json(result);
        recenterZoom();
        update_view__graph(false);
    },
    update_view__graph : update_view__graph,
}
}); /* close define call */
