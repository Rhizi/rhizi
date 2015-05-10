define(['underscore', 'util', 'domain_types'],
function(_,            util,   domain_types)
{

var all_attributes,
    type_attributes = _.object(domain_types.type_attributes),
    nodetypes = _.map(domain_types.type_attributes, 0),
    attribute_titles = domain_types.attribute_titles,
    node_titles = _.object(nodetypes, _.map(domain_types.type_attributes, function(v) { return v[1].title; }));

if (undefined === type_attributes['_defaults']) {
    type_attributes['_defaults'] = {
        'title': 'default',
        'attributes':['description', 'url']
    };
}

_.pluck(_.values(type_attributes), 'attributes').map(function (attributes) {
        attributes.splice(0, 0, 'name', 'type');
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
        node_titles: node_titles,
        misc: domain_types.misc,
    });
}
)
