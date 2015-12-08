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

"use strict";

var all_attributes,
    types = _.object(domain_types.types),
    link_types = _.object(domain_types.link_types),
    link_types_names = _.map(domain_types.link_types, function (x) { return x[0]; }),
    nodetypes = _.map(domain_types.types, 0),
    attribute_titles = domain_types.attribute_titles,
    node_titles = _.object(nodetypes, _.map(domain_types.types, function(v) { return v[1].title; }));

if (undefined === types._defaults) {
    types._defaults = {
        'title': 'default',
        'attributes':['description', 'url']
    };
}

if (undefined === link_types._defaults) {
    link_types._defaults = {
        'title': 'default',
        'attributes':[]
    };
}

_.pluck(_.values(types), 'attributes').map(function (attributes) {
        attributes.splice(0, 0, 'name', 'type');
    });

all_attributes = _.union(_.flatten(_.pluck(_.values(types), 'attributes'))).sort();

util.assert(_.filter(all_attributes,
    function (attr) { return attribute_titles[attr] === undefined; }).length === 0);

return (
    {
        nodetypes: nodetypes,
        link_types_names: link_types_names,
        type_attributes: function (type) {
            return types[type && types.hasOwnProperty(type) ? type : '_defaults'].attributes;
        },
        types: function(type) {
            return types[type && types.hasOwnProperty(type) ? type : '_defaults'];
        },
        link_types: function(type) {
            return link_types[type && link_types.hasOwnProperty(type) ? type : '_defaults'];
        },
        all_attributes: all_attributes,
        attribute_titles: attribute_titles,
        node_titles: node_titles,
        misc: domain_types.misc,
    });
}
);
