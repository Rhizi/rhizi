/* view of a single graph in a graph tree.
 *
 * Usage is of a two graph system:
 *
 * <Master Graph>
 *
 * <Editing Graph>
 *
 * Nodes are drawn per graph.
 * Edges connecting between the two graphs are drawn by the descendant graph.
 *
 * Updates are done using Bacon based events.
 *
 * TODO: fill in the event diagram here.
 * TODO: do it via tests.
 *
 * Layout is either d3 force or custom. We use custom for the temporary graph.
 *
 * This avoids the need to compute similarity between two consecutive temporary graphs,
 * i.e.
 * #alon is #bore
 * and
 * #alon is #bored
 *
 * which resulted in overly complex (read: undefined/buggy) code.
 */

define(['d3', 'Bacon_wrapper', 'util', 'view/selection', 'view/helpers', 'model/diff', 'view/view', 'view/bubble'],
function(d3 ,  Bacon         ,  util ,  selection      ,  view_helpers,  model_diff  ,  view, view_bubble) {

var obj_take = util.obj_take;

/* debugging helper */
function enableDebugViewOfDiffs(graph)
{
    var debugView = document.createElement('div');
    document.body.appendChild(debugView);
    debugView.style['pointer-events'] = 'none';
    debugView.style.id = 'graphviewdiffdebug';
    debugView.style.position = 'absolute';
    debugView.style.left = '100px';
    debugView.style.top = '100px';
    debugView.innerHTML = '<div>debug view</div>';
    debugView.append = function (diff) {
        debugView.innerHTML = debugView.innerHTML + '<div>' + diff + '</div>';
    }
    graph.diffBus.onValue(function (diff) {
        debugView.append(diff);
    });
}

/*
 * Creates a new view on the given graph contained in an appended last child
 * to the given parent node, parent
 *
 */
function GraphView(spec) {
    var gv = {
            bubble_radius: 0,
            layout_animation: {
                interval: null,
                endtime: null,
                starttime: null,
                current: 30,
                target: 30,
                step_msec: 30,
                bubble_radius: {
                    target: 0,
                    start: 0,
                },
            },
            zoom_obj: spec.zoom_obj,
            parent_graph_zoom_obj: spec.parent_graph_zoom_obj,
        },
        temporary = spec.temporary,
        force_enabled = !spec.temporary,
        parent_element = spec.parent_element,
        graph_name = spec.graph_name,
        graph = spec.graph,
        zoom_property = spec.zoom_property,
        node_text_dx = spec.node_text_dx,
        node_text_dy = spec.node_text_dy,
        svgInput = spec.svgInput,
        zoom_obj = spec.zoom_obj,
        zoom_obj_element = spec.zoom_obj_element,
        parent_graph_zoom_obj = spec.parent_graph_zoom_obj,

        zoomInProgress = false,
        force,
        drag,
        vis,
        deliverables,
        // FIXME - want to use parent_element
        w,
        h,
        cx,
        cy,
        // FIXME take filter names from index.html or both from graph db
        filter_states = {'interest':null, 'skill':null, 'club':null, 'person':null, 'third-internship-proposal':null},
        filter_state_names = ['interest', 'skill', 'club', 'person', 'third-internship-proposal'];

    util.assert(parent_element !== undefined && graph_name !== undefined &&
                graph !== undefined && zoom_property !== undefined &&
                temporary !== undefined && force_enabled !== undefined &&
                node_text_dx !== undefined && node_text_dy !== undefined &&
                zoom_obj !== undefined && parent_graph_zoom_obj !== undefined &&
                zoom_obj_element !== undefined &&
                (temporary || svgInput !== undefined),
                "missing spec variable");

    function update_window_size() {
        w = $(document.body).innerWidth();
        h = $(document.body).innerHeight();
        cx = w / 2;
        cy = h / 2;
    }

    // update view whenever screen is resized
    $(window).asEventStream('resize').map(update_window_size).onValue(function () { update_view(false); });
    update_window_size();

    function read_checkboxes() {
        var checkboxes = $('#menu__type-filter label input').map(
        function (i, checkbox){
                return checkbox.checked;
            }
        );
        for (var i in checkboxes) {
            if (filter_state_names[i] === undefined) {
                continue;
            }
            filter_states[filter_state_names[i]] = checkboxes[i];
        }
    }

    function redraw__set_on_checkbox_change()
    {
        $(function () {
            var checkboxes = $('#menu__type-filter li').on('click', function (e) {
                e.stopPropagation();
                read_checkboxes();
                console.log(filter_states);
                update_view(true);
            });
            $('#btn_filter').on('click', function (e) {
                $('#menu__type-filter').toggle();
            });
        });
    }

    function node__is_shown(d) {
        var type = d.type;
        return temporary || filter_states[d.type];
    }

    function link__is_shown(d) {
        return node__is_shown(d.__src) && node__is_shown(d.__dst);
    }


    // Filter. FIXME: move away from here. separate element, connected via bacon property
    if (!temporary) {
        read_checkboxes();
        redraw__set_on_checkbox_change();
    }

    function range(start, end, number) {
        var ret = [],
            i,
            divisor = number <= 1 ? 1 : number - 1,
            difference = end - start;

        for (i = 0; i < number; ++i) {
            ret.push(difference * i / divisor + start);
        }
        return ret;
    }

    // TODO: nice animation FRP using Bacon combine/flatMap.
    // 0
    // 180   10
    // ..    20
    //       30
    //       40
    // 0     30
    //       20
    //       10
    //       0
    //
    //
    // Animation target is set by stream, and initialized if not already
    if (spec.bubble_property) {
        if (temporary) {
            view_bubble.Bubble(parent_element[0][0], spec.bubble_property);
        } else {
            spec.bubble_property
                .onValue(function (r) {
                    var now = (new Date()).getTime();
                    gv.layout_animation.bubble_radius.target = r;
                    gv.layout_animation.bubble_radius.start = gv.bubble_radius;
                    gv.layout_animation.starttime = now;
                    gv.layout_animation.endtime = now + 300; // FIXME: use constant change?
                    start_layout_animation();
                });
        }
    }

    graph.diffBus.onValue(function (diff) {
        var relayout = !temporary && (false == model_diff.is_attr_diff(diff));
        update_view(relayout);
    });

    function showNodeInfo(node) {
        util.assert(!temporary, "cannot showNodeInfo on a temporary graph");
        view.node_info.show(graph, node)
    }

    function dragstarted(d) {
        d3.event.sourceEvent.stopPropagation();
        d3.select(this).classed("dragging", true);
        d.dragstart = {clientX:d3.event.sourceEvent.clientX, clientY:d3.event.sourceEvent.clientY};
        if (force_enabled) {
            force.stop();
        }
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
            if (force_enabled) {
                force.resume();
            }
        }
    }

    function update_view(relayout) {
        var node,
            link,
            link_g,
            linktext,
            nodetext,
            circle,
            unselected_selector = '#' + graph_name + ' #link-group',
            selected_selector = '#' + graph_name + ' #selected-link-group',
            unselected_link_group = document.querySelector(unselected_selector),
            selected_link_group = document.querySelector(selected_selector);

        relayout = (relayout === undefined && true) || relayout;

        link = d3.select(unselected_link_group).selectAll("g.link")
            .data(graph.links(), function(d) { return d.id; });

        link_g = link.enter().append('g')
            .attr('id', function(d){ return d.id; }) // append link id to enable data->visual mapping
            .attr('class', 'link graph');

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
                    graph.links__delete([that.link.id]);
                });
                view.edge_info.show(d);
                (d3.event.shiftKey? selection.invert : selection.update)([src, dst]);
            });

        link.attr("class", function(d, i){
                var temp_and = (d.name && d.name.replace(/ /g,"")=="and" && temporary) ? "temp_and" : "";

                return ["graph link", temp_and, selection.selected_class__link(d, temporary)].join(' ');
            });

        link.selectAll('path.link')
            .attr('class', function(d) {
                return [d.state || "perm", selection.selected_class__link(d, temporary), "link graph"].join(' ');
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
            .attr("text-anchor", "middle")
            .on("click", function(d, i) {
                if (!temporary) { // FIXME: if temporary don't even put a click handler
                    svgInput.enable(this, d);
                }
            });

        linktext
            .text(function(d) {
                var name = d.name || "",
                    src_selected = selection.node_selected(d.__src),
                    dst_selected = selection.node_selected(d.__dst);

                if (!temporary && !src_selected && !dst_selected) {
                    return "";
                }
                if (temporary || name.length < 25 || src_selected || dst_selected) {
                    return name;
                } else {
                    return name.substring(0, 14) + "...";
                }
            })
            .attr("class", function(d) {
                return ["linklabel graph", selection.selected_class__link(d, temporary)].join(' ');
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

        node.attr('class', function(d) {
                return ['node', selection.selected_class__node(d, temporary)].join(' ');
            })
            .each(function (d) {
                d.zoom_obj = zoom_obj; // FIXME new object NodeView pointing to Node and Zoom
            });
        // reorder nodes so selected are last, and so rendered last, and so on top.
        // FIXME: with b-ubble removed this is probably broken. actually also before. links are not correctly ordered.
        (function () {
            var ontop = [];

            node.each(function (d) {
                    this.node = d;
                    if (selection.node_selected(d)) {
                        ontop.push(this);
                    }
                });
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
                if (selection.link_selected(d)) {
                    ontop.push(this);
                }
            });
            function moveToEnd(e) {
                e.parentNode.appendChild(e);
            }
            ontop.reverse().forEach(function (e) {
                moveToEnd(e);
            });
            var count_links = function() {
                return selected_link_group.childElementCount + unselected_link_group.childElementCount;
            };
        }); //();

        var node_url_dx = 15;
        var nodeTextX = function(d) {
            return urlValid(d) ? node_text_dx + node_url_dx : node_text_dx;
        }

        nodetext = nodeEnter.insert("text")
            .attr("class", "nodetext graph")
            .attr("dy", node_text_dy)
            .on("click", function(d, i) {
                if (d3.event.defaultPrevented) {
                    // drag happened, ignore click https://github.com/mbostock/d3/wiki/Drag-Behavior#on
                    return;
                }
                if (!temporary) {
                    svgInput.enable(this, d, nodeTextX(d));
                    (d3.event.shiftKey ? selection.invert : selection.update)([d]);
                    showNodeInfo(graph.find_node__by_id(this.parentNode.id));
                }
                d3.event.stopPropagation();
            });
        noderef = nodeEnter.insert('a')
            .attr("class", "nodeurl graph")
            .attr("transform", "translate(10,-7)")
        noderef.insert("image")
            .attr("width", "14")
            .attr("height", "14")
            .attr("xlink:href", "/static/img/url-icon.png");

        noderef_a = noderef.insert("a")
        noderef_a.insert("text")
            .attr("class", "nodetext graph")
            .attr("dy", node_text_dy);

        var urlValid = function(d) {
            return d.url !== undefined && d.url !== null && d.url.length > 0;
        };

        var nodeText = function(d) {
            var selected = selection.node_selected(d);

            if (!d.name) {
                return "_";
            }
            if (temporary || selected) {
                 return d.name;
            } else {
                if (d.name.length < 28) {
                    return d.name;
                } else {
                    return d.name.substring(0, 25) + "...";
                }
            }
        };
        node.select('g.node text')
            .text(nodeText);
        node.select('g.node a')
            .attr("xlink:href", function (d) { return d.url; })
            .attr("xlink:title", function (d) { return d.url; })
            .attr("target", "_blank")
            .attr("visibility", function(d) { return urlValid(d) ? "visible" : "hidden"; })
            .attr("pointer-events", function(d) { return urlValid(d) ? "all" : "none"; });
        node.select('g.node text')
            .attr("dx", nodeTextX);

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
                (d3.event.shiftKey ? selection.invert : selection.update)([d]);
                if(!temporary) {
                    showNodeInfo(d);
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
                        return "static/img/check.png";
                        break;
                    case "current":
                        return "static/img/wait.png";
                        break;
                    case "waiting":
                        return "static/img/cross.png";
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

        if (force_enabled) {
            if (!temporary) {
                force.nodes(graph.nodes().filter(node__is_shown))
                     .links(graph.links().filter(link__is_shown));
            }

            if (relayout) {
                force.alpha(0.1).start();
            } else {
                // XXX If we are stopped we need to update the text of the links at least,
                // and this is the simplest way
                tick();
            }
        } else {
            start_layout_animation();
        }
    }

    function segment_in_segment(inner_low, inner_high, outer_low, outer_high)
    {
        return (inner_low  >= outer_low && inner_low  < outer_high &&
                inner_high >= outer_low && inner_high < outer_high);
    }

    /**
     * For a single dimention return [scale, translate]
     *
     * If screen_low < rect_low, rect_high < screen_high
     *  returns [1, 0]
     * else returns scale and translation that will put rect in percent of screen.
     *
     * currently moves the selection to the center of the screen. The bubble effect
     * will take care it won't overlap the new (temp) nodes.
     *
     * XXX: move the minimal amount in the direction from which it is coming?
     */
    function scale_and_move(screen_low, screen_high, rect_low, rect_high, percent,
                            current_scale, current_translate)
    {
        function forward(x) { return x * current_scale + current_translate; };
        var scaled_low = forward(rect_low),
            scaled_high = forward(rect_high),
            in_view = segment_in_segment(scaled_low, scaled_high, screen_low, screen_high),
            new_scale;

        new_scale = ((rect_high === rect_low || in_view) ?
            current_scale : (screen_high - screen_low) / (rect_high - rect_low) * percent);
        new_scale = Math.min(3, Math.max(0.1, new_scale));
        return [
            in_view
            ,
            // scale to percent of screen
            new_scale
            ,
            // translate middle to middle - function because scale not determined yet
            function (scale) { return ((screen_low + screen_high) / 2 - (rect_high + rect_low) / 2 * scale); }
            ];
    }

    gv.nodes__user_visible = function(nodes) {
        if (nodes.length == 0) {
            return;
        }
        var xs = nodes.map(obj_take('x')),
            ys = nodes.map(obj_take('y')),
            x_min = Math.min.apply(null, xs),
            x_max = Math.max.apply(null, xs),
            y_min = Math.min.apply(null, ys),
            y_max = Math.max.apply(null, ys),
            current_scale = zoom_obj.scale(),
            current_translate = zoom_obj.translate(),
            screen_width = $(document.body).innerWidth(),
            screen_height = $(document.body).innerHeight(),
            x_data = scale_and_move(0, screen_width, x_min, x_max, 0.8,
                                          current_scale, current_translate[0]),
            x_in_view = x_data[0],
            x_scale = x_data[1],
            x_translate_fn = x_data[2],
            y_data = scale_and_move(0, screen_height, y_min, y_max, 0.8,
                                          current_scale, current_translate[1]),
            y_in_view = y_data[0],
            y_scale = y_data[1],
            y_translate_fn = y_data[2],
            min_scale = Math.min(x_scale, y_scale),
            x_translate = x_translate_fn(min_scale),
            y_translate = y_translate_fn(min_scale);

        if (!x_in_view || !y_in_view) {
            set_scale_translate(min_scale, [x_translate, y_translate]);
        }
    }

    var set_scale_translate = function(scale, translate) {
        var current_scale = zoom_obj.scale(),
            current_translate = zoom_obj.translate();

        if (scale === current_scale &&
            translate[0] === current_translate[0] &&
            translate[0] === current_translate[1]) {
            return;
        }
        zoom_obj.translate([translate[0], translate[1]]);
        zoom_obj.scale(scale);
        zoom_obj.event(zoom_obj_element.transition().duration(200));
    }
    gv.set_scale_translate = set_scale_translate;

    gv.update_view = update_view;
    function start_layout_animation() {
            on_interval = function() {
                var now = (new Date()).getTime(),
                    end_now = gv.layout_animation.endtime - now,
                    b_dict = gv.layout_animation.bubble_radius,
                    end_start = gv.layout_animation.endtime - gv.layout_animation.starttime,
                    now_start = now - gv.layout_animation.starttime,
                    d_current = gv.layout_animation.target - gv.layout_animation.current,
                    d_bubble_radius = b_dict.target - gv.bubble_radius,
                    step_msec = gv.layout_animation.step_msec;

                util.assert(b_dict.target !== undefined, "bubble radius target is undefined");
                // we loop some just to settle the temporary graph animation
                if (d_current == 0 && d_bubble_radius == 0) {
                    clearInterval(gv.layout_animation.interval);
                    gv.layout_animation.interval = null;
                } else {
                    if (d_current > 0) {
                        gv.layout_animation.current += 1;
                    }
                    if (d_bubble_radius != 0) {
                        if (end_now <= 0) {
                            gv.bubble_radius = b_dict.target;
                        } else {
                            gv.bubble_radius = b_dict.start +
                                (b_dict.target - b_dict.start) * (now_start / end_start);
                        }
                    }
                }
                util.assert(gv.bubble_radius !== undefined, "bug");
                tick();
            };
        if (gv.layout_animation.interval == null) {
            gv.layout_animation.interval = setInterval(on_interval, gv.layout_animation.step_msec);
        }
        if (temporary) {
            gv.layout_animation.current = 0;
        }
        on_interval();
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
            if (force_enabled) {
                force.stop();
            }
        }
        return Number.isNaN(x);
    }

    var newnodes=1;

    function temporary_set_positions() {
        //circles animation
        var tempcounter = 0,
            temptotal = graph.nodes().filter(function(d){
                return temporary && d.type !== "chainlink";
            }).length;

        if (temptotal !== newnodes) {
            newnodes += temptotal / 15 / (newnodes * newnodes);
        }
        newnodes = Math.max(1, Math.min(newnodes, temptotal));
        graph.nodes().forEach(function(d, i) {
            var r, a;
            tempcounter++;
            if (d.type === "chainlink") {
                 d.x = cx;
                 d.y = cy;
            } else {
                r = 60 + newnodes * 20;
                a = -Math.PI + Math.PI * 2 * (tempcounter - 1) / newnodes + 0.3;
                d.x = cx + r * Math.cos(a);
                d.y = cy + r * Math.sin(a);
            }
            check_for_nan(d.x);
            check_for_nan(d.y);
        });
    }

    /**
     * Transform according to the parent transform
     * @param d = {x:x, y:y}
     * @return {x:new_x, y:new_y}
     */
    function apply_node_zoom_obj(d) {
        return apply_zoom_obj(d.bx, d.by, d.zoom_obj);
    }

    function apply_zoom_obj(x, y, zoom_obj) {
        var zoom_translate = zoom_obj.translate(),
            zx = zoom_translate[0],
            zy = zoom_translate[1],
            s = zoom_obj.scale();

        return [x * s + zx, y * s + zy];
    }

    function apply_reverse_zoom_obj(x, y, zoom_obj) {
        var zoom_translate = zoom_obj.translate(),
            zx = zoom_translate[0],
            zy = zoom_translate[1],
            s = zoom_obj.scale();

        return [(x - zx) / s, (y - zy) / s];
    }

    function bubble_transform(d, bubble_radius) {
        if (bubble_radius == 0) {
            return d;
        }
        var zoom_center_point = apply_reverse_zoom_obj(cx, cy, zoom_obj),
            zcx = zoom_center_point[0],
            zcy = zoom_center_point[1],
            dx = d.x - zcx,
            dy = d.y - zcy,
            r = Math.sqrt(dx * dx + dy * dy),
            a = Math.atan2(dy, dx),
            scale = zoom_obj.scale(),
            scaled_bubble_radius = bubble_radius / scale;
            new_r = r > scaled_bubble_radius * 2 ? r : r / 2 + scaled_bubble_radius;
        // FIXME: r == 0 (or close enough)
        return {x: zcx + new_r * Math.cos(a),
                y: zcy + new_r * Math.sin(a)};
    }

    /**
     * Recomputes all link and node locations according to force layout and
     * bubble animation.
     */
    function tick(e) {
        var node = vis.selectAll(".node")
            .data(graph.nodes(), function(d) {
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
            var d2 = bubble_transform(d, gv.bubble_radius);
            d.bx = d2.x;
            d.by = d2.y;
            return "translate(" + d2.x + "," + d2.y + ")";
        }

        if (temporary) {
            temporary_set_positions();
        }

        // transform nodes first to record bubble x & y (bx & by)
        node.attr("transform", transform);

        function same_zoom(d) {
            if (d.zoom_obj === null || parent_graph_zoom_obj === null) {
                return [d.bx, d.by];
            } else {
                return apply_node_zoom_obj(d);
            }
        }

        link.attr("d", function(d, i) {
            var d_val,
                ghost;

            util.assert(d.__src && d.__dst && d.__src.x && d.__src.y &&
                        d.__dst.x && d.__dst.y, "missing src and dst points");

            var src = same_zoom(d.__src),
                dst = same_zoom(d.__dst);
            d_val = "M" + src[0] + "," + src[1] + "L" + dst[0] + "," + dst[1];
            // update ghostlink position
            ghost = $(this.nextElementSibling);
            ghost.attr("d", d_val);
            return d_val;
        });

        linktext.attr("transform", function(d) {
            var src = same_zoom(d.__src),
                dst = same_zoom(d.__dst);
            return "translate(" + (src[0] + dst[0]) / 2 + "," + (src[1] + dst[1]) / 2 + ")";
        });

        // After initial placement we can make the nodes visible.
        node.attr('visibility', function (d, i) {
                 return node__is_shown(d) ? 'visible' : 'hidden';
             });
        link.attr('visibility', function (d, i) {
                 return link__is_shown(d) ? 'visible' : 'hidden';
             });
    }

    // SVG rendering order is last rendered on top, so to make sure
    // all links are below the nodes we group them under a single g
    vis = parent_element.append("g");
    vis.attr("id", graph_name);
    vis.append("g").attr("id", "link-group");
    vis.append("g").attr("id", "selected-link-group");

    drag = d3.behavior.drag()
             .origin(function(d) { return d; })
             .on("dragstart", dragstarted)
             .on("drag", dragged)
             .on("dragend", dragended);

    var redrawBus = new Bacon.Bus();
    redrawBus.onValue(tick);
    var pushRedraw = function() { redrawBus.push(null); };

    if (spec.parent_graph_zoom_obj) {
        var existing_zoom_cb = spec.parent_graph_zoom_obj.on('zoom');
        spec.parent_graph_zoom_obj.on('zoom', function () {
            existing_zoom_cb.apply(null, arguments);
            pushRedraw(null);
        })
    }

    function init_force_layout() {
        force = d3.layout.force()
                  .distance(120)
                  .gravity(0.12)
                  .charge(-1800)
                  .size([w, h])
                  .on("tick", pushRedraw)
                  .start();
    }

    if (force_enabled) {
        init_force_layout();
    }

    zoom_property.onValue(function (val) {
        zoomInProgress = val;
        tick();
    });
    return gv;
}

return {
    GraphView: GraphView,
};

});
