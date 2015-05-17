from db_op import DBO_cypher_query
import neo4j_util


class DBO_RDG__skill_graph(DBO_cypher_query):

    def __init__(self, rzdoc,
                       lim_n=50,
                       lim_r=10000,
                       prob_link_create=0.03,
                       name_set=['Bruce Lee', 'Kesuke Miyagi'],
                       skill_set=['Kung Foo', 'Karate'],
                       skill_level_set=['Novice', 'Intermediate', 'Expert']
                      ):
        """
        Random data generator:
           - Name x Skill[proficiency: {Novice|Intermediate|Expert}]
        """
        super(DBO_RDG__skill_graph, self).__init__()

        rzdoc_label = neo4j_util.rzdoc__ns_label(rzdoc)
        min_id = 10000  # separate group ids with numerical perfix

        # create persons
        q_arr = ['with {name_set} as n_attr_set',  # TODO clean: foreach triggers SyntaxException: otherwise
                 'foreach (idx in range(0,%d)' % (lim_n - 1),
                 '|',
                 'create (n:%s:%s' % (rzdoc_label, 'Person'),
                 '{id: \'test-id_\' + toString(%d + idx),' % (min_id),
                  'name: n_attr_set[idx %% %d]}' % (len(name_set)),
                 '))',
                ]
        q_param = {'name_set': name_set}
        self.add_statement(q_arr, q_param)
        min_id *= 2

        # create skills
        q_arr = ['with {skill_set} as skill_set',  # TODO clean: foreach triggers SyntaxException: otherwise
                 'foreach (idx in range(0,%d)' % (len(skill_set) - 1),
                 '|',
                 'create (n:%s:%s' % (rzdoc_label, 'Skill'),
                 '{id: \'test-id_\' + toString(idx + %d),' % (min_id),
                  'name: skill_set[idx]}',
                 '))',
                ]
        q_param = {'skill_set': skill_set}
        self.add_statement(q_arr, q_param)
        min_id *= 2

        # create links
        for skill_level in skill_level_set:
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

