"""
Various test utilities
"""
from rz_server import init_webapp
from rz_mesh import init_ws_interface
import db_controller as dbc

from neo4j_test_util import rand_id
from rz_kernel import RZ_Kernel

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
        nid = rand_id()

    return {'__label_set': ['T_' + n_type], 'id': nid }, nid
