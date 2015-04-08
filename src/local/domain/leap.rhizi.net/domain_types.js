define({
    type_attributes: {
        'keyword': {
            'title': 'Keyword',
            'attributes': ['description', 'url'],
        },
        'person': {
            'title': 'Person',
            'attributes': ['affiliation',
                           'description',
                           'email',
                           'image-url',
                           'name',
                           'url'
                           ],
            },
        'project': {
            'title': 'Project',
            'attributes': ['description', 'url', 'rhizi-url'],
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
        'name': 'Name',
        'type': 'Type',
        'url': 'URL',
        'image-url': 'Image URL',
        'rhizi-url': 'Rhizi URL',
    }
});