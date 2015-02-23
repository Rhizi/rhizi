from db_op import DB_op

class DBO_random_data_generation__domain__CRI(DB_op):

    def __init__(self, lim_n=50,
                       lim_r=10000,
                       prob_link_create=0.03):
        """
        generate random data: CRI domain: Person x Skill
        """
        super(DBO_random_data_generation__domain__CRI, self).__init__()

        n_attr_set__skill_raw = ['Cryptocurrency',
                             'Database architecture',
                             'Web-development',
                             'Mobile-development',
                             'Machine learning',
                             'Guitar Playing',
                             'Image processing',
                             'Algebra',
                             'Calculus',
                             'Molecular-Biology',
                             'Graphic design',
                             'Geo-location services',
                             'Drone-building',
                             'Artificial-intelligence',
                             'Distributed information systems',
                             'Wordpress',
                             'Woodworking',
                             'Quality-control',
                             'Video-editing',
                             'Soldering',
                             'Network engineering',
                             'GIT',
                             'Electronic music',
                             'Network administration']

        n_attr_set__skill = []
        for s in n_attr_set__skill_raw:
            n_attr_set__skill.append(s)

        n_attr_set__name = ['John',
                            'William',
                            'James',
                            'Charles',
                            'George',
                            'Frank',
                            'Joseph',
                            'Thomas',
                            'Henry',
                            'Robert',
                            'Edward',
                            'Harry',
                            'Walter',
                            'Arthur',
                            'Fred',
                            'Albert',
                            'Samuel',
                            'David',
                            'Louis',
                            'Joe',
                            'Charlie',
                            'Clarence',
                            'Richard',
                            'Andrew',
                            'Daniel',
                            'Ernest',
                            'Mary',
                            'Anna',
                            'Emma',
                            'Elizabeth',
                            'Minnie',
                            'Margaret',
                            'Ida',
                            'Alice',
                            'Bertha',
                            'Sarah',
                            'Annie',
                            'Clara',
                            'Ella',
                            'Florence',
                            'Cora',
                            'Martha',
                            'Laura',
                            'Nellie',
                            'Grace',
                            'Carrie',
                            'Maude',
                            'Mabel',
                            'Bessie',
                            'Jennie',
                            'Gertrude',
                            'Julia']

        l_attr_set__level = ['Novice', 'Intermediate', 'Expert']


        min_id = 10000  # separate group ids with numerical perfix

        # create persons
        q_arr = ['with {n_attr_set__name} as n_attr_set',  # TODO clean: foreach triggers SyntaxException: otherwise
                 'foreach (idx in range(0,%d)' % (lim_n - 1),
                 '|',
                 'create (n:%s' % ('Person'),
                 '{id: \'test-id_\' + toString(%d + idx),' % (min_id),
                  'name: n_attr_set[idx %% %d]}' % (len(n_attr_set__name)),
                 '))',
                ]
        q_param = {'n_attr_set__name': n_attr_set__name}
        self.add_statement(q_arr, q_param)
        min_id *= 2

        # create skills
        q_arr = ['with {skill_set} as skill_set',  # TODO clean: foreach triggers SyntaxException: otherwise
                 'foreach (idx in range(0,%d)' % (len(n_attr_set__skill) - 1),
                 '|',
                 'create (n:%s' % ('Skill'),
                 '{id: \'test-id_\' + toString(idx + %d),' % (min_id),
                  'name: skill_set[idx]}',
                 '))',
                ]
        q_param = {'skill_set': n_attr_set__skill}
        self.add_statement(q_arr, q_param)
        min_id *= 2

        # create links
        for skill_level in l_attr_set__level:
            q_arr = ['match (n:%s),(m:%s)' % ('Person', 'Skill'),
                     'with n, m, rand() as rand',
                     'order by rand',
                     'limit %d' % (lim_r - 1),
                     'where rand() < %.2f' % (prob_link_create),
                     'create (n)-[r:%s' % (skill_level),
                     '{id: \'test-id_\' + toString(%d + toInt(%d * rand())),' % (min_id, lim_r * 100000),  # aim for low id collision probability,
                     'proficiency: \'%s\'}' % (skill_level),
                     ']->(m)',
                     'return collect(r.id)',
                     ]

            self.add_statement(q_arr, q_param)
