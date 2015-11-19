define({
    types: [
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
            'attributes': ['description', 'url', 'image-url'],
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
            'title': 'Resource',
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
    misc: {
        // [!] direction of item info box only right now. should be per client.
        'direction': 'rtl'
    }
});
