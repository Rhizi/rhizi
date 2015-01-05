from random import choice
import string
import uuid

from db_op import DB_op


class DBO_random_data_generation(DB_op):

    def __init__(self, lim_n=128, lim_r=256, prob_link_create=0.3):
        """
        generate random DB data
        
        @return: tuple consisting of the random node,link labels generated
        """
        assert 2 <= lim_n

        super(DBO_random_data_generation, self).__init__()

        self.n_label = rand_label()
        self.r_label = rand_label()
        q_arr = ['with 0 as _',  # TODO clean: foreach triggers SyntaxException: otherwise
                 'foreach (rid in range(0,%d)' % (lim_n - 1),
                 '|',
                 'create (:%s {id: rid, n_attr_0:toInt(%d * rand())}))' % (self.n_label, lim_n)
                ]

        q = ' '.join(q_arr)
        self.add_statement(q)

        q_arr = ['match (s:%s),(d:%s)' % (self.n_label, self.n_label),
                 'with s,d',
                 'limit %d' % (lim_r - 1),
                 'where rand() < %.2f' % (prob_link_create),
                 'create (s)-[:%s {l_attr_0:toInt(%d * rand())}]->(d)' % (self.r_label, lim_r)]

        q = ' '.join(q_arr)
        self.add_statement(q)

    @property
    def node_set_label(self):
        return self.n_label

    @property
    def link_set_label(self):
        return self.r_label

def rand_id():
    return str(uuid.uuid4())

def rand_label(length=8):
    """
    return random label
    """
    char_set = string.ascii_lowercase + string.ascii_uppercase + string.digits
    return ''.join([choice(string.ascii_lowercase)] + [choice(char_set) for _ in range(length - 1)])

def flush_db(db_ctl):
    """
    complete DB flush: remove all nodes & links
    """
    db_ctl.exec_cypher_query('match (n) optional match (n)-[r]-() delete n,r')



    q = ' '.join(q_arr)
    op = DBO_cypher_query(q)
    db_ctl.exec_op(op)

    return (n_label, r_label)

