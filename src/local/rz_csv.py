#!/usr/bin/python2.7

"""
Import CSV files into Rhizi Server via pythonic API.

Tricky, since this is the only API user. Try to use it exactly as the REST/WS
API would, just without actually creating a socket connection.  """

import sys
import os
root = os.path.join(os.path.dirname(__file__), '..', '..')
sys.path.append(os.path.join(root, 'src', 'server'))

from rz_api_common import sanitize_input__topo_diff
from rz_kernel import RZ_Kernel
import db_controller as dbc
from rz_server import Config

from model.graph import Topo_Diff

def topo_diff_json(node_set_add=[], link_set_add=[]):
    topo_diff_dict = ({
         u'link_id_set_rm': [],
         u'link_set_add': link_set_add,
         u'drop_conjugator_links': True,
         u'node_set_add': node_set_add,
         u'node_id_set_rm': []
        })
    topo_diff = Topo_Diff.from_json_dict(topo_diff_dict)
    sanitize_input__topo_diff(topo_diff)
    return topo_diff;

cfg = Config.init_from_file(os.path.join(root, 'res', 'etc', 'rhizi-server.conf'))
kernel = RZ_Kernel()
kernel.db_ctl = dbc.DB_Controller(cfg) # yes, that. FIXME
ctx = {} # FIXME not logged it - fix later (also, don't do this here, put constructor in kernel)

def commit(topo_diff):
    _, commit_ret = kernel.diff_commit__topo(topo_diff, ctx)

node_set_add = [{u'name': u'r', u'__label_set': [u'Person'], u'id': u'i8g3ue7v'}]
link_set_add = []

commit(topo_diff_json(node_set_add=node_set_add))
commit(topo_diff_json(link_set_add=link_set_add))
