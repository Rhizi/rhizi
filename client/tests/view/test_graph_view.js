define(['jquery', 'Bacon', 'd3', 'model/core', 'model/graph', 'view/graph_view', 'rz_core'],
function($      ,  Bacon,   d3,   core,         graph,        graph_view,         rz_core) {

    console.log("test_graph_view");

    // initialize the random number generator
    core.init({rand_id_generator: 'hash'});

    function create_graph_view() {
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
        return {gv:gv, g:g};
    }

    describe("create a graph view", function () {
        it("basic graph view creation", function() {
            var gv = create_graph_view().gv;
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
});