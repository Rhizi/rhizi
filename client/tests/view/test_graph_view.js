define(['jquery', 'Bacon', 'd3', 'model/graph', 'view/graph_view'],
function($      ,  Bacon,   d3,         graph,        graph_view) {
    describe("create a graph view", function () {
        it("basic graph view creation", function() {
            var parent_element = document.createElement("div"),
                g = new graph.Graph({temporary:false, base:null}),
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
        });
    });
});