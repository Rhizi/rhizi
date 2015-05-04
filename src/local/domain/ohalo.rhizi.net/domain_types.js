define({
    type_attributes: [
        ['collaborator', {
            'title': 'סטודנט',
            'attributes': ['name',
                           'description',
                           'image-url',
                           'url'
                           ],
        }],
        ['keyword', {
            'title': 'מילת-מפצח',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['project', {
            'title': 'מאמר',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['idea', {
            'title': 'שאלות-ראיון',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['skill', {
            'title': 'מאפיןן-מנהיגות',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['resource', {
            'title': 'מרואיין',
            'attributes': ['description', 'url', 'image-url'],
        }]
    ],
    attribute_titles: {
        'affiliation': 'Affiliation',
        'description': 'תיאור',
        'email': 'מייל',
        'name': 'שם',
        'type': 'סוג',
        'url': 'לינק',
        'image-url': 'לינק-תמונה',
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
