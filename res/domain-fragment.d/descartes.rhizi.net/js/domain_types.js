define({
    type_attributes:[
        ['person', {
            'title':'Personne',
            'attributes': ['description',
                           'email',
                           'image-url',
                           'name',
                           'url'
                           ],
            }],
        ['team', {
            'title':'Équipe',
            'attributes':['description', 'url', 'image-url'],
            }],  
        ['resource', {
            'title':'Organisation',
            'attributes':['description', 'url', 'image-url', 'email'],
            }],
        ['project', {
            'title':'Projet',
            'attributes':['description', 'status', 'url', 'budget', 'total days','image-url'],
            }],
        ['skill', {
            'title':'Compétence',
            'attributes':['description', 'url', 'image-url'],
            }]
    ],
    attribute_titles:{
        'description':'Description',
        'email':'Email',
        'name':'Nom',
        'type':'Type',
        'url':'URL',
        'image-url':'Image URL',
        'total days':'Jours travaillés',
        'budget':'Budget en k€',
        'status':'Statut'
        },
        attribute_ui:{
        'description':'textarea',
        'email':'input',
        'name':'input',
        'type':'type',
        'image-url':'image',
        'url':'url',
        'total days':'total days',
        'budget':'input',
        'status':'input'
        },
    });
