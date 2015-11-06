define(['local_backend'],
function(local_backend) {
    describe("create a local backend", function () {

        it("test promise", function() {
            var p = new Promise(function (res, rej) { res()});
            var res = false;
            p.then(function() {
                console.log('blablabla');
                res = true;
            });
            // Why is this incorrect??
            //expect(res).toEqual(true);
        });

        it("test init_graph", function() {
            local_backend.init_graph(function () {
            });
        });
    });
});