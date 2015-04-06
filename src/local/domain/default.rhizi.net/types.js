define(['underscore', 'util'],
function(_,            util)
{

var nodetypes,
    type_attributes = {
        'person': {
            'title': 'Person',
            'attributes': ['description', 'url'],
            },
        'skill': {
            'title': 'Skill',
            'attributes': ['description', 'url'],
        }
    },
    all_attributes,
    attribute_titles = {
        'name': 'Name',
        'type': 'Type',
        'description': 'Description',
        'url': 'URL',
    };

nodetypes = _.keys(type_attributes);

type_attributes['_defaults'] = {
    'title': 'default',
    'attributes':['description', 'url']
    };

_.pluck(_.values(type_attributes), 'attributes').map(function (attributes) {
        attributes.push('name');
        attributes.push('type');
        attributes.sort();
    });

all_attributes = _.union(_.flatten(_.pluck(_.values(type_attributes), 'attributes'))).sort();

util.assert(_.isEqual(all_attributes, _.keys(attribute_titles).sort()));

return (
    {
        nodetypes: nodetypes,
        type_attributes: function (type) {
            util.assert(type[0] !== '_', 'invalid type name');
            return type_attributes[type_attributes.hasOwnProperty(type) ? type : '_defaults'].attributes;
        },
        all_attributes: all_attributes,
        attribute_titles: attribute_titles,
    });
}
)
