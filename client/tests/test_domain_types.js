require(['underscore', 'domain_types', 'model/types'],
function(_, domain_types, model_types) {
    'use strict';
    describe("domain_types", function () {
        it("sanity test for domain_types", function () {
            expect(_.keys(domain_types)).toEqual(["types", "attribute_titles", "attribute_ui", "misc"]);
        });
    });
    describe("model/types", function () {
        it("sanity test for model/types", function () {
            expect(_.isArray(model_types.nodetypes)).toBe(true);
        });
    });
});
