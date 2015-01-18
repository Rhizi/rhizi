"""
Various test utilities
"""
import db_controller as dbc
from model.model import Link
from neo4j_test_util import gen_random_name
from neo4j_util import generate_random_id__uuid
from rz_kernel import RZ_Kernel
from rz_mesh import init_ws_interface
from rz_server import init_webapp


def init_test_db_controller(cfg):
    ret = dbc.DB_Controller(cfg)
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
