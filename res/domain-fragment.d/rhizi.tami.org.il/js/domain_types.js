define({
    type_attributes: [
        ['collaborator', {
            'title': 'Human',
            'attributes': ['affiliation',
                           'description',
                           'email',
                           'image-url',
                           'name',
                           'url'
                           ],
        }],
        ['project', {
            'title': 'Project',
            'attributes': ['description', 'url', 'rhizi-url', 'image-url'],
        }],
        ['idea', {
            'title': 'Idea',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['skill', {
            'title': 'Skill',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['resource', {
            'title': 'Technology',
            'attributes': ['description', 'url', 'image-url'],
        }]
    ],
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
