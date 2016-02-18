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

import gipc
import gevent

from gevent import Greenlet as greenlet
import json
import logging
import unittest
from six.moves.urllib.request import Request, urlopen

from rhizi.model.graph import Attr_Diff
from rhizi.model.graph import Topo_Diff
from rhizi.tests import neo4j_test_util

from rhizi.tests import util
from rhizi.tests.test_util__pydev import debug__pydev_pd_arg
from rhizi.tests.util import RhiziExternalBaseTest
from rhizi import socketio_client

class RZ_websocket(object):

    def __init__(self, rz_config, handler):
        self.handler = handler
        self.address = rz_config.listen_address
        self.port = rz_config.listen_port
        self.socketio_namespace = '/graph' # TODO: use

    def send_subscribe(self, rzdoc_name):
        self.sock.send_event('rzdoc_subscribe', {'rzdoc_name': rzdoc_name})

    def on_open(self):
        if hasattr(self.handler, 'on_open'):
            self.handler.on_open()

    def on_close(self):
        if hasattr(self.handler, 'on_close'):
            self.handler.on_close()

    def on_message(self, msg):
        logging.debug('on_message: {}: {}'.format(self, msg))
        if 'name' in msg:
            method_name = 'on_{}'.format(msg['name'].replace(' ','_'))
            if hasattr(self.handler, method_name):
                getattr(self.handler, method_name)(msg['data'])
            else:
                logging.debug('{}: {}: unhandled'.format(self, msg['name']))

    def send(self, msg):
        self.sock.send(socketio_client.encode_for_socketio(msg))

    def __enter__(self):
        sock = socketio_client.SocketIOClient(
                        host=self.address, port=self.port,
                        on_open=self.on_open, on_close=self.on_close,
                        on_message=self.on_message)
        self.sock = sock
        logging.debug('enter: created sock {}'.format(sock))
        return self

    def __exit__(self, e_type, e_value, e_traceback):
        pass


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

    def new_websocket(self, handler):
        return RZ_websocket(rz_config=self.cfg, handler=handler)

    def test_gipc(self):
        def main():
            logging.error('here we are')
            print("this should work")
        gipc.start_process(main).join()
        self.assertFalse(False)

    def test_single_client(self):

        def process_main(writeend):

            class Handler(object):
                def on_open(self):
                    logging.debug('opened in test, registering')
                    sock.send_subscribe(rzdoc_name=rzdoc_name)
                    writeend.put('open')
                    raise SystemExit

            with self.new_websocket(handler=Handler()) as sock:
                logging.debug('created websocket')
                writeend.put('created')
                logging.debug('entering eventloop')
                sock.sock.wsa.run_forever()
                logging.debug('exited eventloop')
            logging.debug('done')

        rzdoc_name = 'Welcome Rhizi'
        self.rz_server_process.writeend.put(('create-rzdoc', rzdoc_name))

        readend, writeend = gipc.pipe()
        p = gipc.start_process(process_main, (writeend,))
        p.join()
        self.assertEqual(readend.get(), 'created')
        self.assertEqual(readend.get(), 'open')

    def test_two_client(self):

        def process_main(writeend):

            class Handler(object):
                def on_open(self):
                    logging.debug('opened in test, registering')
                    sock.send_subscribe(rzdoc_name=rzdoc_name)

                def on_message(self, msg):
                    # should get this as a result of something happening to the
                    # doc registered to
                    writeend.put(msg)
                    raise SystemExit

            with self.new_websocket(handler=Handler()) as sock:
                logging.debug('c_0 created websocket')
                writeend.put('created')
                logging.debug('entering eventloop')
                sock.sock.wsa.run_forever()
                logging.debug('exited eventloop')
            logging.debug('c_0 done')

        rzdoc_name = 'Welcome Rhizi'
        self.helper_create_doc(rzdoc_name)

        readend, writeend = gipc.pipe()
        p = gipc.start_process(process_main, (writeend,))
        p.join()
        self.assertEqual(readend.get(), 'created')
        data = readend.get()
        self.assertNotEqual(data, None)

    @unittest.skip("fails due to not waiting enough or bad websocket request")
    def test_REST_post_triggers_ws_multicast__topo_diff(self):

        class NS_test(BaseNamespace):

            def on_diff_commit__topo(self, *data):
                logging.debug('got data {}'.format(data))
                # writeend is injected
                if hasattr(self, 'writeend') and self.writeend is not None:
                    self.writeend.put(data)
                else:
                    logging.debug('no writeend')

        test_label = neo4j_test_util.rand_label()
        n, n_id = util.generate_random_node_dict(test_label)
        topo_diff = Topo_Diff(node_set_add=[n])

        # TODO: replace with using the rhizi-API python client library
        def c_0(writeend):
            logging.debug('c_0 started')
            with self.new_websocket(namespace=NS_test) as (sock, _):
                logging.debug('c_0 created websocket')
                sock.wait(8)
            logging.debug('c_0 done')


        def c_1(writeend):
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

        c0_t = gipc.start_process(c_0)
        c1_t = gipc.start_process(c_1)
        c0_t.data = None
        logging.debug('joining c0')
        gipc.join(c0_t)
        gipc.join(c1_t)

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
