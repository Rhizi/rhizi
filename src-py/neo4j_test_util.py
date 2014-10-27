import uuid
import string
from random import choice
import db_controller as dbc

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


def gen_rand_data(db_ctl, lim_n=128, lim_r=256, prob_link_create = 0.3):
    """
    generate random DB data
    
    @return: tuple consisting of the random node,link labels generated
    """
    assert 2 <= lim_n

    n_label = rand_label()
    r_label = rand_label()
    q_arr = ['with 0 as _', # TODO clean: foreach triggers SyntaxException: otherwise
             'foreach (rid in range(0,%d)' % (lim_n - 1),
             '|',
             'create (:%s {id:rid, n_attr_0:toInt(%d * rand())}))' % (n_label, lim_n)
            ]

    q = ' '.join(q_arr)
    op = dbc.DBO_cypher_query(q)
    db_ctl.exec_op(op)

    q_arr = ['match (s:%s),(d:%s)' % (n_label, n_label),
             'with s,d',
             'limit %d' % (lim_r - 1),
             'where rand() < %.2f' % (prob_link_create),
             'create (s)-[:%s {l_attr_0:toInt(%d * rand())}]->(d)' % (r_label,lim_r)]

    q = ' '.join(q_arr)
    op = dbc.DBO_cypher_query(q)
    db_ctl.exec_op(op)

    return (n_label, r_label)

