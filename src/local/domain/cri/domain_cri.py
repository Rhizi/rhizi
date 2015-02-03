from db_op import DB_op

class DBO_random_data_generation__domain__CRI(DB_op):

    def __init__(self, lim_n=50,
                       lim_r=10000,
                       prob_link_create=0.01):
        """
        generate random data: CRI domain: Person x Skill
        """
        super(DBO_random_data_generation__domain__CRI, self).__init__()

        n_attr_set__skill_raw = ['Cryptocurrency',
                             'Database architecture',
                             'Web-development',
                             'HTML',
                             'Mobile-development',
                             'Machine learning',
                             'Guitar Playing',
                             'Image processing']

        n_attr_set__skill = []
        for s in n_attr_set__skill_raw:
            n_attr_set__skill.append(s)
            n_attr_set__skill.append(s + '_a')
            n_attr_set__skill.append(s + '_b')

        n_attr_set__name = ['Yael',
                            'Nofar',
                            'Ela',
                            'Tali',
                            'Nimrod',
                            'Lior',
                            'Ehud',
                            'Yaron']

        l_attr_set__level = ['Novice', 'Intermediate', 'Expert']


        min_id = 10000  # separate group ids with numerical perfix

        # create persons
        q_arr = ['with {n_attr_set__name} as n_attr_set',  # TODO clean: foreach triggers SyntaxException: otherwise
                 'foreach (idx in range(0,%d)' % (lim_n - 1),
                 '|',
                 'create (n:%s' % ('Person'),
                 '{id: \'test-id_\' + toString(%d + idx),' % (min_id),
                  'name: n_attr_set[idx %% %d] + \'_\' + toString(idx)}' % (len(n_attr_set__name)),
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
        q_arr = ['match (n:%s),(m:%s)' % ('Person', 'Skill'),
                 'with n, m, {l_attr_set__level} as l_attr_set__level',
                 'limit %d' % (lim_r - 1),
                 'where rand() < %.2f' % (prob_link_create),
                 'create (n)-[r:%s' % ('Knows'),
                 '{id: \'test-id_\' + toString(%d + toInt(%d * rand())),' % (min_id, lim_r * 100000),  # aim for low id collision probability,
                 'proficiency: l_attr_set__level[toInt(%d * rand())]}' % (len(l_attr_set__level)),
                 ']->(m)',
                 'return collect(r.id)',
                 ]

        q_param = {'l_attr_set__level': l_attr_set__level}
        self.add_statement(q_arr, q_param)
