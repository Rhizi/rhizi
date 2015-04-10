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
            'title': 'Person',
            'attributes': ['description', 'url'],
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
        'country': 'Country',
    }
});
