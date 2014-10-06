import unittest
import db_controller
import logging
import db_controller as dbc

from rhizi_server import Config

class TestDBController(unittest.TestCase):

    db_ctl = None
    log = None

    n_map = { 'Skill': [{'name': 'Kung Fu', 'id': 'skill_00' },
                        {'name': 'Judo', 'id': 'skill_01' }
                        ],

              'Person': [{'name': 'Bob', 'id': 'person_00', 'age': 128 },
                         {'name': 'Alice', 'id': 'person_01', 'age': 256 }
                         ]
            }

    @classmethod
    def setUpClass(self):
        cfg = Config.init_from_file('res/etc/rhizi-server.conf')
        self.log = logging.getLogger('rhizi')
        self.db_ctl = dbc.DB_Controller(cfg)

    def setUp(self):
        self.db_ctl.exec_op(dbc.DBO_add_node_set(self.n_map))

    def test_load_node_set_by_attribute(self):
        filter_map = { 'name': ['Bob', 'Judo'],
                       'age': [128] }
        n_set = self.db_ctl.exec_op(dbc.DBO_load_node_set_by_attribute(filter_map))
        self.assertEqual(len(n_set), 1)
        
        filter_map = { 'age': [128, 256, 404] }
        n_set = self.db_ctl.exec_op(dbc.DBO_load_node_set_by_attribute(filter_map))
        self.assertEqual(len(n_set), 2)

    def test_load_node_set_by_id_attribute(self):
        n_set = self.db_ctl.exec_op(dbc.DBO_load_node_set_by_id_attribute(['skill_00', 'person_01']))
        self.assertEqual(len(n_set), 2)

    def test_node_DB_id_lifecycle(self):
        """
        test node DB id life cycle
        """
        id_set = self.db_ctl.exec_op(dbc.DBO_add_node_set(self.n_map))
        n_set = self.db_ctl.exec_op(dbc.DBO_load_node_set_by_DB_id(id_set))
        self.assertEqual(len(n_set), len(id_set), 'incorrect result size')

    def test_load_node_set_by_DB_id(self): pass

    def tearDown(self): pass

if __name__ == "__main__":
    unittest.main()
