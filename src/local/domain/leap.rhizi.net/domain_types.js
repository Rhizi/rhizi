define({
    type_attributes: {
        'keyword': {
            'title': 'Keyword',
            'attributes': ['description', 'url'],
        },
        'collaborator': {
            'title': 'Collaborator',
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
        'idea': {
            'title': 'Idea',
            'attributes': ['description', 'url'],
        },
        'need': {
            'title': 'Need',
            'attributes': ['description', 'url'],
        },
        'resource': {
            'title': 'Resource',
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
    },
});
