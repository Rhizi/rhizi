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

define({
    type_attributes: [
        ['internship', {
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
        }],
        ['skill', {
            'title': 'Skill',
            'attributes': ['description', 'url'],
        }],
        ['interest', {
            'title': 'Interesst',
            'attributes': ['description', 'url'],
        }],
        ['person', {
            'title': 'Student',
            'attributes': ['description', 'url', 'email', 'image-url'],
        }],
        ['resource', {
            'title': 'Mentor',
            'attributes': ['description', 'url', 'organisation', 'image-url'],
        }],
        ['club', {
            'title': 'Club',
            'attributes': ['description', 'url'],
        }]
    ],
    attribute_titles: {
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
        'email': 'Email',
        'image-url':'Image URL',
        'country': 'Country',
    }, 
    attribute_ui:{
        'name': 'input',
        'type': 'type',
        'description': 'textarea',
        'url': 'url',
        'status': 'input',
        'startdate': 'Start Date',
        'enddate': 'End Date',
        'internship-type': 'input',
        'facility': 'input',
        'facility-affiliation': 'input',
        'cnrs-inserm-unit-code': 'input',
        'street-address': 'input',
        'city': 'input',
        'email': 'email',
        'image-url':'image',
        'country': 'input',
    },
});
