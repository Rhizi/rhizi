define('tests/view/test_graph_view',
       ['jquery', 'Bacon', 'd3', 'model/core', 'model/graph', 'view/graph_view', 'rz_core', 'view/layouts'],
function($      ,  Bacon,   d3,   core,         graph,        graph_view,         rz_core,        layouts) {

    "use strict";

    console.log("test_graph_view");

    // initialize the random number generator
    core.init({rand_id_generator: 'hash'});

    function create_graph_view(nodes, links) {
        var parent_element = document.createElement("div"),
            g = new graph.Graph({temporary:false, base:null, backend:'local'}),
            svgInput = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
            zoom_obj = {i_am_the_zoom_object: 1},
            zoom_obj_element = document.createElement("div"),
            zoom_property = (new Bacon.Bus()).toProperty();
        console.log("parent_element: " + parent_element);
        var body = window.document.body;
        body.appendChild(parent_element);
        var graph_view_spec = {
                temporary: false,
                parent_element: d3.select(parent_element),
                graph_name: 'test',
                graph: g,
                force_enabled: true,
                zoom_obj: zoom_obj,
                zoom_property: zoom_property,
                parent_graph_zoom_obj: null,
                zoom_obj_element: zoom_obj_element,
                svgInput: svgInput,
            },
            gv = new graph_view.GraphView(graph_view_spec);
        if (nodes !== undefined && links !== undefined) {
            g.load_from_nodes_links(nodes, links);
        }
        return {gv:gv, g:g};
    }

    describe("create a graph view", function () {
        it("basic graph view creation", function() {
            var gv = create_graph_view().gv;
            expect(gv).not.toBe(undefined);
        });
        it("loading nodes and links", function() {
            var d = create_graph_view(),
                gv = d.gv,
                g = d.g,
                nodes = [{name: "a"}, {name:"b"}],
                links = [];
            g.load_from_nodes_links(nodes, links);
            expect(g.nodes().length).toEqual(2);
        });
    });

    describe("force layout works without timer", function() {
        it("just test it", function() {
            var l = d3.layout.force(),
                nodes = [{x:0, y:0}],
                while_count = 0,
                tick_count = 0,
                end = false;

            l.on("tick", function () { tick_count += 1; });
            l.on("end", function () { end = true; });
            l.nodes(nodes).start();
            while(l.tick() !== true) {
                while_count += 1;
            }
            expect(while_count).not.toBe(0);
            expect(tick_count).not.toBe(0);
            expect(while_count).toBe(tick_count);
            expect(end).toBe(true);
        });
    });

    describe("layout position recording", function () {
        it("changing force to custom does not trigger position sending", function() {
            var d = create_graph_view([{name: "a"}, {name:"b"}], []),
                gv = d.gv,
                g = d.g;
            expect(g.nodes().length).toEqual(2);
            expect(g.nodes()[0].x).not.toBe(undefined);
            expect(g.nodes()[0].y).not.toBe(undefined);
            expect(g.nodes()[1].x).not.toBe(undefined);
            expect(g.nodes()[1].y).not.toBe(undefined);
            console.log(g.nodes()[0].x);
            expect(gv.get_layout()).not.toBe(undefined);
        });
        it("can create node at specified position", function() {
            var d = create_graph_view([{name: "a", x: 10, y: 42}], []);
            expect(d.g.nodes()[0].x).toBe(10);
            expect(d.g.nodes()[0].y).toBe(42);
        });
        it("adding a node to a graph in force layout causes it's position to be set", function() {
            var d = create_graph_view([{name: "a", x: 10, y: 42}], []);
            expect(d.g.nodes()[0].x).toBe(10);
            expect(d.g.nodes()[0].y).toBe(42);
        });
        it("moving a node triggers a diff on that node's position", function() {
        });
        it("changing custom to force does not trigger position sending", function() {
        });
    });
});
