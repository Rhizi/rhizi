require(['model/graph'],
function(graph) {
    describe("core tests", function () {
        it("sanity test for graph", function () {
            var base = new graph.Graph({temporary: false, base: null, backend: 'local'});
        });
    })
});