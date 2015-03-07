define(['underscore', 'util'],
function(_,            util)
{

var nodetypes,
    type_attributes = {
        'internship': {
            'title': 'Internship',
            'attributes':
                ['status', 'startdate', 'enddate', 'description', 'url',
                 'internship-type',
                 'facility',
                 'facility-affiliation',
                 'cnrs-inserm-unit-code',
                 'street-address',
                 'city',
                 'country',
                ],
            },
        'skill': {
            'title': 'Skill',
            'attributes': ['description', 'url'],
            },
        'interest': {
            'title': 'Interesst',
            'attributes': ['description', 'url'],
            },
        'person': {
            'title': 'Person',
            'attributes': ['description', 'url'],
            },
        'club': {
            'title': 'Club',
            'attributes': ['description', 'url'],
        }
    },
    all_attributes,
    attribute_titles = {
        'name': 'Name',
        'type': 'Type',
        'description': 'Description',
        'url': 'URL',
        'status': 'Status',
        'startdate': 'Start Date',
        'enddate': 'End Date',
        'internship-type': 'Internship Type',
        'facility': 'Lab/Company',
        'facility-affiliation': 'Lab affiliation',
        'cnrs-inserm-unit-code': 'CNRS / INSERM unit code',
        'street-address': 'Street address',
        'city': 'City',
        'country': 'Country',
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
