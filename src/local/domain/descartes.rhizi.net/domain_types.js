define({
    type_attributes: [
        ['person', {
            'title': 'Person',
            'attributes': ['description',
                           'email',
                           'image-url',
                           'name',
                           'url'
                           ],
        }],
        ['beneficiary', {
            'title': 'Beneficiary',
            'attributes': ['description', 'url', 'image-url', 'email'],
        }],
        ['completed-project', {
            'title': 'Completed project',
            'attributes': ['description', 'url', 'budget', 'total days','image-url'],
        }],
        ['ongoing-project', {
            'title': 'Ongoing project project',
            'attributes': ['description', 'url', 'budget', 'total days','image-url'],
        }],
        ['future-project', {
            'title': 'Future project',
            'attributes': ['description', 'url', 'budget', 'total days','image-url'],
        }],
        ['skill', {
            'title': 'Skill',
            'attributes': ['description', 'url', 'image-url'],
        }]
    ],
    attribute_titles: {
        'description': 'Description',
        'email': 'Email',
        'name': 'Name',
        'type': 'Type',
        'url': 'URL',
        'image-url': 'Image URL',
        'total days': 'Total days',
        'budget': 'Budget',
    },
    attribute_ui: {
        'description': 'textarea',
        'email': 'input',
        'name': 'input',
        'type': 'type',
        'image-url': 'image',
        'url': 'url',
        'total days': 'total days',
        'budget': 'input',
    },
});
