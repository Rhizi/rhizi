from greenlet import greenlet
import json
import logging
from socketIO_client import SocketIO, BaseNamespace
import unittest
import urllib2

from model.graph import Attr_Diff
from model.graph import Topo_Diff
from neo4j_test_util import rand_id
import neo4j_test_util
import test_util


class TestMeshAPI(unittest.TestCase):
    """
    currently requires a running rhizi server instance
    """
    def setUp(self):
        pass

    @classmethod
    def setUpClass(self):
        logging.basicConfig(level=logging.DEBUG)

    @classmethod
    def tearDownClass(cls):
        pass

    class rz_socket:

        def __init__(self, namespace=BaseNamespace):
            self.namespace = namespace

        def __enter__(self):
            sock = SocketIO('rhizi.local', 8080)
            ns_sock = sock.define(self.namespace, '/graph')
            self.sock = sock
            return sock, ns_sock

        def __exit__(self, e_type, e_value, e_traceback):
            self.sock.disconnect()

    def _emit_tx_topo_diff(self):
        with TestMeshAPI.rz_socket() as (_, ns_sock):
            n_set = [{'__label_set': ['xxx'], 'id': rand_id() }]
            topo_diff = Topo_Diff(node_set_add=n_set)
            data = json.dumps(topo_diff, cls=Topo_Diff.JSON_Encoder)
            ns_sock.emit('diff_commit__topo', data)

    def test_REST_post_triggers_ws_multicast__topo_diff(self):

        class NS_test(BaseNamespace):

            def on_diff_commit__topo(self, json_dict):
                ret_diff = Topo_Diff.Commit_Result_Type.from_json_dict(json_dict)
                greenlet.getcurrent().received_diff = ret_diff
                self._transport._connection.send_close()  # FIXME: properly close socket, avoid c_1 socket wait

        test_label = neo4j_test_util.rand_label()
        n, n_id = test_util.generate_random_node_dict(test_label)
        topo_diff = Topo_Diff(node_set_add=[n])

        def c_0():

            with TestMeshAPI.rz_socket(namespace=NS_test) as (sock, _):
                c1_t.switch()  # allow peer to POST
                sock.wait(8)  # allow self to receive

        def c_1():
            data = json.dumps({'topo_diff': topo_diff.to_json_dict()})
            req = urllib2.Request(url='http://rhizi.local:8080/graph/diff-commit-topo',
                                  data=data,
                                  headers={'Content-Type': 'application/json'})

            f = urllib2.urlopen(req)
            f.close()
            c0_t.switch()

        c0_t = greenlet(c_0)
        c0_t.received_diff = None
        c1_t = greenlet(c_1)
        c0_t.switch()

        self.assertTrue(None != c0_t.received_diff)
        self.assertEqual(1, len(c0_t.received_diff.node_id_set_add))

    def test_ws_event__topo_diff(self):

        class NS_test(BaseNamespace):

            def on_diff_commit__topo(self, json_dict):
                ret_diff = Topo_Diff.Commit_Result_Type.from_json_dict(json_dict)
                greenlet.getcurrent().received_diff = ret_diff
                self._transport._connection.send_close()  # FIXME: properly close socket, avoid c_1 socket wait

        test_label = neo4j_test_util.rand_label()
        n, n_id = test_util.generate_random_node_dict(test_label)
        topo_diff = Topo_Diff(node_set_add=[n])

        def c_0():
            with TestMeshAPI.rz_socket(namespace=NS_test) as (_, ns_sock):
                c1_t.switch()  # allow peer to connect
                data = json.dumps(topo_diff, cls=Topo_Diff.JSON_Encoder)
                ns_sock.emit('diff_commit__topo', data)
                c1_t.switch()

        def c_1():
            with TestMeshAPI.rz_socket(namespace=NS_test) as (sock, _):
                c0_t.switch()  # allow peer to emit
                sock.wait(8)  # allow self to receive

        c0_t = greenlet(c_0)
        c1_t = greenlet(c_1)
        c1_t.received_diff = None
        c0_t.switch()

        self.assertTrue(None != c1_t.received_diff)
        self.assertEqual(1, len(c1_t.received_diff.node_id_set_add))

    def test_ws_event__attr_diff(self):

        class NS_test(BaseNamespace):

            def on_diff_commit__attr(self, json_str):
                attr_diff = Attr_Diff.from_json_dict(json_str)
                greenlet.getcurrent().received_diff = attr_diff
                self._transport._connection.send_close()  # FIXME: properly close socket, avoid c_1 socket wait

        test_label = neo4j_test_util.rand_label()
        n, n_id = test_util.generate_random_node_dict(test_label)

        # apply attr_diff
        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_write(n_id, 'attr_0', 0)
        attr_diff.add_node_attr_write(n_id, 'attr_1', 'a')
        attr_diff.add_node_attr_rm(n_id, 'attr_2')

        def c_0():
            with TestMeshAPI.rz_socket(namespace=NS_test) as (_, ns_sock):
                c1_t.switch()  # allow peer to connect
                data = json.dumps(attr_diff)
                ns_sock.emit('diff_commit__attr', data)
                c1_t.switch()

        def c_1():
            with TestMeshAPI.rz_socket(namespace=NS_test) as (sock, _):
                c0_t.switch()  # allow peer to emit
                sock.wait(8)  # allow self to receive

        c0_t = greenlet(c_0)
        c1_t = greenlet(c_1)
        c1_t.received_diff = None
        c0_t.switch()

        self.assertTrue(None != c1_t.received_diff)
        self.assertEqual(1, len(c1_t.received_diff.type__node))

if __name__ == "__main__":

    unittest.main()

