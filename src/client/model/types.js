define(['underscore', 'util', 'model/domain_types'],
function(_,            util,   domain_types)
{

var all_attributes,
    type_attributes = _.object(domain_types.type_attributes),
    nodetypes = _.map(domain_types.type_attributes, 0),
    attribute_titles = domain_types.attribute_titles;

if (undefined === type_attributes['_defaults']) {
    type_attributes['_defaults'] = {
        'title': 'default',
        'attributes':['description', 'url']
    };
}

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
            util.assert(!type || type[0] !== '_', 'invalid type name');
            return type_attributes[type && type_attributes.hasOwnProperty(type) ? type : '_defaults'].attributes;
        },
        all_attributes: all_attributes,
        attribute_titles: attribute_titles,
    });
}
)
