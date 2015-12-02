define({
    types: [
        ['person', {
            'title': 'Person',
            'attributes': ['email', 'image-url', 'url'],
        }],
        ['project', {
            'title': 'Project',
            'attributes':
                ['description',
                 'url',
                 'status',
                 'startdate',
                 'enddate',
                 'country',
                 'city',
                 'street-address',
                 'cnrs-inserm-unit-code',
                 'hours-total',
                ],
            'radius': ['hours-total', 'linear']
        }],
        ['skill', {
            'title': 'Skill',
            'attributes': ['description'],
        }],
        ['keyword', {
            'title': 'Keyword',
            'attributes': ['description', 'url'],
        }],

        ['organisation', {
            'title': 'Organisation',
            'attributes': ['description', 'url'],
        }],
        ['media', {
            'title': 'Media',
            'attributes': ['description', 'url', 'image-url'],
        }],
    ],
    link_types: [
        ['worked on', {
            'title': 'Worked on',
            'attributes': ['hours-total'],
            'width': ['hours-total', 'linear'],
        }],
    ],
    attribute_titles: {
        'name': 'Name',
        'type': 'Type',
        'description': 'Description',
        'email': 'Email',
        'url': 'URL',
        'status': 'Status',
        'startdate': 'Start Date',
        'enddate': 'End Date',
        'image-url': 'Image url',
        'cnrs-inserm-unit-code': 'CNRS / INSERM unit code',
        'street-address': 'Street address',
        'city': 'City',
        'country': 'Country',
        'hours-total': 'Hours Total'
    },
    attribute_ui: {
        'affiliation': 'textarea',
        'description': 'textarea',
        'email': 'input',
        'name': 'input',
        'type': 'type',
        'image-url': 'image',
        'url': 'url',
        'rhizi-url': 'rhizi-url',
    }
});
