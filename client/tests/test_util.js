define(['util'], function(util) {
    describe("set from object", function () {
        it("set from object", function() {
            expect(util.set_from_object({1:1, 2:2})).toEqual({1:1, 2:1});
            expect(util.set_from_object({})).toEqual({});
        });
        it("set from array", function() {
            expect(util.set_from_array([1, 2])).toEqual({1:1, 2:1});
            expect(util.set_from_array([])).toEqual({});
        });
    });
})
