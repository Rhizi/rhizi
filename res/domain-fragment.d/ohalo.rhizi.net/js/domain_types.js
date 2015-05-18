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
            'title': 'מילת-מפתח',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['project', {
            'title': 'מאמר',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['idea', {
            'title': 'שאלת-ראיון',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['skill', {
            'title': 'מאפיין-מנהיגות',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['resource', {
            'title': 'מרואיין',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['personality-trait', {
            'title': 'פרופיל אישי',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['accepting-changes', {
            'title': 'קבלת שינויים',
            'attributes': ['description', 'url', 'image-url'],
        }],
        ['decision-making', {
            'title': 'קבלת החלטות',
            'attributes': ['description', 'url', 'image-url'],
        }],
    ],
    attribute_titles: {
        'description': 'תיאור',
        'name': 'שם',
        'type': 'סוג',
        'url': 'לינק',
        'image-url': 'לינק-תמונה',
    },
    attribute_ui: {
        'description': 'textarea',
        'name': 'input',
        'type': 'type',
        'image-url': 'image',
        'url': 'url',
    },
    misc: {
        'direction': 'rtl'
    }
});
