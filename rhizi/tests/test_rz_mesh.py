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

import gevent

from gevent import Greenlet as greenlet
import json
import logging
from socketIO_client import SocketIO, BaseNamespace
import unittest
from six.moves.urllib.request import Request, urlopen

from ..model.graph import Attr_Diff
from ..model.graph import Topo_Diff
from . import neo4j_test_util
from ..neo4j_util import generate_random_id__uuid
from ..rz_api_websocket import WebSocket_Graph_NS

from . import util
from .test_util__pydev import debug__pydev_pd_arg
from rhizi.tests.util import RhiziExternalBaseTest


class RZ_websocket(object):

    def __init__(self, rz_config, namespace=BaseNamespace):
        self.namespace = namespace
        self.address = rz_config.listen_address
        self.port = rz_config.listen_port

    def __enter__(self):
        sock = SocketIO(self.address, self.port)
        ns_sock = sock.define(self.namespace, '/graph')
        self.sock = sock
        print(sock)
        return sock, ns_sock

    def __exit__(self, e_type, e_value, e_traceback):
        self.sock.disconnect()

class TestMeshAPI(RhiziExternalBaseTest):
    """
    currently requires a running rhizi server instance
    """
    @classmethod
    def setUpClass(cls):
        logging.basicConfig(level=logging.DEBUG)
        RhiziExternalBaseTest.setUpClass()
        cls.address_port = '%s:%s' % (cls.cfg.listen_address, cls.cfg.listen_port)

    @classmethod
    def tearDownClass(cls):
        RhiziExternalBaseTest.tearDownClass()

    def new_websocket(self, namespace):
        return RZ_websocket(rz_config=self.cfg, namespace=namespace)

    @unittest.skip("fails due to not waiting enough or bad websocket request")
    def test_REST_post_triggers_ws_multicast__topo_diff(self):

        class NS_test(BaseNamespace):

            def on_diff_commit__topo(self, *data):
                logging.debug('got data {}'.format(data))
                greenlet.getcurrent().data = data
                raise KeyboardInterrupt()  # TODO: cleanup: properly close socket

        test_label = neo4j_test_util.rand_label()
        n, n_id = util.generate_random_node_dict(test_label)
        topo_diff = Topo_Diff(node_set_add=[n])

        # TODO: replace with using the rhizi-API python client library
        def c_0():
            logging.debug('c_0 started')
            gevent.sleep(20)
            logging.debug('c_0 after sleep')
            with self.new_websocket(namespace=NS_test) as (sock, _):
                logging.debug('c_0 created websocket')
                sock.wait(8)
            logging.debug('c_0 done')


        def c_1():
            logging.debug('c_1 started')
            gevent.sleep(25) # wait for websocket to start - should use signaling between the events
            logging.debug('c_1 after initial sleep')
            data = json.dumps({'topo_diff': topo_diff.to_json_dict()})
            req = Request(url='http://%s/graph/diff-commit-topo' % (self.address_port),
                                  data=data,
                                  headers={'Content-Type': 'application/json'})

            logging.debug('c_1 before urlopen')
            f = urlopen(req)
            f.close()
            logging.debug('c_1 done')

        c0_t = gevent.spawn(c_0)
        c1_t = gevent.spawn(c_1)
        c0_t.data = None
        logging.debug('before gevent.joinall')
        gevent.joinall([c0_t, c1_t])

        self.assertNotEqual(None, c0_t.data)
        self.assertEqual(2, len(c1_t.data))

    @unittest.skip("fails due to not waiting enough or bad websocket request")
    def test_ws_event__topo_diff(self):

        class NS_test(BaseNamespace):

            def on_diff_commit__topo(self, *data):
                greenlet.getcurrent().data = data
                raise KeyboardInterrupt()  # TODO: cleanup: properly close socket

        test_label = neo4j_test_util.rand_label()
        n_0, n_0_id = util.generate_random_node_dict(test_label)
        n_1, n_1_id = util.generate_random_node_dict(test_label)
        l, l_id = util.generate_random_link_dict(test_label, n_0_id, n_1_id)
        topo_diff = Topo_Diff(node_set_add=[n_0, n_1], link_set_add=[l])

        def c_0():
            with self.new_websocket(namespace=NS_test) as (_, ns_sock):
                c1_t.switch()  # allow peer to connect
                data = json.dumps(topo_diff, cls=Topo_Diff.JSON_Encoder)
                ns_sock.emit('diff_commit__topo', data)
                c1_t.switch()

        def c_1():
            with self.new_websocket(namespace=NS_test) as (sock, _):
                c0_t.switch()  # allow peer to emit
                sock.wait(8)  # allow self to receive

        c0_t = greenlet(c_0)
        c1_t = greenlet(c_1)
        c1_t.data = None
        c0_t.switch()

        self.assertTrue(None != c1_t.data)
        self.assertEqual(2, len(c1_t.data))

        diff_in = Topo_Diff.from_json_dict(c1_t.data[0])
        commit_ret = Topo_Diff.Commit_Result_Type.from_json_dict(c1_t.data[1])

        self.assertEqual(Topo_Diff, type(diff_in))
        self.assertEqual(Topo_Diff.Commit_Result_Type, type(commit_ret))

    @unittest.skip("fails due to not waiting enough or bad websocket request")
    def test_ws_event__attr_diff(self):

        class NS_test(BaseNamespace):

            def on_diff_commit__attr(self, *data):
                greenlet.getcurrent().data = data
                raise KeyboardInterrupt()  # TODO: cleanup: properly close socket

        test_label = neo4j_test_util.rand_label()
        n, n_id = util.generate_random_node_dict(test_label)

        # apply attr_diff
        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_write(n_id, 'attr_0', 0)
        attr_diff.add_node_attr_write(n_id, 'attr_1', 'a')
        attr_diff.add_node_attr_rm(n_id, 'attr_2')

        def c_0():
            with self.new_websocket(namespace=NS_test) as (_, ns_sock):
                c1_t.switch()  # allow peer to connect
                data = json.dumps(attr_diff)
                ns_sock.emit('diff_commit__attr', data)
                c1_t.switch()

        def c_1():
            with self.new_websocket(namespace=NS_test) as (sock, _):
                c0_t.switch()  # allow peer to emit
                sock.wait(8)  # allow self to receive

        c0_t = greenlet(c_0)
        c1_t = greenlet(c_1)
        c1_t.data = None
        c0_t.switch()

        self.assertTrue(None != c1_t.data)
        self.assertEqual(2, len(c1_t.data))

        diff_in = Attr_Diff.from_json_dict(c1_t.data[0])
        commit_ret = Attr_Diff.from_json_dict(c1_t.data[1])

        self.assertEqual(Attr_Diff, type(diff_in))
        self.assertEqual(Attr_Diff, type(commit_ret))

@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='rhizi.tests.test_rz_mesh.TestMeshAPI.test_REST_post_triggers_ws_multicast__topo_diff', verbosity=2)

if __name__ == "__main__":
    main()
