require(['underscore', 'domain_types'],
function(_, domain_types) {
    'use strict';
    describe("domain_types", function () {
        it("sanity test for domain_types", function () {
            expect(_.keys(domain_types)).toEqual(["types", "attribute_titles", "attribute_ui", "misc"]);
        });
    });
});
