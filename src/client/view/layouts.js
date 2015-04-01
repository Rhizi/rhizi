define(['jquery', 'd3', 'underscore', 'rz_core'],
function($,        d3,   _,            rz_core) {
    function layout__d3_force(graph) {
        return d3.layout.force()
                  .distance(240)
                  .gravity(0.12)
                  .charge(-1800)
                  .linkDistance(function (link, i) {
                    var d_src = graph.degree(link.__src),
                        d_dst = graph.degree(link.__dst),
                        ret = (d_src + d_dst) * 10 + 10;
                    return ret;
                  });
    }

    function layout__cola(graph) {
        return cola.d3adaptor()
                  //.linkDistance(120)
                  .avoidOverlaps(true);
        /*
                  .linkDistance(function (link, i) {
                    var d_src = graph.degree(link.__src),
                        d_dst = graph.degree(link.__dst),
                        ret = (d_src + d_dst) * 10 + 10;
                    return ret;
                  })
                  */
    }

    function layout__empty(graph) {
        var donothing = function () { return ret; },
            ret = {
                resume: donothing,
                stop: donothing,
                nodes: donothing,
                links: donothing,
                alpha: donothing,
                start: donothing,
                size: donothing,
                on: donothing,
            };
        return ret;
    }

    function layout__sync(layer) {
        var layout = {
                _nodes: undefined,
                _links: undefined,
                _tick: function () {
                    console.log('tick not set');
                },
                _end: function () {
                    console.log('end not set');
                },
                wh: [1, 1] // width + height
            },
            bound_layer = layer.bind(layout);
        
        layout.resume = function () {
            layout.start();
            return layout;
        };
        layout.stop = function () {
            return layout;
        };
        layout.start = function () {
            bound_layer();
            layout._tick();
            layout._end();
            return layout;
        }
        layout.alpha = layout.start;
        layout.nodes = function (_nodes) {
            layout._nodes = _nodes;
            return layout;
        }
        layout.links = function (_links) {
            layout._links = _links;
            return layout;
        }
        layout.on = function (on_type, func) {
            switch (on_type) {
                case 'tick':
                    layout._tick = func;
                    break;
                case 'end':
                    layout._end = func;
                    break;
            };
            return layout;
        }
        layout.size = function (_wh) {
            layout.wh = _wh;
            return layout;
        }
        return layout;
    }

    function layout__concentric() {
        var cx = $(document.body).innerWidth() / 2,
            cy = $(document.body).innerHeight() / 2,
            pi = Math.PI,
            top_angle = pi / 2,
            small_number_angles = {
                1: [0],
                2: [pi / 2, pi * 3 /2],
                3: [2 * pi / 3, 4 * pi / 3, 0],
                4: [0, 1, 2, 3].map(function (i) { return (1.0 / 17 + i / 4.0) * 2 * pi; }),
                5: [0, 1, 2, 3, 4].map(function (i) { return (i / 5.0) * 2 * pi; }),
                },
            small_cutoff = _.max(_.keys(small_number_angles));

        return layout__sync(function () {
            var bytype = _.sortBy(_.groupBy(this._nodes, 'type'), "length").map(function (nodes) {
                    return _.sortBy(nodes, "name");
                }),
                types = _.keys(bytype),
                i,
                r,
                nodes,
                count,
                j,
                node,
                cos = Math.cos,
                sin = Math.sin,
                ring_radius = Math.max(50, (Math.min.apply(null, this.wh) - 50) / (types.length + 1));

            function setxy(node, angle) {
                node.x = node.px = cx + r * cos(angle);
                node.y = node.py = cy + r * sin(angle);
            }

            for (i = 0; i < types.length ; ++i) {
                r = (i + 1) * ring_radius;
                nodes = bytype[types[i]];
                count = nodes.length;

                if (count <= small_cutoff) {
                    nodes.forEach(function (node, i) {
                        setxy(node, small_number_angles[nodes.length][i]);
                    });
                } else {
                    var single_width = 200,
                        small_angle = Math.min(pi / 2, single_width / r),
                        small_angle_half = small_angle / 2,
                        large_count = Math.floor(count / 2) - 1,
                        pi_half = pi / 2,
                        large_angle = pi - small_angle,
                        angle,
                        dangle;

                    dangle = large_angle / (large_count + 1);
                    angle = -pi_half + small_angle_half + dangle;
                    for (j = 0 ; j < large_count; ++j) {
                        setxy(nodes[j], angle);
                        angle += dangle;
                    }
                    setxy(nodes[large_count], pi / 2);
                    dangle = large_angle / (count - large_count - 1);
                    angle = pi_half + small_angle_half + dangle;
                    for (j = large_count + 1 ; j < count - 1; ++j) {
                        setxy(nodes[j], angle);
                        angle += dangle;
                    }
                    setxy(nodes[count - 1], 3 * pi / 2);
                }
            }
        });
    };

    function layout__grid() {
        return layout__sync(function () {
            var nodes = this._nodes,
                count = nodes.length,
                line = Math.floor(Math.sqrt(count)) + 1,
                rows = Math.ceil(count / line),
                wspace = this.wh[0] / (line + 2),
                hspace = this.wh[1] / (rows + 1);

            for (var i = 0 ; i < nodes.length ; ++i) {
                var node = nodes[i];
                node.x = node.px = ((i % line) + 1) * wspace;
                node.y = node.py = (Math.floor(i / line) + 1) * hspace;
            }
        });
    };

    var layouts = [
        {
            name: 'Force',
            create: layout__d3_force,
            clazz: 'btn_layout_d3_force'
        },
        {
            name: 'Ring',
            create: layout__concentric,
            clazz: 'btn_layout_concentric'
        },
        /*
        {
            name: 'Grid',
            create: layout__grid,
            clazz: 'btn_layout_grid'
        },
        */
        ];
    return {
        layouts: layouts,
        empty: layout__empty
    };
});
