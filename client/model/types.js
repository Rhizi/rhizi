/*
    This file is part of rhizi, a collaborative knowledge graph editor.
    Copyright (C) 2014-2015  Rhizi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

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

util.assert(_.filter(all_attributes,
    function (attr) { return attribute_titles[attr] === undefined; }).length == 0);

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
