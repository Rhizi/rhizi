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

define(['d3',  'jquery', 'underscore', 'Bacon', 'consts', 'util', 'view/selection', 'model/diff', 'view/item_info', 'view/bubble', 'model/types', 'view/layouts', 'view/filter'],
function(d3 ,  $       , _           ,  Bacon ,  consts,   util ,  selection      ,  model_diff  ,  item_info,        view_bubble,   model_types,   view_layouts,  view_filter) {

"use strict";

// aliases
var obj_take = util.obj_take;

// constants (that should be moved somewhere else)
var node_url_dx = 15;

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
    };
    graph.diffBus.onValue(function (diff) {
        debugView.append(diff);
    });
}

function translate(x, y) {
    if (x === undefined || y === undefined) {
        console.log('oops, undefined translate');
    }
    return "translate(" + x + "," + y + ")";
}

// "CSS" for SVG elements. Reused for editing elements.
var node_text_dx = 5,
    node_text_dy = '.30em';

/*
 * Creates a new view on the given graph contained in an appended last child
 * to the given parent node, parent
 *
 */
function GraphView(spec) {
    var parent_element = spec.parent_element,
        gv = {
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
            parent_element: parent_element,
        },
        temporary = spec.temporary,
        force_enabled = !spec.temporary,
        graph_name = spec.graph_name,
        graph = spec.graph,
        zoom_property = spec.zoom_property,
        svgInput = spec.svgInput,
        zoom_obj = spec.zoom_obj,
        zoom_obj_element = spec.zoom_obj_element,
        parent_graph_zoom_obj = spec.parent_graph_zoom_obj,

        layout_menu = $('#btn_layout'),

        zoomInProgress = false,
        layout,
        drag,
        vis,
        filter_states,

        zen_mode = false,
        zen_mode__layout = view_layouts.zen_layout.create(graph),
        zen_mode__auto_center = false,
        zen_mode__prev_layout = null,

        // FIXME - want to use parent_element
        w,
        h,
        cx,
        cy;

    util.assert(parent_element !== undefined && graph_name !== undefined &&
                graph !== undefined && zoom_property !== undefined &&
                temporary !== undefined && force_enabled !== undefined &&
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

    // read updated filter states from filters view
    view_filter.filter_states_bus.onValue(function (new_states) {
        filter_states = new_states;
        graph.node__set_filtered_types(filter_states);
        update_view(true);
    });

    function node__pass_filter(d) {
        var state = filter_states && filter_states[d.type];

        return temporary || state === undefined || state;
    }

    function link__pass_filter(d) {
        return node__pass_filter(d.__src) && node__pass_filter(d.__dst);
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

    var selection_outer_radius = 0; //200;

    graph.diffBus.onValue(function (diff) {
        var relayout = !temporary && (false === model_diff.is_attr_diff(diff)),
            have_position = 0,
            layout_x_key = graph.layout_x_key(layout.name),
            layout_y_key = graph.layout_y_key(layout.name),
            layout_fixed_key = graph.layout_fixed_key(layout.name),
            nodes_from_attr_diff = function() { var ret = []; diff.for_each_node(function (nid) { ret.push(graph.find_node__by_id(nid)); }); return ret; },
            changed_nodes = diff.node_set_add || (diff.for_each_node && nodes_from_attr_diff()) || [],
            is_full_graph_update = false,
            nodes = graph.nodes();

        // copy position from diff based on current layout
        if (layout.name) {
            changed_nodes.forEach(function (node) {
                if (node[layout_x_key] && node[layout_y_key]) {
                    node.x = node[layout_x_key];
                    node.y = node[layout_y_key];
                    node.fixed = node[layout_fixed_key];
                    have_position += 1;
                }
            });
            is_full_graph_update = (have_position === nodes.length);
            if (have_position > 0) {
                console.log('loading layout last position from database for layout ' + layout.name);
                layout__load_graph();
                if (is_full_graph_update) {
                    console.log('no relayout because diff contains all graph nodes');
                    relayout = false;
                }
            }
        }
        if (!temporary && !relayout && have_position === 0) {
            // avoid recursion due to layout triggering sending of new positions to db, resulting in a new diff update
            return;
        }
        if (is_full_graph_update) {
            layout__set_from_nodes(layout.name, changed_nodes);
        }
        update_view(relayout);
    });

    function layout__set_from_nodes(name, nodes) {
        var layout_ = layouts.filter(function (layout_) { return layout_.name === name; })[0],
            layout_x_key = graph.layout_x_key(layout_.name),
            layout_y_key = graph.layout_y_key(layout_.name),
            nodes_with_x_y = nodes.map(function (node) {
                var x = node[layout_x_key],
                    y = node[layout_y_key];

                if (!x || !y) {
                    return undefined;
                }
                return {id: node.id, x: x, y: y};
            }).filter(function (datum) { return datum !== undefined; });

        layout_.save_from_arr_id_x_y(nodes_with_x_y);
    }

    function transformOnSelection(data) {
        var selection = data[0],
            selection_inner_radius = Math.max(30, data[1]);

        console.log('new selection of');
        console.log(' ' + selection.root_nodes.length + ' root nodes');
        console.log(' ' + selection.nodes.length + ' highlighted nodes');
        console.log(' inner radius ' + selection_inner_radius);
        // remove existing fixed if set by us
        graph.nodes().forEach(function (n) {
            if (n.__selection) {
                n.x = n.px = n.__selection.x;
                n.y = n.py = n.__selection.y;
                n.fixed = n.__selection.fixed;
                delete n.__selection;
            }
        });
        // fix position of selected nodes
        var count = selection.root_nodes.length,
            zoom_center_point = graph_to_screen(cx, cy, zoom_obj),
            zcx = zoom_center_point[0],
            zcy = zoom_center_point[1],
            s = zoom_obj.scale(),
            scaled_inner_radius = selection_inner_radius / s,
            scaled_outer_radius = selection_outer_radius / s,
            max_radius = Math.sqrt(_.max(selection.root_nodes.map(
                function (n) { return n.x * n.x + n.y * n.y; }))) / s;

        function screen_to_graph(xy) {
            return [zcx + xy[0], zcy + xy[1]];
        }
        // order by angle
        var nodes = _.pluck(selection.root_nodes.map(function (n) { return [Math.atan2(n.y, n.x), n]; }).sort(), 1);
        nodes.forEach(function (n, i) {
            var newp;
            n.__selection = {
                fixed: n.fixed,
                x: n.x,
                y: n.y
            };
            n.fixed = true;
            newp = screen_to_graph(
                rtheta_to_xy([(scaled_inner_radius + scaled_outer_radius) / 2, i * Math.PI * 2 / count]));
            n.x = n.px = newp[0];
            n.y = n.py = newp[1];
        });
        resumeLayout();
    }
    // on every selection change that isn't null set the selected nodes to fixed
    if (selection_outer_radius > 0 && !temporary) {
        Bacon.update(
            [{root_nodes: [], nodes: []}, gv.bubble_radius],
            [selection.selectionChangedBus], function (data, new_selection) { return [new_selection, data[1]]; },
            [spec.bubble_property], function (data, radius) { return [data[0], radius]; }
        ).skip(1).onValue(transformOnSelection);
    }

    selection.selectionChangedBus.onValue(function () {
        if (zen_mode) {
            zen_mode__auto_center = true;
            layout__reset(1.0);
        }
    });

    function showNodeInfo(node) {
        util.assert(!temporary, "cannot showNodeInfo on a temporary graph");
        item_info.show(graph, node);
    }

    function dragstarted(d) {
        d3.event.sourceEvent.stopPropagation();
        d3.select(this).classed("dragging", true);
        d.dragstart = {clientX:d3.event.sourceEvent.clientX, clientY:d3.event.sourceEvent.clientY};
        d.fixed = true;
        layout.stop();
    }

    function dragged(d) {
        d.px = d.x = d3.event.x;
        d.py = d.y = d3.event.y;
        tick();
    }

    function setupInitialPositions()
    {
        var links = graph.links(),
            i = 0,
            link;

        // right thing: place node opposite center of mass of existing links
        for (i = 0 ; i < links.length ; ++i) {
            link = links[i];
            if ((link.__src.x === undefined || link.__src.y === undefined) &&
                (link.__dst.x !== undefined && link.__dst.y !== undefined)) {
                link.__src.x = link.__dst.x;
                link.__src.y = link.__dst.y;
            }
            if ((link.__dst.x === undefined || link.__dst.y === undefined) &&
                (link.__src.x !== undefined && link.__dst.y !== undefined)) {
                link.__dst.x = link.__src.x;
                link.__dst.y = link.__src.y;
            }
            // TODO: collect links that are totally disconnected. here the default d3 force
            // placement (w/h) makes some sense.
        }
        // TODO: node placement by default - middle of screen?
    }

    function resumeLayout() {
        setupInitialPositions();
        layout.alpha(0.05);
    }

    function dragended(d) {
        d3.select(this).classed("dragging", false);
        d3.select(this).classed("fixed", true); // TODO: this is broken since we override all the classes. Need to switch to class addition/removal (i.e. use classed for everything) or set class in one location (so here just set a value on the node, not the element)
        if (d.dragstart.clientX - d3.event.sourceEvent.clientX !== 0 ||
            d.dragstart.clientY - d3.event.sourceEvent.clientY !== 0) {
            d.fixed = true;
            d.px = d.x;
            d.py = d.y;
            tick();
            if (layout.name === 'custom') {
                graph.nodes__store_layout_positions(layout.name, [d.id]);
            }
        }
    }

    var urlValid = function(url) {
        return url !== undefined && url !== null && url.length > 0 && url.slice(0, 4) === 'http';
    };

    var urlImage = function(url) {
        return urlValid(url);
    };

    function nodes__filtered() {
        return graph.nodes().filter(node__pass_filter);
    }

    function nodes__visible() {
        return zen_mode ? selection.related_nodes() : nodes__filtered();
    }

    function links__filtered() {
        return graph.links().filter(link__pass_filter);
    }

    function links__visible() {
        return zen_mode ? graph.find_links__by_nodes(selection.related_nodes()) : links__filtered();
    }

    function node__transform(d) {
        return translate(d.bx, d.by);
    }

    function model_id_from_dom_id(dom_id) {
        return dom_id.split('__')[0];
    }

    function node__radius (d) {
        return urlValid(d['image-url']) ? 20 : 10;
    }
    function filter_id(id) {
        return id + '__node_filter';
    }
    function feimage_id(id) {
        return id + '__node_filter_feimage';
    }
    function clip_path_id(id) {
        return id + '__node_clip_path';
    }
    function svg_url(id) {
        return 'url(#' + id + ')';
    }

    var node__text_x = function(d) {
        return node_text_dx + node__radius(d) + (urlValid(d.url) ? node_url_dx : 0);
    };

    function graphics__node_text(node) {
    }

    function update_view(relayout) {
        var node,
            link,
            link_g,
            link_text,
            circle,
            unselected_selector = '#' + graph_name + ' #link-group',
            selected_selector = '#' + graph_name + ' #selected-link-group',
            unselected_link_group = document.querySelector(unselected_selector),
            selected_link_group = document.querySelector(selected_selector),
            visible_nodes = nodes__visible(),
            visible_links = links__visible();

        function set_data_by_id(d3e, data) {
            return d3e.data(data, function (d) {
                return d.id;
            });
        }

        function node_text_setup() {
            var node_text;

            node_text = set_data_by_id(vis.selectAll("g.nodetext"), visible_nodes);
            node_text.enter().insert('g')
                .attr('id', function (d) { return text_node_id(d.id); })
                .attr("class", "nodetext graph")
                .on("click", function(d, i) {
                    if (d3.event.defaultPrevented) {
                        // drag happened, ignore click https://github.com/mbostock/d3/wiki/Drag-Behavior#on
                        return;
                    }
                    if (!temporary) {
                        svgInput.enable(this.querySelector('text'), d, node__text_x(d));
                        (d3.event.shiftKey ? selection.invert_nodes : selection.select_nodes)([d]);
                        showNodeInfo(graph.find_node__by_id(model_id_from_dom_id(this.id)));
                    }
                    d3.event.stopPropagation();
                })
                .insert("text")
                .attr("dy", node_text_dy);
            node_text.exit().remove();
            var nodeText = function(d) {
                var selected = selection.node_related(d);

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
            node_text.select('text').text(nodeText)
                .attr("dx", node__text_x);
            node_text.attr('class', function(d) {
                    return ['nodetext graph', selection.class__node(d, temporary)].join(' ');
                });
        }

        /*
         * @this - the element being hovered on. Could use d.id instead
         */
        var link__hover__start = function (d) {
            var e = document.getElementById(d.id);

            add_class(e, 'hovering');
            // show text if not selected
            if (!selection.link_related(d)) {
                set_link_label_text(d.id, link_text__short(d));
            }
        };
        gv.link__hover__start = link__hover__start;

        var link__hover__end = function (d) {
            var e = document.getElementById(d.id);

            remove_class(e, 'hovering');
            // hide text if not selected
            if (!selection.link_related(d)) {
                set_link_label_text(d.id, "");
            }
        };
        gv.link__hover__end = link__hover__end;

        var link_on_hover = function (d) {
            $('#' + d.id).hover(function (e) {
                link__hover__start(d);
            }, function (e) {
                link__hover__end(d);
            });
        };

        gv.node__hover__start = function (d) {
            var e = document.getElementById(d.id);

            add_class(e, 'hovering');
        };

        gv.node__hover__end = function (d) {
            var e = document.getElementById(d.id);

            remove_class(e, 'hovering');
        };

        relayout = (relayout === undefined && true) || relayout;

        link = set_data_by_id(d3.select(unselected_link_group).selectAll("g.link"), visible_links);

        // link group - container for paths. Created after text so it is above (see z-order for SVG 1.1)
        link_g = link.enter()
            .append('g')
            .attr('id', function(d){ return d.id; }) // append link id to enable data->visual mapping
            .attr('class', 'link graph');

        link_g
            .append("path")
            .attr("class", function(d) {
                return d.state + ' link graph';
            })
            .attr('id', function(d){ return d.id; }) // append link id to enable data->visual mapping
            .attr("marker-end", "url(#end)");

        // second path for larger click area
        link_g
            .append("path")
            .attr("class", "ghostlink");

        // add link label third
        link_g
            .append("text")
            .attr('id', function(d){ return text_link_id(d.id); }) // append link id to enable data->visual mapping
            .attr("text-anchor", "middle")
            .attr("class", "linklabel graph")
            .on("click", function(d) {
                if (!temporary) { // FIXME: if temporary don't even put a click handler
                    svgInput.enable(this, d);
                }
            });

        function text_link_id(id) {
            return id + '__link_text';
        }

        function text_node_id(id) {
            return id + '__node_text';
        }

        function visit_one_down(base, visitor) {
            visitor(base);
            _.forEach(base.childNodes, visitor);
        }
        function add_class(base, clazz) {
            visit_one_down(base, function (e) { e.classList && e.classList.add(clazz); });
        }
        function remove_class(base, clazz) {
            visit_one_down(base, function (e) { e.classList && e.classList.remove(clazz); });
        }
        function set_link_label_text(link_id, text) {
            $('#' + text_link_id(link_id)).text(text);
        }

        link_g.each(function (d) {
                link_on_hover(d);
            });
        link_g.on("click", function(d) {
                if (zoomInProgress) {
                    // don't disable zoomInProgress, it will be disabled by the svg_click_handler
                    // after this events bubbles to the svg element
                    return;
                }
                item_info.show(graph, d, ['name']);
                (d3.event.shiftKey? selection.invert_link : selection.select_link)(this.link);
            });

        //var selected_N = selection:

        link.attr("class", function(d){
                var temp_and = (d.name && d.name.replace(/ /g,"") === "and" && temporary) ? "temp_and" : "";

                return ["graph link", temp_and, selection.class__link(d, temporary)].join(' ');
            });

        link.selectAll('path.link')
            .attr('class', function(d) {
                return [d.state || "perm", selection.class__link(d, temporary), "link graph"].join(' ');
            });

        link.exit().remove();

        set_data_by_id(vis.selectAll('g.link'), visible_links)
            .each(function (d) {
                this.link = d;
            });

        function link_text__short(d) {
            var name = d.name || "";

            if (temporary || name.length < consts.link_text_short_length + 3) {
                return name;
            }
            return name.substring(0, consts.link_text_short_length) + "...";
        }

        link_text = set_data_by_id(vis.selectAll(".linklabel"), visible_links);

        link_text
            .text(function(d) {
                var related = selection.link_related(d);

                if (!temporary && !related) {
                    return "";
                }
                if (related) {
                    return d.name;
                }
                return link_text__short(d);
            })
            .attr("class", function(d) {
                return ["linklabel graph", selection.class__link(d, temporary)].join(' ');
            });

        link_text.exit().remove();

        node = set_data_by_id(vis.selectAll(".node"), visible_nodes);

        node_text_setup();

        var nodeEnter = node.enter()
            .append("g")
            .attr('id', function(d) {
                return d.id;
            }) // append node id to enable data->visual mapping
            .call(drag);

        node.attr('class', function(d) {
                return ['node' +" " + d.type + " " + d.state + " " + "graph", selection.class__node(d, temporary)].join(' ');
            })
            .each(function (d) {
                d.zoom_obj = zoom_obj; // FIXME new object NodeView pointing to Node and Zoom
                d.width = 900;
                d.height = 900;
            });

        function load_image(element, image_url) {
            var image = new Image();

            image.onload = function () {
                var aspect = this.height / this.width,
                    width = Math.min(100, this.width);

                element.setAttribute("width", width);
                element.setAttribute("height", Math.min(width * aspect, this.height));
                element.setAttributeNS("http://www.w3.org/1999/xlink", "href", this.src);
            };
            image.src = image_url;
        }

        var noderef = nodeEnter.insert('a')
            .attr("class", "nodeurl graph")
            .attr("dy", node_text_dy);
        noderef.insert("image");

        node.select('g.node a')
            .attr("xlink:href", function (d) { return d.url; })
            .attr("xlink:title", function (d) { return d.url; })
            .attr("target", "_blank")
            .attr("visibility", function(d) { return urlValid(d.url) ? "visible" : "hidden"; })
            .attr("pointer-events", function(d) { return urlValid(d.url) ? "all" : "none"; })
            .attr("transform", function (d) {
                return urlValid(d['image-url']) ? "translate(22,-7)" : "translate(10, -7)";
            });
        node.select('g.node > a > image')
            .each(function () {
                load_image(this, "/static/img/url-icon.png");
            });

        function node__click_handler(d, _i) {
            if (d3.event.defaultPrevented) {
                // drag happened, ignore click https://github.com/mbostock/d3/wiki/Drag-Behavior#on
                return;
            }
            d3.event.stopPropagation();
            (d3.event.shiftKey ? selection.invert_nodes : selection.select_nodes)([d]);
            if(!temporary) {
                showNodeInfo(d);
            }
        }

        var filter_group = d3.select('.nodefilter-group').selectAll(".nodefilter")
            .data(visible_nodes, function (d) { return d.id; });
        var filter = filter_group.enter()
            .insert('filter')
            .attr('class', 'nodefilter')
            .attr('id', function(d) {
                return filter_id(d.id);
            })
            .attr('x', '0%')
            .attr('y', '0%')
            .attr('width', '100%')
            .attr('height', '100%')
                .insert('feImage')
                .attr('class', 'nodefilter_feimage')
                .attr('id', function (d) { return feimage_id(d.id); });

        d3.selectAll('.nodefilter_feimage')
            .data(visible_nodes, function (d) { return d.id; })
            .attr('xlink:href', function (d) {
                return d['image-url'];
            });
        if (!temporary) {
            // FIXME: defs per graph
            filter_group.exit().remove();
        }

        var clip_path = nodeEnter
            .append('clipPath')
            .attr('class', 'node_clippath')
            .attr('id', function (d) { return clip_path_id(d.id); })
                .append('circle')
                .attr('cx', 0)
                .attr('cy', 0);
        d3.selectAll('.node_clippath circle')
            .data(visible_nodes, function (d) { return d.id; })
            .attr('r', node__radius);
        circle = nodeEnter.insert("circle");
        node.select('g.node > circle')
            .attr("r", node__radius)
            .attr("filter", function (d) {
                return urlImage(d['image-url']) ? svg_url(filter_id(d.id)) : '';
            })
            .attr("clip-path", function (d) {
                return urlImage(d['image-url']) ? svg_url(clip_path_id(d.id)) : '';
            })
            .on("click", node__click_handler);
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
                    case "current":
                        return "static/img/wait.png";
                    case "waiting":
                        return "static/img/cross.png";
                }
            });

        node.exit().remove();

        if (force_enabled) {
            if (!temporary) {
                layout__load_graph();
            }

            if (relayout) {
                layout__reset(0.01);
            } else {
                layout.start().alpha(0.0001);
                tick(); // this will be called before the end event is triggered by layout completing.
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
        function forward(x) { return x * current_scale + current_translate; }
        var scaled_low = forward(rect_low),
            scaled_high = forward(rect_high),
            in_view = segment_in_segment(scaled_low, scaled_high, screen_low, screen_high),
            new_scale;

        new_scale = (screen_high - screen_low) / (rect_high - rect_low) * percent;
        new_scale = Math.min(3, Math.max(0.1, new_scale));
        return [
            in_view,
            // scale to percent of screen
            new_scale,
            // translate middle to middle - function because scale not determined yet
            function (scale) { return ((screen_low + screen_high) / 2 - (rect_high + rect_low) / 2 * scale); }
            ];
    }

    function nodes__user_visible(nodes, zoom_if_visible, duration) {
        if (nodes.length === 0) {
            return;
        }
        var ratio_used = 0.8,
            xs = nodes.map(obj_take('x')),
            ys = nodes.map(obj_take('y')),
            x_min = Math.min.apply(null, xs),
            x_max = Math.max.apply(null, xs),
            y_min = Math.min.apply(null, ys),
            y_max = Math.max.apply(null, ys),
            current_scale = zoom_obj.scale(),
            current_translate = zoom_obj.translate(),
            screen_width = $(document.body).innerWidth(),
            screen_height = $(document.body).innerHeight(),
            x_data = scale_and_move(0, screen_width, x_min, x_max, ratio_used,
                                          current_scale, current_translate[0]),
            x_in_view = x_data[0],
            x_scale = x_data[1],
            x_translate_fn = x_data[2],
            y_data = scale_and_move(0, screen_height, y_min, y_max, ratio_used,
                                          current_scale, current_translate[1]),
            y_in_view = y_data[0],
            y_scale = y_data[1],
            y_translate_fn = y_data[2],
            min_scale = Math.min(x_scale, y_scale),
            x_translate = x_translate_fn(min_scale),
            y_translate = y_translate_fn(min_scale);

        if (zoom_if_visible || (!x_in_view || !y_in_view)) {
            set_scale_translate(min_scale, [x_translate, y_translate], duration);
        }
    }
    gv.nodes__user_visible = nodes__user_visible;

    var set_scale_translate = function(scale, translate, duration) {
        var current_scale = zoom_obj.scale(),
            current_translate = zoom_obj.translate();
        duration = duration || 0;

        if (scale === current_scale &&
            translate[0] === current_translate[0] &&
            translate[0] === current_translate[1]) {
            return;
        }
        zoom_obj.translate([translate[0], translate[1]]);
        zoom_obj.scale(scale);
        zoom_obj.event(zoom_obj_element.transition().duration(duration));
    };
    gv.__set_scale_translate = set_scale_translate;

    var scale__absolute = function (new_scale) {
        var t = zoom_obj.translate(),
            s = zoom_obj.scale(),
            ds = new_scale - s,
            w = window.innerWidth,
            h = window.innerHeight;

        set_scale_translate(new_scale, [t[0] - ds * w / 2, t[1] - ds * h / 2], 200);
    };

    gv.scale__absolute = scale__absolute;

    gv.update_view = update_view;
    function start_layout_animation() {
        var on_interval = function() {
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
            if (d_current === 0 && d_bubble_radius === 0) {
                clearInterval(gv.layout_animation.interval);
                gv.layout_animation.interval = null;
            } else {
                if (d_current > 0) {
                    gv.layout_animation.current += 1;
                }
                if (d_bubble_radius !== 0) {
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
        if (gv.layout_animation.interval === null) {
            gv.layout_animation.interval = setInterval(on_interval, gv.layout_animation.step_msec);
        }
        if (temporary) {
            gv.layout_animation.current = 0;
        }
        on_interval();
    }

    function check_for_nan(x) {
        if (isNaN(x)) {
            console.log('nan problem');
            layout.stop();
        }
        return isNaN(x);
    }

    var newnodes=1;

    function circle__set_positions() {
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
            r = 60 + newnodes * 20;
            a = -Math.PI + Math.PI * 2 * (tempcounter - 1) / newnodes + 0.3;
            d.x = cx + r * Math.cos(a);
            d.y = cy + r * Math.sin(a);
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

    function graph_to_screen(x, y, zoom_obj) {
        var zoom_translate = zoom_obj.translate(),
            zx = zoom_translate[0],
            zy = zoom_translate[1],
            s = zoom_obj.scale();

        return [(x - zx) / s, (y - zy) / s];
    }

    function xy_to_rtheta(xy) {
        var x = xy[0], y = xy[1];
        return [Math.sqrt(x * x + y * y), Math.atan2(y, x)];
    }
    function rtheta_to_xy(rtheta) {
        var r = rtheta[0], theta = rtheta[1];
        return [r * Math.cos(theta), r * Math.sin(theta)];
    }

    /**
     * angle preserving transform.
     *
     * TODO: split back to zoom transform and ring transform
     *
     * In the range axis the transform is:
     * [0, bubble_radius * 2] => [bubble_radius, bubble_radius * 2] linearly
     * [bubble_radius * 2, inf] => identify
     */
    function bubble_transform(d, bubble_radius) {
        if (bubble_radius === 0) {
            return d;
        }
        var zoom_center_point = graph_to_screen(cx, cy, zoom_obj),
            zcx = zoom_center_point[0],
            zcy = zoom_center_point[1],
            dx = d.x - zcx,
            dy = d.y - zcy,
            r = Math.sqrt(dx * dx + dy * dy),
            a = Math.atan2(dy, dx),
            scale = zoom_obj.scale(),
            scaled_bubble_radius = bubble_radius / scale,
            new_r = r > scaled_bubble_radius * 2 ? r : r / 2 + scaled_bubble_radius;
        // FIXME: r == 0 (or close enough)
        return {x: zcx + new_r * Math.cos(a),
                y: zcy + new_r * Math.sin(a)};
    }

    function ring_transform(xy, inner_radius, outer_radius, max_radius) {
        var rtheta = xy_to_rtheta(xy),
            r = rtheta[0], theta = rtheta[1],
            dr = outer_radius - inner_radius,
            //rout = Math.max(inner_radius, Math.min(outer_radius, r));
            rout = dr * r / max_radius + inner_radius;
        //console.log([inner_radius, outer_radius, max_radius, r, rout]);
        return rtheta_to_xy([rout, rtheta[1]]);
    }

    function handle_space(e, node) {
        (e.shiftKey? selection.invert_nodes : selection.select_nodes)([node]);
    }

    function handle_enter(e, node) {
        showNodeInfo(node);
    }

    var keyboard_handlers = _.object([
        [consts.VK_SPACE, handle_space],
        [consts.VK_ENTER, handle_enter],
    ]);

    function keyboard_handler(e) {
        var target_node = graph.find_node__by_id(e.target.id);

        if (null === target_node ||
            undefined === keyboard_handlers[e.keyCode]) {
            return;
        }
        keyboard_handlers[e.keyCode](e, target_node);
        e.preventDefault();
        e.stopPropagation();
    }
    gv.keyboard_handler = keyboard_handler;

    /**
     * Recomputes all link and node locations according to force layout and
     * bubble animation.
     */
    function tick(e) {
        var node = vis.selectAll(".node"),
            link = vis.selectAll("path.link"),
            link_text = vis.selectAll(".linklabel"),
            node_text = vis.selectAll("g.nodetext"),
            bubble_radius = temporary ? 0 : gv.bubble_radius;

        if (temporary) {
            // XXX convert to a layout
            circle__set_positions();
        }

        // XXX This computes every node ignoring filter.
        node.each(function (d) {
            if (check_for_nan(d.x) || check_for_nan(d.y)) {
                return;
            }
            if (d.x === undefined || d.y === undefined) {
                console.log('oops, undefined position');
            }
            var d2 = d.__selection !== undefined ? d : bubble_transform(d, bubble_radius);
            d.bx = d2.x;
            d.by = d2.y;
        });

        // transform nodes first to record bubble x & y (bx & by)
        node.attr("transform", node__transform);
        node_text.attr("transform", node__transform);

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

            util.assert(d.__src && d.__dst &&
                        d.__src.x !== undefined && d.__src.y !== undefined &&
                        d.__dst.x !== undefined && d.__dst.y !== undefined,
                        "missing src and dst points");

            var src = same_zoom(d.__src),
                dst = same_zoom(d.__dst);
            d_val = "M" + src[0] + "," + src[1] + "L" + dst[0] + "," + dst[1];
            // update ghostlink position
            ghost = $(this.nextElementSibling);
            ghost.attr("d", d_val);
            return d_val;
        });

        link_text.attr("transform", function(d) {
            var src = same_zoom(d.__src),
                dst = same_zoom(d.__dst);
            return "translate(" + (src[0] + dst[0]) / 2 + "," + (src[1] + dst[1]) / 2 + ")";
        });

        // tabindex affects focus change on tab key.
        // Sort top to bottom left to right
        node.sort(function (a, b) {
                return b.py === a.py ? (b.px === a.px ? 0 : (b.px > a.px ? -1 : 1)) : (b.py > a.py ? -1 : 1);
            })
            .attr('tabindex', function(d, i) { return i + 100; });
    }

    // SVG rendering order is last rendered on top, so to make sure
    // all links are below the nodes we group them under a single g
    vis = parent_element.append("g");
    vis.attr("id", graph_name);
    vis.append("g").attr("id", "link-group");
    vis.append("g").attr("id", "selected-link-group");
    gv.root_element = vis[0][0];

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
        });
    }

    function layout__end__callback() {
        if (!zen_mode) {
            graph.nodes__store_layout_positions(layout.name);
        }
    }

    var layouts = view_layouts.layouts.map(function (layout_data) {
        return layout_data.create(graph);
    });

    function set_layout_toolbar() {
        layout_menu.on('click', function() {

            var layout_btns = layout_menu.find('.btn_layout');
            if (layout_btns.length > 0) { // menu open
                layout_btns.remove();
                return;
            }

            view_layouts.layouts.forEach(function (layout_data, i) {
                var button_layout = layouts[i],
                    button = $('<div></div>');

                button.html(layout_data.name);
                button.addClass(layout_data.clazz);
                button.addClass('btn_layout');
                button.on('click', function () {
                    set_layout(button_layout);
                    layout_btns.remove();
                });
                layout_menu.append(button);
            });
        });
    }

    function layout__tick__callback()
    {
        if (zen_mode && zen_mode__auto_center) {
            center_on_selection_related();
        }
        pushRedraw();
    }

    function layout__reset(alpha) {
        alpha = alpha || 0.01;
        layout.nodes_links(nodes__visible(), links__visible())
              .alpha(alpha)
              .start();
    }

    function layout__load_graph() {
        layout.nodes_links(nodes__visible(), links__visible());
    }

    function set_layout(new_layout) {
        $('#layout_name').html(new_layout.name);
        if (layout !== undefined) {
            layout.save();
            layout.stop();
        }
        var new_layout_is_zen = new_layout && new_layout.name === 'zen',
            old_layout_is_zen = layout && layout.name === 'zen',
            change_zen_mode = new_layout_is_zen ^ old_layout_is_zen;

        // remove fixed status, the fixed status is restored from the layout
        graph.nodes().forEach(function (node) {
            node.fixed = undefined;
        });
        if (new_layout.name == 'zen') {
            zen_mode__prev_layout = layout;
            zen_mode = true;
            zen_mode__auto_center = true;
        } else {
            zen_mode__prev_layout = null;
            zen_mode = false;
            zen_mode__auto_center = false;
        }
        layout = new_layout;
        layout
            .size([w, h])
            .on("tick", layout__tick__callback)
            .on("end", layout__end__callback)
            .nodes_links(nodes__visible(), links__visible())
            .restore()
            .start()
            .alpha(0.01);
        gv.layout = layout;
        if (change_zen_mode) {
            update_view(true);
        }
    }

    set_layout(temporary ? view_layouts.empty(graph) : layouts[0]);
    if (!temporary) {
        set_layout_toolbar(layout_menu);
        gv.hide_layout_menu = function () {
            layout_menu.find('.btn_layout').remove();
        };
    }

    gv.dev_set_layout = function (layout_func) {
        set_layout(function () { return layouts.layout__sync(layout_func); });
    };

    zoom_property.onValue(function (val) {
        zoomInProgress = val;
        tick();
    });

    function disable_zen_mode_auto_center() {
        zen_mode__auto_center = false;
    }
    // [!] hack, should take control of these event listeners and feed them to the zoom behaviour
    parent_element[0][0].parentElement.addEventListener('wheel', disable_zen_mode_auto_center);
    parent_element[0][0].parentElement.addEventListener('mousedown', disable_zen_mode_auto_center);

    function center_on_selection_related() {
        nodes__user_visible(selection.related_nodes(), true, 100 /* ms, duration of animation */);
    }

    gv.link__pass_filter = link__pass_filter;
    gv.node__pass_filter = node__pass_filter;
    function zen_mode__set(value) {
        if (zen_mode === value) {
            return;
        }
        if (value) {
            set_layout(zen_mode__layout);
        } else {
            set_layout(zen_mode__prev_layout);
        }
    }
    gv.zen_mode__set = zen_mode__set;
    gv.zen_mode__toggle = function () {
        zen_mode__set(!zen_mode);
    };
    gv.zen_mode__cancel = function () {
        zen_mode__set(false);
    };
    gv.layouts = layouts;
    return gv;
}

return {
    GraphView: GraphView,
};

});
