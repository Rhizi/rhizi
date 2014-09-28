import unittest
import db_controller as dbc
import rhizi_api
import json

from rhizi_server import Config

class TestRhiziAPI(unittest.TestCase):

    def setUp(self):
        cfg = Config.init_from_file('res/etc/rhizi-server.conf')
        db_ctl = dbc.DB_Controller(cfg)
        rhizi_api.db_ctl = db_ctl

    def test_add_node_set(self):
        """
        add node set test
        """
        node_map = { 'Skill': { 'name': 'kung-fu' } }
        
        with rhizi_api.webapp.test_client() as c:
            req = c.post('/add/node-set', data={'node_map':node_map})
            rz_data = json.loads(req.data)['data']

    def test_load_node_non_existing(self):
        """
        loading a non existing node test
        """
        node_id = 'non_existing_id'
        with rhizi_api.webapp.test_client() as c:
            req = c.post('/load/node-single', data=dict(id=node_id))
            req_data = json.loads(req.data)
            rz_data = req_data['data']
            rz_err = req_data['error']
            self.assertEqual(None, rz_err)
            self.assertEqual(0, len(rz_data))

    def test_load_node_existing(self):
        """
        loading an existing node test
        """
        node_id = 'skill_00'
        with rhizi_api.webapp.test_client() as c:
            req = c.post('/load/node-single', data=dict(id=node_id))
            n_set = json.loads(req.data)['data']

            self.assertEqual(1, len(n_set))
            self.assertEqual(n_set[0]['id'], node_id)

if __name__ == "__main__":
    unittest.main()
