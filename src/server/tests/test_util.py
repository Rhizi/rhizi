#    This file is part of rhizi, a collaborative knowledge graph editor.
#    Copyright (C) 2014-2015  Rhizi
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as published
#    by the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.


"""
Various test utilities
"""
import string
import random
import logging
from time \
    import sleep
import sys
from unittest import TestCase

from .. import db_controller as dbc
from ..model.graph import Topo_Diff
from ..model.model import Link, RZDoc
from ..neo4j_util import generate_random_id__uuid, generate_random_rzdoc_id
from ..rz_kernel import RZ_Kernel
from ..rz_mesh import init_ws_interface
from ..rz_server import init_webapp
from ..rz_user import User_Signup_Request
from ..rz_config import RZ_Config
from .. import rz_api
from ..db_op import DBO_factory__default

from .neo4j_test_util import rand_label


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


def generate_random_RZDoc(rzdoc_name=None):
    if rzdoc_name is None:
        rzdoc_name = gen_random_name()

    rzdoc = RZDoc(rzdoc_name)
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


db_ctl = None
kernel = None
cfg = None


def get_connection():
    if cfg is None:
        initialize_test_kernel()
    return db_ctl, kernel


def initialize_test_kernel():
    global db_ctl
    global kernel
    global cfg
    sys.stderr.write("initializing db\n")
    cfg = RZ_Config.init_from_file('res/etc/rhizi-server.conf')
    db_ctl = dbc.DB_Controller(cfg.db_base_url)
    rz_api.db_ctl = db_ctl

    log = logging.getLogger('rhizi')
    log.setLevel(logging.DEBUG)
    log_handler_c = logging.FileHandler('rhizi-tests.log')
    log_handler_c.setFormatter(logging.Formatter(u'%(asctime)s [%(levelname)s] %(name)s %(message)s'))
    log.addHandler(log_handler_c)

    # bootstrap kernel
    kernel = RZ_Kernel()
    kernel.db_ctl = db_ctl
    kernel.db_op_factory = DBO_factory__default()
    kernel.start()

    while not kernel.is_DB_status__ok():  # wait for kernel to initialize...
        sleep(0.3)
        sys.stderr.write(".\n")


class RhiziTestBase(TestCase):

    @classmethod
    def setUpClass(clz):

        db_ctl, kernel = get_connection()
        clz.db_ctl = db_ctl
        rz_api.db_ctl = clz.db_ctl
        clz.kernel = kernel