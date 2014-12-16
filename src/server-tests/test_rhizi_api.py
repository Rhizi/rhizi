import unittest
import db_controller as dbc
import rhizi_api
import json
import logging

from rhizi_server import Config
from werkzeug.test import EnvironBuilder
from werkzeug.test import Client

from db_controller import DB_Driver_Embedded

class TestRhiziAPI(unittest.TestCase):

    def setUp(self):
        self.flush_db()

    @classmethod
    def setUpClass(self):
        cfg = Config.init_from_file('res/etc/rhizi-server.conf')
        self.db_ctl = dbc.DB_Controller(cfg)
        rhizi_api.db_ctl = self.db_ctl

        # TODO extract to superclass
        log = logging.getLogger('rhizi')
        log.setLevel(logging.DEBUG)
        log_handler_c = logging.StreamHandler()
        log.addHandler(log_handler_c)

    def flush_db(self):
        """
        complete DB flush: remove all nodes & links
        """
        self.db_ctl.exec_cypher_query('match (n) optional match (n)-[r]-() delete n,r')

    def test_add_node_set(self):
        """
        add node set test
        """
        node_map = { 'Skill': [{ 'name': 'kung-fu' }, { 'name': 'judo' }] }
        with rhizi_api.webapp.test_client() as c:
            req = c.post('/add/node-set',
                         content_type='application/json',
                         data=json.dumps(dict(node_map=node_map)))
            id_set = json.loads(req.data)['data']
            self.assertEqual(2, len(id_set))
            self.assertTrue(isinstance(id_set[0], int))

    def test_load_node_non_existing(self):
        """
        loading a non existing node test
        """
        id_set = ['non_existing_id']
        with rhizi_api.webapp.test_client() as c:
            req = c.post('/load/node-set-by-id',
                         content_type='application/json',
                         data=json.dumps({ 'id_set': id_set}))
            req_data = json.loads(req.data)
            rz_data = req_data['data']
            rz_err = req_data['error']
            self.assertEqual(None, rz_err)
            self.assertEqual(0, len(rz_data))

    def test_load_node_set_by_id_existing(self):
        """
        loading an existing node test
        """
        id_set = ['skill_00']
        self.db_ctl.exec_cypher_query('create (s:Skill {id: \'skill_00\'} )')

        with rhizi_api.webapp.test_client() as c:
            req = c.post('/load/node-set-by-id',
                         content_type='application/json',
                         data=json.dumps({ 'id_set': id_set}))
            n_set = json.loads(req.data)['data']

            self.assertEqual(1, len(n_set))
            self.assertEqual(n_set[0]['id'], id_set[0])

    def test_load_node_set(self):
        pass

if __name__ == "__main__":
    unittest.main()
