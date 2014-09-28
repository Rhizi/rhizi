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
        self.webapp = rhizi_api.webapp.test_client()

    def test_load_node_non_existing(self):
        """
        test loading a non existing node
        """
        node_id = 'non_existing_id'
        rv = self.webapp.post('/load/node-single', data=dict(id=node_id))
        rsp = json.loads(rv.data)
        data = rsp['data']
        err = rsp['error']
        self.assertEqual(None, err)
        self.assertEqual(0, len(data))

    def test_load_node_existing(self):
        """
        test loading an existing node
        """
        node_id = 'skill_00'
        rv = self.webapp.post('/load/node-single', data=dict(id=node_id))
        n_set = json.loads(rv.data)['data']
        
        self.assertEqual(1, len(n_set))
        self.assertEqual(n_set[0]['id'], node_id)

if __name__ == "__main__":
    unittest.main()
