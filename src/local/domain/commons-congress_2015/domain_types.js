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
                           'image-URL',
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
        'outcome': {
            'title': 'Objective',
            'attributes': ['description', 'url'],
        }
    },
    attribute_titles: {
        'affiliation': 'Affiliation',
        'description': 'Description',
        'email': 'Email',
        'image-URL': 'Image URL',
        'name': 'Name',
        'url': 'URL',
        'street-address': 'Street Address',
    }
});