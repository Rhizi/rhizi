define({
    types: [
        ['person', {
            'title': 'Person',
            'attributes': ['email', 'work-address', 'image-url', 'url', 'subtype-tags'],
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
                 'days-total',
                 'subtype-tags'
                ],
            'radius': ['days-total', 'linear']
        }],
        ['skill', {
            'title': 'Skill',
            'attributes': ['description'],
        }],
        ['keyword', {
            'title': 'Keyword',
            'attributes': ['description', 'url', 'subtype-tags'],
        }],
        ['organisation', {
            'title': 'Organisation',
            'attributes': ['description', 'url', 'subtype-tags'],
        }],
        ['media', {
            'title': 'Media',
            'attributes': ['description', 'url', 'image-url', 'subtype-tags'],
        }],
    ],
    link_types: [
        ['worked on', {
            'title': 'Worked on',
            'attributes': ['days-total'],
            'width': ['days-total', 'linear'],
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
        'image-url': 'Image URL',
        'cnrs-inserm-unit-code': 'CNRS / INSERM unit code',
        'work-address': 'Work Address',
        'street-address': 'Street address',
        'city': 'City',
        'country': 'Country',
        'days-total': 'Days Total',
        'subtype-tags': 'Subtype Tags'
    },
    attribute_ui: {
        'description': 'textarea',
        'work-address': 'textarea',
        'email': 'input',
        'name': 'input',
        'type': 'type',
        'image-url': 'input',
        'url': 'input',
        'rhizi-url': 'input',
        'status': 'input',
        'days-total': 'input',
        'subtype-tags': 'input'
    }
});
