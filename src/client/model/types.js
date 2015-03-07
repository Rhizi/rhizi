define(['underscore', 'util'],
function(_,            util)
{

var nodetypes,
    type_attributes = {
        'internship': ['status', 'startdate', 'enddate', 'description', 'url'],
        'skill': ['description', 'url'],
        'interest': ['description', 'url'],
        'person': ['description', 'url'],
    },
    all_attributes;

nodetypes = _.keys(type_attributes);

type_attributes['_defaults'] = ['description', 'url'];

_.values(type_attributes).map(function (attributes) {
        attributes.push('name');
        attributes.push('type');
        attributes.sort();
    });

all_attributes = _.union(_.flatten(_.map(type_attributes, _.values))).sort();

return (
    {
        nodetypes: nodetypes,
        type_attributes: function (type) {
            util.assert(type[0] !== '_', 'invalid type name');
            return type_attributes[type_attributes.hasOwnProperty(type) ? type : '_defaults'];
        },
        all_attributes: all_attributes,
    });
}
)
