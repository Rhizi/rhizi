"use strict"

define(['jquery', 'd3', 'consts', 'rz_bus', 'util', 'model/graph', 'model/core', 'view/helpers', 'view/view', 'rz_observer', 'view/selection'],
function($, d3, consts, rz_bus, util, model_graph, model_core, view_helpers, view, rz_observer, selection) {

var addednodes = [],
    vis,
    graphstate = "GRAPH",
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
    svg_input_fo_height = '30px',
    svg_input_fo_width = '100px';

/**
 * svgInput - creates an embedded input element under a given
 *
 * edit_node(@sibling, @node)
 * edit_link(@sibling, @link)
 */
var svgInput = (function() {
    var measure_span;

    function createMeasureSpan(parent) {
        measure_span = document.createElement('span');
        measure_span.setAttribute('id', 'measure');
        measure_span.style.display = 'inline';
        measure_span.style.visibility = 'hidden';
        parent.appendChild(measure_span);
    }

    function appendForeignElementInputWithID(base, elemid, width, height)
    {
        var input = document.createElement('input'),
            body = document.createElement('body'),
            fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');

        body.appendChild(input);

        fo.setAttribute('width', width || svg_input_fo_width);
        fo.setAttribute('height', height || svg_input_fo_height);
        fo.style.pointerEvents = 'none';
        input.style.pointerEvents = 'all';
        fo.appendChild(body);
        base.appendChild(fo);
        input.setAttribute('id', elemid);
        createMeasureSpan(body);
        return input;
    }

    function measure(e, text)
    {
        measure_span.style.cssText = window.getComputedStyle(e).cssText;
        measure_span.style.visibility = 'none';
        measure_span.innerHTML = text;
        return measure_span.getBoundingClientRect().width; // $().width() works too
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
            fo.hide();
            ret = false;
            d = jelement.data().d;
            if (e.which == 13 && newname != d.name) {
                if (d.hasOwnProperty('__src')) {
                    graph.editLink(d.__src.id, d.__dst.id, newname);
                } else {
                    graph.editName(d.id, newname);
                }
                rz_bus.names.push([newname]);
                update_view__graph(true);
            }
        }
        rz_bus.ui_key.push({where: consts.KEYSTROKE_WHERE_EDIT_NODE, keys: [e.which]});
        return ret;
    };

    function resize_measure(e) {
        resize(measure(e.target, $(e.target).val()) + 30);
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
            fo = createOrGetSvgInputFO(),
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
        resize(e.getBBox().width + 30);
        fo.show();
        svg_input.val(oldname);
        svg_input.data().d = n;
        svg_input.focus();
        // TODO: set cursor to correct location in text
    }

    return {
        enable: enable,
        hide: function() {
            createOrGetSvgInputFO().hide();
        }
    };
}());



function recenterZoom() {
    vis.attr("transform", "translate(0,0)scale(1)");
}

var initDrawingArea = function () {

    function zoom() {
        if (graphstate === "GRAPH") {
            vis.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        }
        if (graphstate === "TIMELINE") {
            vis.attr("transform", "translate(0,0)scale(1)");
        }
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

    /*
     * init zoom behavior
     */
    var zoom_obj = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);
    zoom_obj(d3.select('#canvas_d3'))
    d3.select("svg").on("dblclick.zoom", null); // disable zoom on double click

    // TODO: why do we need this huge overlay (hugeness also not constant)
    vis.append("rect")
        .attr("class", "overlay graph")
        .attr("width", $(el).innerWidth() * 12)
        .attr("height", $(el).innerHeight() * 12)
        .attr("x", -$(el).innerWidth() * 5)
        .attr("y", -$(el).innerHeight() * 5);
    $('.overlay').click(overlay_mousedown);

    // SVG rendering order is last rendered on top, so to make sure
    // all links are below the nodes we group them under a single g
    vis.append("g").attr("id", "link-group");

    drag = d3.behavior.drag()
             .origin(function(d) { return d; })
             .on("dragstart", dragstarted)
             .on("drag", dragged)
             .on("dragend", dragended);

    // $('#canvas_d3').dblclick(canvas_handler_dblclick); - see #138
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

initDrawingArea();
init_force_layout();

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
        link_group;

    link_group = vis.select('#link-group');
    link = link_group.selectAll("g.link")
        .data(graph.links());

    link_g = link.enter().append('g')
        .attr('class', 'link graph');

    link_g.append("svg:defs").selectAll("marker")
        .data(["end"]) // Different link/path types can be defined here
        .append("svg:marker") // This section adds in the arrows
        .attr("id", String)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 22)
        .attr("refY", -1.5)
        .attr("markerWidth", 4)
        .attr("markerHeight", 4)
        .attr("orient", "auto")
        .attr("class", function(d) {
            return selection.selected_class(d);
        })
        .append("svg:path")
        .attr("d", "M0,-5L10,0L0,5");

    link_g.append("path")
        .attr("class", function(d) {
            return d.state + ' link graph';
        })
        .attr("marker-end", "url(#end)");

    // second path for larger click area
    link_g.append("path")
        .attr("class", "ghostlink")
        .on("click", function(d, i) {
            var that = this,
                src = this.link.__src,
                dst = this.link.__dst;

            view.edge_info.on_delete(function () {
                graph.removeLink(that.link);
                update_view__graph(true);
                view.edge_info.hide();
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

    link_group.selectAll('.ghostlink')
        .data(graph.links())
        .each(function (d) {
            this.link = d;
        });

    linktext = vis.selectAll(".linklabel").data(graph.links());
    linktext.enter()
        .append("text")
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

    node.each(function (d) {
            this.node = d;
        })
        .attr('class', function(d) {
            return ['node', selection.selected_class(d)].join(' ');
        });

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
                update_view__graph(true);
            }
            d3.event.stopPropagation();
        });

    node.select('g.node text')
        .text(function(d) {
            if (!d.name) {
                return "";
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
            update_view__graph(true);
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
    var link = vis.select("#link-group").selectAll("path.link")
        .data(graph.links());
    var linktext = vis.selectAll(".linklabel").data(graph.links());

    function transform(d) {
        if (graphstate === "GRAPH" || d.type === "third-internship-proposal") {
            if (check_for_nan(d.x) || check_for_nan(d.y)) {
                return;
            }
            if (d.state === "temp") {
                return "translate(" + d.x + "," + d.y + ")";
            } else {
                return "translate(" + d.x + "," + d.y + ")";
            }
        } else {
            return "translate(0,0)";
        }
        return "translate(" + d.x + "," + d.y + ")";
    }

    if (graphstate === "TIMELINE") {
        var k = 20 * e.alpha;
        var today = new Date();
        var missingcounter = 0;

        graph.nodes().forEach(function(d, i) {
            if ((d.start === 0 || d.end === 0)) {
                d.x = 450 + missingcounter * 100;
                d.y = window.innerWidth / 2;
                if (missingcounter >= 6) {
                    d.x = 450 + (missingcounter - 6) * 100;
                    d.y = window.innerWidth / 2 + 50;
                }
                missingcounter++;
            } else {
                //var min= 150+graphinterval*Math.ceil(Math.abs(d.start.getTime() - today.getTime()) / (1000 * 3600 * 24)) - $('.gantbox').scrollLeft();
                //var max= 150+graphinterval*Math.ceil(Math.abs(d.end.getTime() - d.start.getTime()) / (1000 * 3600 * 24)) - $('.gantbox').scrollLeft();
                //d.x = min+Math.sin(today.getTime()/1000*Math.PI*2/10)*max;
                timeline_timer++;
                if (timeline_timer < 3000) {
                    d.x = 150 + graphinterval * Math.ceil(Math.abs(d.start.getTime() - today.getTime()) / (1000 * 3600 * 24)) * timeline_timer / 3000;
                    d.y = 150 + d.start.getHours() * 17;
                } else {
                    d.x = 150 + graphinterval * Math.ceil(Math.abs(d.start.getTime() - today.getTime()) / (1000 * 3600 * 24));
                    d.y = 150 + d.start.getHours() * 17;
                }
            }
            if (d.state === "chosen") {
                scrollValue = d.x;
            }
        });
    } else {
        //circles animation
        var tempcounter = 0;
        var temptotal = 0;
        graph.nodes().forEach(function(d, i) {
            if (d.state === "temp" && d.type!=="chainlink" && d.type!=="bubble") {
                temptotal++;
            }
        });
        if(temptotal!==newnodes){
                newnodes+=temptotal/15/(newnodes*newnodes);
        }
        if(newnodes>=temptotal){
            newnodes=temptotal;
        }
        if(newnodes<1)newnodes=1;
        graph.nodes().forEach(function(d, i) {
            if (d.state === "temp") {
                tempcounter++;
                if(d.type==="chainlink" || d.type==="bubble"){
                     d.x = window.innerWidth / 2;
                     d.y = window.innerHeight / 2;
                } else {
                    d.x = window.innerWidth / 2 + (60+newnodes*20) * Math.cos(-Math.PI+Math.PI * 2 * (tempcounter-1) / newnodes+0.3);
                    d.y = window.innerHeight / 2 + (60+newnodes*20)  * Math.sin(-Math.PI+Math.PI * 2 * (tempcounter-1) / newnodes+0.3);
                }
                check_for_nan(d.x);
                check_for_nan(d.y);
            }
        });
    }

    link.attr("d", function(d, i) {
        var d_val,
            ghost;

        if (graphstate === "GRAPH") {
            var dx = d.__dst.x - d.__src.x,
                dy = d.__dst.y - d.__src.y,
                dr = Math.sqrt(dx * dx + dy * dy);
            d_val = "M" + d.__src.x + "," + d.__src.y + "A" + dr + "," + dr + " 0 0,1 " + d.__dst.x + "," + d.__dst.y;
        } else if (graphstate === "TIMELINE") {
            if (d.state === "enter" || d.state === "exit") {
                var dx = d.__dst.x - d.__src.x,
                    dy = d.__dst.y - d.__src.y,
                    dr = Math.sqrt(dx * dx + dy * dy) * 5;
                d_val = "M" + d.__src.x + "," + d.__src.y + "A" + dr + "," + dr + " 0 0,1 " + d.__dst.x + "," + d.__dst.y;
            } else {
                var dx = d.__dst.x - d.__src.x,
                    dy = d.__dst.y - d.__src.y,
                    dr = Math.sqrt(dx * dx + dy * dy) * 5;

                d_val = "M" + 0 + "," + 0 + "A" + dr + "," + dr + " 0 0,1 " + 0 + "," + 0;
            }
        }
        // update ghostlink position
        ghost = $(this.nextElementSibling);
        ghost.attr("d", d_val);
        return d_val;
    });


    linktext.attr("transform", function(d) {
        if (graphstate === "GRAPH") {
            return "translate(" + (d.__src.x + d.__dst.x) / 2 + "," + (d.__src.y + d.__dst.y) / 2 + ")";
        } else {
            return "translate(0,0)";
        }
    });

    node.attr("transform", transform);

    // After initial placement we can make the nodes visible.
    //links.attr('visibility', 'visible');
    node.attr('visibility', 'visible');
}

function showNodeInfo(d, i) {
    view.node_info.show(d);
    view.node_info.on_submit(function() {
      if (d.type === "deliverable") {
        graph.editDates(d.id, null, new Date($("#editstartdate").val()), new Date($("#editenddate").val()));
      }
      graph.editType(d.id,d.type,$('#edittype').val());
      graph.editURL(d.id, d.type, $('#editurl').val());
      graph.editStatus(d.id, d.type, $('#editstatus').val());
      update_view__graph(true);
      return false;
    });
    view.node_info.on_delete(function() {
      if (confirm('This node and all its connections will be deleted, are you sure?')) {
        graph.removeNode(d.id, null);
        update_view__graph(false);
        view.node_info.hide();
      }
    });
}

function overlay_mousedown() {
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
