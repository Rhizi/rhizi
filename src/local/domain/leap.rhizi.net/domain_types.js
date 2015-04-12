define({
    type_attributes: [
        ['collaborator', {
            'title': 'Collaborator',
            'attributes': ['affiliation',
                           'description',
                           'email',
                           'image-url',
                           'name',
                           'url'
                           ],
        }],
        ['keyword', {
            'title': 'Keyword',
            'attributes': ['description', 'url'],
        }],
        ['project', {
            'title': 'Project',
            'attributes': ['description', 'url', 'rhizi-url'],
        }],
        ['idea', {
            'title': 'Idea',
            'attributes': ['description', 'url'],
        }],
        ['skill', {
            'title': 'Skill',
            'attributes': ['description', 'url'],
        }],
        ['resource', {
            'title': 'Resource',
            'attributes': ['description', 'url'],
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
