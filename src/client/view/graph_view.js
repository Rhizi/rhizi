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

define(['d3', 'Bacon', 'util', 'view/selection', 'view/helpers', 'model/diff', 'view/view'],
function(d3 ,  Bacon ,  util ,  selection      ,  view_helpers,  model_diff  ,  view) {

/*
 * Creates a new view on the given graph contained in an appended last child
 * to the given parent node, parent
 *
 */
function GraphView(spec) {
    var temporary = spec.temporary,
        force_enabled = !spec.temporary,
        parent_element = spec.parent_element,
        graph_name = spec.graph_name, 
        graph = spec.graph,
        zoom_property = spec.zoom_property,
        node_text_dx = spec.node_text_dx,
        node_text_dy = spec.node_text_dy,
        svgInput = spec.svgInput,

        bubble_radius = 0,
        zoomInProgress = false,
        force,
        drag,
        vis,
        // FIXME - want to use parent_element
        w = $(document.body).innerWidth(),
        h = $(document.body).innerHeight(),
        cx = w / 2,
        cy = h / 2;

    util.assert(parent_element !== undefined && graph_name !== undefined &&
                graph !== undefined && zoom_property !== undefined &&
                temporary !== undefined && force_enabled !== undefined &&
                node_text_dx !== undefined && node_text_dy !== undefined &&
                (temporary || svgInput !== undefined),
                "missing spec variable");
    
    zoom_property.onValue(function (val) {
        zoomInProgress = val;
    });

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
        spec.bubble_property.skipDuplicates()
        .flatMap(function (r) {
            // lame animation - works, but doesn't handle more events while
            // animating
            return Bacon.sequentially(20, range(bubble_radius, r, 10));
        })
        .onValue(function (r) {
            bubble_radius = r;
            update_view(false);
        });
    }

    graph.diffBus.onValue(function (diff) {
        var relayout = !temporary && (false == model_diff.is_attr_diff(diff));
        if (relayout) {
            console.log('****** ' + graph_name + ' graph relayout *******');
        } else {
            console.log('****** ' + graph_name + ' graph update   *******');
        }
        console.dir(diff);
        update_view(relayout);
    });

    function showNodeInfo(node, i) {
        var closed = false;

        util.assert(!temporary, "cannot showNodeInfo on a temporary graph");

        view.node_info.on_save(function(e, form_data) {
            closed = true;
            graph.update_node(node, form_data, function() {
                var old_type = node.type,
                    new_type = form_data.type;

            });
            view.node_info.hide();
            return false;
        });

        // FIXME - attribute diff, ignore uninteresting diffs via filtering
        graph.diffBus.onValue(function () {
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
            graph.commit_and_tx_diff__topo(topo_diff);
        });

        view.node_info.show(node);
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
            unselected_selector = '#' + graph_name + ' #link-group',
            selected_selector = '#' + graph_name + ' #selected-link-group',
            unselected_link_group = document.querySelector(unselected_selector),
            selected_link_group = document.querySelector(selected_selector);

        relayout = relayout || true;

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
                    graph.removeLink(that.link);
                });
                view.edge_info.show(d);
                selection.update([src, dst]);
            });

        link.attr("class", function(d, i){
                var temp_and = (d.name && d.name.replace(/ /g,"")=="and" && temporary) ? "temp_and" : "";

                return ["graph link", temp_and, selection.selected_class(d)].join(' ');
            });

        link.selectAll('path.link')
            .attr('class', function(d) {
                return [d.state || "perm", selection.selected_class(d), "link graph"].join(' ');
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
                if (!temporary) { // FIXME: if temporary don't even put a click handler
                    svgInput.enable(this, d);
                }
            });

        linktext
            .text(function(d) {
                var name = d.name || "";
                if (!(temporary ||
                    d.__src.state === "chosen" || d.__dst.state === "chosen")) {
                    return "";
                }
                if (name.length < 25 || d.__src.state === "chosen" ||
                    d.__dst.state === "chosen" || temporary) {
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
        console.log("update update update update");
        console.dir(node);

        var nodeEnter = node.enter()
            .append("g")
            .attr('id', function(d){ return d.id; }) // append node id to enable data->visual mapping
            .attr('visibility', 'hidden') // made visible on first tick
            .call(drag);

        // reorder nodes so selected are last, and so rendered last, and so on top.
        // FIXME: with b-ubble removed this is probably broken. actually also before. links are not correctly ordered.
        (function () {
            var ontop = [];

            node.each(function (d) {
                    this.node = d;
                })
                .attr('class', function(d) {
                    if (selection.node_selected(d)) {
                        ontop.push(this);
                    }
                    return ['node', selection.selected_class(d)].join(' ');
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
                if (selection.node_selected(d)) {
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
                if (!temporary) {
                    svgInput.enable(this, d);
                    selection.update([d]);
                    showNodeInfo(this.parentNode.node, i);
                }
                d3.event.stopPropagation();
            });

        node.select('g.node text')
            .text(function(d) {
                if (!d.name) {
                    return "_";
                }
                if (temporary || d.state === 'chosen'
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
                if(!temporary) {
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

        if (force_enabled) {
            force.nodes(graph.nodes())
                 .links(graph.links());

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

    function start_layout_animation() {
        var interval_id,
            count = 0,
            on_interval = function() {
                tick();
                count += 1;
                if (count > 30) {
                    clearInterval(interval_id);
                    console.log('stopping layout animation ' + interval_id);
                }
            };
        interval_id = setInterval(on_interval, 30);
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
                a = -Math.PI + Math.PI * 2 * (tempcounter-1) / newnodes + 0.3;
                console.log(tempcounter);
                d.x = cx + r * Math.cos(a);
                d.y = cy + r * Math.sin(a);
            }
            check_for_nan(d.x);
            check_for_nan(d.y);
        });
    }

    function bubble_transform(d) {
        if (bubble_radius == 0) {
            return d;
        }
        var dx = d.x - cx,
            dy = d.y - cy,
            r = Math.sqrt(dx * dx + dy * dy),
            a = Math.atan2(dy, dx);
        // FIXME: r == 0 (or close enough)
        return {x: cx + (r + bubble_radius) * Math.cos(a),
                y: cy + (r + bubble_radius) * Math.sin(a)};
    }

    function tick(e) {
        //console.log(e);
        //$(".debug").html(force.alpha());
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
            var d2 = bubble_transform(d);
            return "translate(" + d2.x + "," + d2.y + ")";
        }

        if (temporary) {
            temporary_set_positions();
        }

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

    function init_force_layout() {
        force = d3.layout.force()
                  .distance(120)
                  .gravity(0.12)
                  .charge(-1800)
                  .size([w, h])
                  .on("tick", tick)
                  .start();
    }

    if (force_enabled) {
        init_force_layout();
    }
    return {
        update_view: update_view,
    };
}

return {
    GraphView: GraphView,
};
    
});
