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

define(['d3',  'Bacon', 'consts', 'util', 'view/selection', 'view/helpers', 'model/diff', 'view/item_info', 'view/bubble', 'model/types', 'view/layouts'],
function(d3 ,   Bacon,   consts,   util ,  selection      ,  view_helpers,  model_diff  ,  item_info,        view_bubble,   model_types,   view_layouts) {

"use strict"

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
    }
    graph.diffBus.onValue(function (diff) {
        debugView.append(diff);
    });
}

function init_checkboxes(update_view) {
    var // FIXME take filter names from index.html or both from graph db
        filter_states = _.object(_.map(model_types.nodetypes, function (type) { return [type, null]; }));

    function create_checkboxes() {
        var root = $('#menu__type-filter');

        _.each(model_types.nodetypes, function (type) {
            var input = $('<input type="checkbox" checked="checked">'),
                div = $('<div class="menu__type-filter_item"></div>');

            input.attr("name", type);
            div.append(input);
            div.append(util.capitalize(type));
            root.append(div);
        });
    }

    function read_checkboxes() {
        var name,
            value,
            // jquery map does flattens, and we don't want that
            checkboxes = _.map($('#menu__type-filter input'),
                function (checkbox) {
                        return [checkbox.name, checkbox.checked];
                    }
                );
        for (var i in checkboxes) {
            name = checkboxes[i][0];
            value = checkboxes[i][1];
            if (undefined === filter_states[name]) {
                continue;
            }
            filter_states[name] = value;
        }
    }

    function redraw__set_on_checkbox_change()
    {
        $(function () {
            var checkboxes = $('#menu__type-filter').on('click', function (e) {
                e.stopPropagation();
                read_checkboxes();
                console.log(filter_states);
                update_view(true);
            });
        });
    }

    create_checkboxes();
    read_checkboxes();
    redraw__set_on_checkbox_change();

    return filter_states;
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

        layout_menu = $('#btn_layout'),

        zoomInProgress = false,
        layout,
        drag,
        vis,
        deliverables,
        filter_states,
        // FIXME - want to use parent_element
        w,
        h,
        cx,
        cy;

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

    function node__is_shown(d) {
        return temporary || filter_states[d.type];
    }

    function link__is_shown(d) {
        return node__is_shown(d.__src) && node__is_shown(d.__dst);
    }


    // Filter. FIXME: move away from here. separate element, connected via bacon property
    if (!temporary) {
        filter_states = init_checkboxes(update_view);
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

    var selection_outer_radius = 0; //200;
    // HACK to load positions stored locally: on the first diff, which is the result of the
    // initial clone, load positions from stored last settled position (see record_position_to_local_storage
    // and restore_position_from_local_storage)
    // this is before we have proper layout recording in the database, loaded together with the nodes
    // and links.
    graph.diffBus.take(1).onValue(restore_position_from_local_storage);

    graph.diffBus.onValue(function (diff) {
        var relayout = !temporary && (false == model_diff.is_attr_diff(diff));
        update_view(relayout);
    });

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
            return [zcx + xy[0], zcy + xy[1]]
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

    function showNodeInfo(node) {
        util.assert(!temporary, "cannot showNodeInfo on a temporary graph");
        item_info.show(graph, node)
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
        var nodes = graph.nodes(),
            links = graph.links(),
            i = 0,
            node,
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
        if (d.dragstart.clientX - d3.event.sourceEvent.clientX != 0 ||
            d.dragstart.clientY - d3.event.sourceEvent.clientY != 0) {
            d.fixed = true;
            d.px = d.x;
            d.py = d.y;
            tick();
            layout.resume();
        }
    }

    var urlValid = function(d) {
        return d.url !== undefined && d.url !== null && d.url.length > 0;
    };

    var image_endings = {'jpg':1, 'gif':1, 'png':1, 'bmp':1, 'svg':1};

    var urlImage = function(d) {
        return urlValid(d) && image_endings[d.url.slice(d.url.lastIndexOf('.') + 1)] !== undefined;
    };

    function update_view(relayout) {
        var node,
            link,
            link_g,
            link_text,
            circle,
            unselected_selector = '#' + graph_name + ' #link-group',
            selected_selector = '#' + graph_name + ' #selected-link-group',
            unselected_link_group = document.querySelector(unselected_selector),
            selected_link_group = document.querySelector(selected_selector);

        var nodeTextX = function(d) {
            return urlValid(d) ? node_text_dx + node_url_dx : node_text_dx;
        }

        function model_id_from_dom_id(dom_id) {
            return dom_id.split('__')[0];
        }

        var urlValid = function(d) {
            return d.url !== undefined && d.url !== null && d.url.length > 0;
        };

        function node_text_setup() {
            var node_text;

            node_text = vis.selectAll("g.nodetext")
                .data(graph.nodes(), function(d) {
                    return d.id;
                });
            node_text.enter().insert('g')
                .attr('id', function (d) { return text_node_id(d.id); })
                .attr("class", "nodetext graph")
                .on("click", function(d, i) {
                    if (d3.event.defaultPrevented) {
                        // drag happened, ignore click https://github.com/mbostock/d3/wiki/Drag-Behavior#on
                        return;
                    }
                    if (!temporary) {
                        svgInput.enable(this.querySelector('text'), d, nodeTextX(d));
                        (d3.event.shiftKey ? selection.invert_nodes : selection.select_nodes)([d]);
                        showNodeInfo(graph.find_node__by_id(model_id_from_dom_id(this.id)));
                    }
                    d3.event.stopPropagation();
                })
                .insert("text")
                .attr("class", "nodetext graph")
                .attr("dy", node_text_dy);
            node_text.exit().remove();
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
            node_text.select('text').text(nodeText)
                .attr("dx", nodeTextX);
        }

        var link_on_hover = function (d, debug_name) {
            $('#' + d.id).hover(function (e) {
                add_class(this, 'hovering');
                // show text if not selected
                if (!selection.link_selected(d)) {
                    set_link_label_text(this.id, link_text__short(d));
                }
            }, function (e) {
                remove_class(this, 'hovering');
                // hide text if not selected
                if (!selection.link_selected(d)) {
                    set_link_label_text(this.id, "");
                }
            });
        }

        relayout = (relayout === undefined && true) || relayout;

        link = d3.select(unselected_link_group).selectAll("g.link")
            .data(graph.links(), function(d) { return d.id; });

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
            .on("click", function(d, i) {
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
                link_on_hover(d, 'link-g');
            });
        link_g.on("click", function(d, i) {
                if (zoomInProgress) {
                    // don't disable zoomInProgress, it will be disabled by the svg_click_handler
                    // after this events bubbles to the svg element
                    return;
                }
                item_info.show(graph, d, ['name']);
                (d3.event.shiftKey? selection.invert_link : selection.select_link)(this.link);
            });

        //var selected_N = selection:

        link.attr("class", function(d, i){
                var temp_and = (d.name && d.name.replace(/ /g,"")=="and" && temporary) ? "temp_and" : "";

                return ["graph link", temp_and, selection.selected_class__link(d, temporary)].join(' ');
            });

        link.selectAll('path.link')
            .attr('class', function(d) {
                return [d.state || "perm", selection.selected_class__link(d, temporary), "link graph"].join(' ');
            });

        link.exit().remove();

        vis.selectAll('g.link')
            .data(graph.links())
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

        link_text = vis.selectAll(".linklabel")
            .data(graph.links(), function(d) { return d.id; });

        link_text
            .text(function(d) {
                var src_selected = selection.node_selected(d.__src),
                    dst_selected = selection.node_selected(d.__dst);

                if (!temporary && !src_selected && !dst_selected) {
                    return "";
                }
                if (src_selected && dst_selected) {
                    return d.name;
                }
                return link_text__short(d);
            })
            .attr("class", function(d) {
                return ["linklabel graph", selection.selected_class__link(d, temporary)].join(' ');
            });

        link_text.exit().remove();

        node = vis.selectAll(".node")
            .data(graph.nodes(), function(d) {
                return d.id;
            });

        node_text_setup();

        var nodeEnter = node.enter()
            .append("g")
            .attr('id', function(d){ return d.id; }) // append node id to enable data->visual mapping
            .attr('display', 'none') // made visible on first tick
            .call(drag);

        node.attr('class', function(d) {
                return ['node', selection.selected_class__node(d, temporary)].join(' ');
            })
            .each(function (d) {
                d.zoom_obj = zoom_obj; // FIXME new object NodeView pointing to Node and Zoom
                d.width = 900;
                d.height = 900;
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
            link_text.each(function (d) {
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

        var noderef = nodeEnter.insert('a')
            .attr("class", "nodeurl graph")
            .attr("transform", "translate(10,-7)")
            .attr("dy", node_text_dy);
        noderef.insert("image");

        node.select('g.node a')
            .attr("xlink:href", function (d) { return d.url; })
            .attr("xlink:title", function (d) { return d.url; })
            .attr("target", "_blank")
            .attr("visibility", function(d) { return urlValid(d) ? "visible" : "hidden"; })
            .attr("pointer-events", function(d) { return urlValid(d) ? "all" : "none"; });
        node.select('g.node a image')
            .each(function (d, i) {
                var element = this,
                    image = new Image();
                image.onload = function () {
                    var aspect = this.height / this.width,
                        width = Math.min(100, this.width);

                    element.setAttribute("width", width);
                    element.setAttribute("height", Math.min(width * aspect, this.height));
                    element.setAttributeNS("http://www.w3.org/1999/xlink", "href", this.src);
                }
                image.src = urlImage(d) ? d.url : "/static/img/url-icon.png";
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
                (d3.event.shiftKey ? selection.invert_nodes : selection.select_nodes)([d]);
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

        if (force_enabled) {
            if (!temporary) {
                layout__load_graph();
            }

            if (relayout) {
                layout.alpha(0.1).start();
            } else {
                // XXX If we are stopped we need to update the text of the links at least,
                // and this is the simplest way
                tick();
            }
        } else {
            start_layout_animation();
        }
    }

    function layout__load_graph() {
        var nodes_subset = graph.nodes().filter(node__is_shown),
            links_subset = graph.links().filter(link__is_shown);

        layout.nodes_links(nodes_subset, links_subset);
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
    gv.__set_scale_translate = set_scale_translate;

    var scale__absolute = function (new_scale) {
        var t = zoom_obj.translate(),
            s = zoom_obj.scale(),
            ds = new_scale - s,
            w = window.innerWidth,
            h = window.innerHeight;

        set_scale_translate(new_scale, [t[0] - ds * w / 2, t[1] - ds * h / 2]);
    }

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
            layout.stop();
        }
        return Number.isNaN(x);
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
        if (bubble_radius == 0) {
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
        (e.shiftKey? selection.invert : selection.update)([node]);
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
        var node = vis.selectAll(".node")
            .data(graph.nodes(), function(d) {
                return d.id;
            });
        var link = vis.selectAll("path.link")
            .data(graph.links(), function(d) {
                return d.id;
            });
        var link_text = vis.selectAll(".linklabel").data(graph.links());
        var node_text = vis.selectAll("g.nodetext").data(graph.nodes());
        var bubble_radius = selection.is_empty() || temporary ? gv.bubble_radius : selection_outer_radius;

        if (temporary) {
            // XXX convert to a layout
            circle__set_positions();
        }

        // XXX This computes every node ignoring filter.
        graph.nodes().forEach(function (d) {
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

        function translate(x, y) {
            if (x === undefined || y === undefined) {
                console.log('oops, undefined translate');
            }
            return "translate(" + x + "," + y + ")";
        }

        function transform(d) { return translate(d.bx, d.by); }
        // transform nodes first to record bubble x & y (bx & by)
        node.attr("transform", transform);
        node_text.attr("transform", transform);

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
                return b.py == a.py ? (b.px == a.px ? 0 : (b.px > a.px ? -1 : 1)) : (b.py > a.py ? -1 : 1);
            })
            .attr('tabindex', function(d, i) { return i + 100; });

        // After initial placement we can make the nodes visible.
        [node, node_text].forEach(function (list) {
            list.attr('display', function (d, i) {
                return node__is_shown(d) ? '' : 'none';
            });
        });
        [link, link_text].forEach(function (list) {
            link.attr('display', function (d, i) {
                return link__is_shown(d) ? '' : 'none';
            });
        });
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
        })
    }

    var local_storage_key__positions = "positions";

    function record_position_to_local_storage() {
        localStorage.setItem(local_storage_key__positions,
            JSON.stringify(_.object(graph.nodes().map(
                function (n) {
                    return [n.id, {x: n.x, y: n.y}];
                }))));
    }

    function restore_position_from_local_storage() {
        var positions,
            nodes,
            success = 0;
        try {
            positions = JSON.parse(localStorage.getItem(local_storage_key__positions));
        } catch (e) {
            localStorage.removeItem(local_storage_key__positions);
            return;
        }

        if (null === positions) {
            return;
        }
        nodes = graph.nodes();
        nodes.forEach(function (n) {
            var n_pos = positions[n.id];

            if (n_pos !== undefined) {
                n.x = n_pos.x;
                n.y = n_pos.y;
                success += 1;
            }
        });
        if (success > 0) {
            layout__load_graph();
        }
        console.log('restored ' + success + ' / ' + _.keys(positions).length + ' positions to ' +
                    nodes.length + ' nodes');
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

    function set_layout(new_layout) {
        if (layout !== undefined) {
            layout.save();
            layout.stop();
        }
        // remove fixed status, the fixed status is restored from the layout
        graph.nodes().forEach(function (node) {
            node.fixed = undefined;
        });
        layout = new_layout
            .size([w, h])
            .on("tick", pushRedraw)
            .on("end", record_position_to_local_storage)
            .nodes_links(graph.nodes(), graph.links())
            .restore()
            .start();
    }

    set_layout(temporary ? view_layouts.empty(graph) : layouts[0]);
    if (!temporary) {
        set_layout_toolbar(layout_menu);
        gv.hide_layout_menu = function () {
            layout_menu.find('.btn_layout').remove();
        }
    }

    gv.dev_set_layout = function (layout_func) {
        set_layout(function () { return layouts.layout__sync(layout_func); });
    };

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
