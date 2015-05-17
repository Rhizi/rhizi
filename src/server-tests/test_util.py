"""
Various test utilities
"""
import json
import string

import db_controller as dbc
from model.graph import Topo_Diff
from model.model import Link, RZDoc
from neo4j_test_util import rand_label
from neo4j_util import generate_random_id__uuid, generate_random_rzdoc_id
from rz_kernel import RZ_Kernel
from rz_mesh import init_ws_interface
from rz_server import init_webapp
import test_rz_mesh


def init_test_db_controller(cfg):
    ret = dbc.DB_Controller(cfg.db_base_url)
    return ret

def init_test_ws_server(cfg, db_ctl):
    """
    Initialize a test websocket server

    @param db_ctl: an initialized DB_Controller
    """
    kernel = RZ_Kernel()
    webapp = init_webapp(cfg, kernel, db_ctl)
    ws_srv = init_ws_interface(cfg, webapp)
    return ws_srv

def gen_random_name(size=8, char_set=string.ascii_uppercase + string.digits):
    """
    used for random node generation
    """
    return ''.join(random.choice(char_set) for _ in range(size))

def generate_random_node_dict(n_type, nid=None):
    """
    @param n_type: is converted to a label set
    
    @return: a dict based node object representation and the generated node id
    """
    if None == nid:
        nid = generate_random_id__uuid()

    return {'__label_set': [n_type],
            'id': nid,
            'name': gen_random_name() }, nid

def generate_random_link_dict(l_type, src_id, dst_id, lid=None):
    """
    @param l_type: is converted to a single item type array
    
    @return: a dict based node object representation and the generated node id
    """
    if None == lid:
        lid = generate_random_id__uuid()

    ret_dict = Link.link_ptr(src_id, dst_id)
    ret_dict['__type'] = [l_type]
    ret_dict['id'] = lid
    return ret_dict, lid

def generate_random_diff__topo__minimal(test_label):
    """
    @return: a ~minimal Topo_Diff containing three nodes and two links
    """
    n_0, n_0_id = generate_random_node_dict(test_label)
    n_1, n_1_id = generate_random_node_dict(test_label)
    n_2, n_2_id = generate_random_node_dict(test_label)

    l_0, l_0_id = generate_random_link_dict(test_label, n_0_id, n_1_id)
    l_1, l_1_id = generate_random_link_dict(test_label, n_0_id, n_2_id)

    n_set = [n_0, n_1, n_2]
    l_set = [l_0, l_1]
    topo_diff = Topo_Diff(node_set_add=n_set,
                          link_set_add=l_set)
    return topo_diff

def generate_random_RZDoc(test_label):
    rzdoc = RZDoc(test_label)
    rzdoc.id = generate_random_rzdoc_id()
    return rzdoc

def gen_random_user_signup(self):
    seed = gen_random_name()
    us_req = User_Signup_Request(rz_username='rz_username_%s' % (seed),
                                 email_address='%s@localhost' % (seed),
                                 first_name='firstname%s' % (seed),
                                 last_name='lastname%s' % (seed),
                                 pw_plaintxt='aaaa12345')
    return us_req
def ws_emit__topo_diff():
    import logging

    r_label = rand_label()
    n, n_id = generate_random_node_dict(r_label)
    topo_diff = Topo_Diff(node_set_add=[n])
    data = json.dumps(topo_diff, cls=Topo_Diff.JSON_Encoder)

    with test_rz_mesh.RZ_websocket() as (_, ns_sock):
        ns_sock.emit('diff_commit__topo', data)

