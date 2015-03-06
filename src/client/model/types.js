define(['underscore', 'util'],
function(_,            util)
{

var type_attributes = {
        'third-internship-proposal': ['status', 'startdate', 'enddate', 'description', 'url'],
        'skill': ['description', 'url'],
        'interest': ['description', 'url'],
        '_defaults': ['description', 'url'],
    },
    all_attributes;

_.values(type_attributes).map(function (attributes) {
        attributes.push('name');
        attributes.push('type');
        attributes.sort();
    });

all_attributes = _.union(_.flatten(_.map(type_attributes, _.values))).sort();

return (
    {
        type_attributes: function (type) {
            util.assert(type[0] !== '_', 'invalid type name');
            return type_attributes[type_attributes.hasOwnProperty(type) ? type : '_defaults'];
        },
        all_attributes: all_attributes,
    });
}
)
