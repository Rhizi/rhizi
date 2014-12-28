from greenlet import greenlet
import json
import logging
from socketIO_client import SocketIO, BaseNamespace
import unittest

from model.graph import Topo_Diff
from neo4j_test_util import rand_id


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
            return sock, ns_sock

        def __exit__(self, e_type, e_value, e_traceback):
            pass

    def x_test_add_node_set(self):

        class NS_test(BaseNamespace):

            def on_diff_commit__topo(self, json_str):
                todo_diff = Topo_Diff.from_json_dict(json.loads(json_str))
                n_id = todo_diff.node_set_add[0].get('id')
                greenlet.getcurrent().n_id_received = n_id

                # FIXME: properly close socket, avoid c_1 socket wait
                self._transport._connection.send_close()

        n_id = rand_id()
        n_set = [{'__type': 'xxx', 'id': n_id }]
        topo_diff = Topo_Diff(node_set_add=n_set)

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
        c0_t.switch()

        self.assertEqual(c1_t.n_id_received, n_id)

if __name__ == "__main__":

    unittest.main()

