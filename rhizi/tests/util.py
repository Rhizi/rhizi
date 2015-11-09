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
from time import sleep
import socket
import sys
import os
import urllib2
import subprocess
import atexit
from glob import glob
import tarfile
import functools
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
from ..db_op import DBO_factory__default, DBO_raw_query_set
from ..rz_user_db import Fake_User_DB

from .neo4j_test_util import rand_label


def parentdir(x):
    return os.path.realpath(os.path.join(x, '..'))

def generate_parent_paths():
    cur = cwd = os.getcwd()
    yield cwd
    nextdir = parentdir(cur)
    while nextdir != cur:
        yield nextdir
        cur = nextdir
        nextdir = parentdir(cur)


def find_dir_up_or_abort(dirname):
    for d in generate_parent_paths():
        candidate = os.path.join(d, dirname)
        if os.path.exists(candidate) and os.path.isdir(candidate):
            return candidate
    raise Exception("{} not found".format(dirname))


def env(name, default):
    return os.environ.get(name, default)



REPO_ROOT = parentdir(find_dir_up_or_abort('.git'))

MTA_PORT = int(env('RHIZI_TESTS__MTA_PORT', 10025))

NEO4J_VERSION = '2.3.0'
NEO4J_URL = "http://neo4j.com/artifact.php?name=neo4j-community-{}-unix.tar.gz".format(NEO4J_VERSION)
ASSET_DIRECTORY = env('RHIZI_TESTS__ASSET_DIRECTORY', os.path.join(REPO_ROOT, 'assets'))
NEO4J_ARCHIVE = os.path.join(ASSET_DIRECTORY, 'neo4j-community-{}-unix.tar.gz'.format(NEO4J_VERSION))
NEO4J_SUBDIR = 'neo4j-community-{}'.format(NEO4J_VERSION)
NEO4J_DEST = os.path.join(ASSET_DIRECTORY, NEO4J_SUBDIR)
NEO4J_BIN = os.path.join(NEO4J_DEST, "bin", "neo4j")
NEO4J_PORT = int(env('RHIZI_TESTS__NEO4J_PORT', 28800))

NEO4J_STDOUT = os.path.join(NEO4J_DEST, "stdout.log")
MTA_STDOUT = os.path.join(ASSET_DIRECTORY, "mta.log")

NEO4J_SERVER_CONF = os.path.join(NEO4J_DEST, 'conf', 'neo4j-server.properties')
NEO4J_SERVER_CONF_TEMPLATE = \
"""org.neo4j.server.database.location=data/graph.db
org.neo4j.server.db.tuning.properties=conf/neo4j.properties
dbms.security.auth_enabled=false
org.neo4j.server.webserver.port={port}
org.neo4j.server.webserver.https.enabled=false
org.neo4j.server.http.log.enabled=true
org.neo4j.server.http.log.config=conf/neo4j-http-logging.xml
org.neo4j.server.webadmin.rrdb.location=data/rrd
"""


def httpget(src, dst):
    src_sock = urllib2.urlopen(src)
    total_length = int(src_sock.headers.get('content-length', 0))
    read_length = 0
    with open(dst, 'w+') as fd:
        s = None
        while s != '':
            s = src_sock.read(4096)
            fd.write(s)
            if total_length > 0:
                sys.stdout.write("\r{}%".format((100 * read_length) / total_length))
            else:
                sys.stdout.write("\r{}".format(read_length))
            sys.stdout.flush()


def install_neo4j():
    if os.path.exists(NEO4J_DEST):
        return
    if not os.path.exists(NEO4J_ARCHIVE):
        httpget(NEO4J_URL, NEO4J_ARCHIVE)
    doglob = lambda: set(glob(os.path.join(ASSET_DIRECTORY, '*')))
    prev = doglob()
    tarfile.open(NEO4J_ARCHIVE).extractall(ASSET_DIRECTORY)
    now = doglob()
    new_dirs = {os.path.basename(x) for x in now - prev}
    if new_dirs != {NEO4J_SUBDIR}:
        print("error extracting neo4j: expected {}, got {}".format(NEO4J_SUBDIR, new_dirs))
        raise Exception("Neo4J extracted to unexpected directory place")


subprocesses = []


def launch(args, stdout_filename):
    stdout = open(stdout_filename, 'a+')
    stdout.write('-------------------\n')
    p = subprocess.Popen(args, stdout=stdout, stderr=subprocess.STDOUT)
    print("[{}]: launched {}".format(p.pid, repr(args)))
    subprocesses.append(p)
    return p


def write_template(filename, template, **kw):
    with open(filename, 'w+') as fd:
        fd.write(template.format(**kw))


def wait_for_port(port):
    timeout = 100
    dt = 1
    while timeout > 0:
        s = socket.socket()
        try:
            s.connect(('localhost', port))
        except socket.error:
            pass
        else:
            break
        timeout -= 1
        sleep(0.1)

def abort_if_port_open(port):
    s = socket.socket()
    try:
        s.connect(('localhost', port))
    except:
        pass
    else:
        raise Exception("TCP port {} is open and should not have been".format(port))


def neo4j_write_server_conf():
    write_template(filename=NEO4J_SERVER_CONF, template=NEO4J_SERVER_CONF_TEMPLATE, port=NEO4J_PORT)


def once(f):
    ret = []
    @functools.wraps(f)
    def wrapper(*args, **kw):
        if len(ret) > 0:
            return ret[0]
        ret.append(f(*args, **kw))
        return ret[0]
    return wrapper

@once
def launch_neo4j():
    if env('RHIZI_TESTS__EXTERNAL_NEO4J_PROCESS', False):
        return
    install_neo4j()
    abort_if_port_open(NEO4J_PORT)
    neo4j_write_server_conf()
    launch([NEO4J_BIN, "console"], stdout_filename=NEO4J_STDOUT)
    wait_for_port(NEO4J_PORT)
    neo4j_started = True


@once
def launch_mta():
    if env('RHIZI_TESTS__EXTERNAL_MTA_PROCESS', False):
        return
    launch('python -m smtpd -n -c DebuggingServer localhost:{port}'.format(port=MTA_PORT).split(),
           stdout_filename=MTA_STDOUT)


def kill_subprocesses():
    def ignore_os_error(f):
        try:
            f()
        except OSError:
            pass
    do = lambda f: map(f, subprocesses)
    ignore_os_error(lambda: do(lambda p: p.kill()))
    sleep(0.01)
    awake = [p for p in subprocesses if p.poll() is None]
    if len(awake) == 0:
        return
    print("terminating {} processes".format(len(awake)))
    ignore_os_error(lambda: do(lambda p: p.terminate()))


atexit.register(kill_subprocesses)


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


def gen_random_user_signup():
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
user_db = None
webapp = None

def get_connection():
    if cfg is None:
        initialize_test_kernel()
    return db_ctl, kernel


def initialize_test_kernel():
    global db_ctl
    global kernel
    global cfg
    global user_db
    global webapp

    sys.stderr.write("initializing neo4j\n")
    launch_neo4j()
    launch_mta()

    sys.stderr.write("connecting to db\n")
    cfg = RZ_Config.generate_default()
    cfg.access_control = False
    cfg.neo4j_url = 'http://localhost:{}'.format(NEO4J_PORT)
    cfg.mta_host = 'localhost'
    cfg.mta_port = MTA_PORT
    db_ctl = dbc.DB_Controller(cfg.db_base_url)
    rz_api.db_ctl = db_ctl

    log = logging.getLogger('rhizi')
    log.setLevel(logging.DEBUG)
    log_handler_c = logging.FileHandler('rhizi-tests.log')
    log_handler_c.setFormatter(logging.Formatter(u'%(asctime)s [%(levelname)s] %(name)s %(message)s'))
    log.addHandler(log_handler_c)

    # clear db !!!
    db_ctl.exec_op(DBO_raw_query_set(['match n optional match (n)-[l]-(m) delete n,l return count(n),count(l)']))

    # bootstrap kernel
    kernel = RZ_Kernel()
    kernel.db_ctl = db_ctl
    kernel.db_op_factory = DBO_factory__default()
    kernel.start()

    while not kernel.is_DB_status__ok():  # wait for kernel to initialize...
        sleep(0.3)
        sys.stderr.write(".\n")

    user_db = Fake_User_DB()

    webapp = init_webapp(cfg, kernel)
    webapp.user_db = user_db
    kernel.db_op_factory = webapp  # assist kernel with DB initialization
    init_ws_interface(cfg, kernel, webapp)


class RhiziTestBase(TestCase):

    @classmethod
    def setUpClass(clz):

        db_ctl, kernel = get_connection()
        clz.cfg = cfg
        clz.db_ctl = db_ctl
        clz.user_db = user_db
        rz_api.db_ctl = clz.db_ctl
        clz.kernel = kernel
        clz.webapp = webapp


def test_main():
    #initialize_test_kernel()
    launch_neo4j()
    print("sleeping")
    while True:
        sleep(1)

if __name__ == '__main__':
    test_main()
