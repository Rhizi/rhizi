define({
    type_attributes: {
        'keyword': {
            'title': 'Keyword',
            'attributes': ['description', 'url'],
        },
        'person': {
            'title': 'Person',
            'attributes': ['affiliation',
                           'street-address',
                           'description',
                           'email',
                           'image-url',
                           'name',
                           'url'
                           ],
            },
        'project': {
            'title': 'Project',
            'attributes': ['description', 'url'],
        },
        'project_component': {
            'title': 'Project Component',
            'attributes': ['description', 'url'],
        },
        'objective': {
            'title': 'Objective',
            'attributes': ['description', 'url'],
        },
        'resource': {
            'title': 'Objective',
            'attributes': ['description', 'url'],
        }
    },
    attribute_titles: {
        'affiliation': 'Affiliation',
        'description': 'Description',
        'email': 'Email',
        'image-url': 'Image URL',
        'name': 'Name',
        'street-address': 'Street Address',
        'type': 'Type',
        'url': 'URL',
    },
    attribute_ui: {
        'affiliation': 'textarea',
        'description': 'textarea',
        'email': 'input',
        'image-url': 'image',
        'name': 'input',
        'street-address': 'textarea',
        'type': 'type',
        'url': 'url',
    },
});
