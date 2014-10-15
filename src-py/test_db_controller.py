import unittest
import logging
import db_controller as dbc

from rhizi_server import Config
from neo4j_test_util import rand_id
from neo4j_test_util import flush_db

from model.graph import Attribute_Diff as Attr_Diff
from model.graph import Topo_Diff as Topo_Diff

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

    l_map = { 'Knows' : [{'__src': 'person_00', '__dst': 'skill_00'},
                         {'__src': 'person_00', '__dst': 'skill_01'}] }

    @classmethod
    def setUpClass(self):
        cfg = Config.init_from_file('res/etc/rhizi-server.conf')
        self.db_ctl = dbc.DB_Controller(cfg)
        self.db_ctl.exec_op(dbc.DBO_add_node_set(self.n_map))
        self.db_ctl.exec_op(dbc.DBO_add_link_set(self.l_map))
        self.log = logging.getLogger('rhizi')

    def setUp(self):
        pass

    def test_db_op_statement_iteration(self):
        s_arr = ['create (b:Book {title: \'foo\'}) return b',
                 'match (n) return n', ]

        op = dbc.DB_op()
        op.add_statement(s_arr[0])
        op.add_statement(s_arr[1])

        i = 0
        for _, s, r in op:
            # access: second tuple item -> REST-form 'statement' key
            self.assertEqual(s_arr[i], s['statement'])
            self.assertEqual(None, r)
            i = i + 1

        self.db_ctl.exec_op(op)

        i = 0
        for _, s, r_set in op:
            # access: second tuple item -> REST-form 'statement' key
            self.assertNotEqual(None, r_set)
            for x in r_set:
                pass
            i = i + 1

    def test_add_node_set(self):
        n_map = { 'T_test_add_node_set': [{'id': rand_id()}, {'id': rand_id()}] }
        op = dbc.DBO_add_node_set(n_map)

        self.assertEqual(len(op.statement_set), 1)  # assert a single statement is issued

        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 2)

    def test_add_link_set(self):
        src_id = rand_id()
        dst_id_0 = rand_id()
        dst_id_1 = rand_id()
        n_map = { 'T_test_add_node_set': [{'id': src_id },
                                          {'id': dst_id_0 },
                                          {'id': dst_id_1 }] }
        self.db_ctl.exec_op(dbc.DBO_add_node_set(n_map))

        l_map = { 'T_test_add_link_set' : [{'__src': src_id, '__dst': dst_id_0},
                                           {'__src': src_id, '__dst': dst_id_1}] }

        op = dbc.DBO_add_link_set(l_map)
        self.assertEqual(len(op.statement_set), 2)  # no support yet for parameterized statements for link creation

        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 2)

    def test_match_node_set_by_type(self):
        op = dbc.DBO_match_node_id_set(filter_type='Person')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 2)

        op = dbc.DBO_match_node_id_set(filter_type='Nan_Type')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 0)

    def test_match_node_set_by_attribute(self):
        fam = { 'name': ['Bob', u'Judo'], 'age': [128] }
        n_set = self.db_ctl.exec_op(dbc.DBO_match_node_id_set(filter_attr_map=fam))
        self.assertEqual(len(n_set), 1)

        fam = { 'age': [128, 256, 404] }
        n_set = self.db_ctl.exec_op(dbc.DBO_match_node_id_set(filter_attr_map=fam))
        self.assertEqual(len(n_set), 2)

    def test_match_node_set_by_DB_id(self): pass  # TODO

    def test_match_node_set_by_id_attribute(self):
        n_set = self.db_ctl.exec_op(dbc.DBO_match_node_set_by_id_attribute(['skill_00', 'person_01']))
        self.assertEqual(len(n_set), 2)

    def test_match_link_set_by_type(self):
        op = dbc.DBO_match_link_id_set(filter_type='Knows')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 2)

        op = dbc.DBO_match_link_id_set(filter_type='Nan_Type')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 0)

    def test_match_link_set_by_src_or_dst_id_attributes(self):
        op = dbc.DBO_match_link_set_by_src_or_dst_id_attributes(src_id='person_00', dst_id='skill_00')
        n_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(n_set), 1)

        op = dbc.DBO_match_link_set_by_src_or_dst_id_attributes(src_id='person_00')
        n_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(n_set), 2)

        op = dbc.DBO_match_link_set_by_src_or_dst_id_attributes(dst_id='skill_00')
        n_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(n_set), 1)

    def test_node_DB_id_lifecycle(self):
        """
        test node DB id life cycle
        """
        id_set = self.db_ctl.exec_op(dbc.DBO_add_node_set({'Person': [{'name': 'John Doe', 'id': 'jdoe_00'},
                                                                      {'name': 'John Doe', 'id': 'jdoe_01'}]}))
        n_set = self.db_ctl.exec_op(dbc.DBO_load_node_set_by_DB_id(id_set))
        self.assertEqual(len(n_set), len(id_set), 'incorrect result size')

    def test_partial_query_set_execution_success(self):
        """
        test:
            - statement execution stops at first invalid statement
            - assert create statement with result data does not actually persist in DB 
            
        From the REST API doc: 'If any errors occur while executing statements,
        the server will roll back the transaction.'
        """
        n_id = 'test_partial_query_set_execution_success'

        op = dbc.DB_op()
        op.add_statement("create (n:Person {id: '%s'}) return n" % (n_id), {})  # valid statement
        op.add_statement("match (n) return n", {})  # valid statement
        op.add_statement("non-valid statement #1", {})
        op.add_statement("non-valid statement #2", {})

        self.db_ctl.exec_op(op)

        self.assertEqual(len(op.result_set), 2)
        self.assertEqual(len(op.error_set), 1)

        # assert node creation did not persist
        n_set = self.db_ctl.exec_op(dbc.DBO_match_node_set_by_id_attribute([n_id]))
        self.assertEqual(len(n_set), 0)

    def test_topo_diff_commit(self):
        n_0_id = rand_id()
        n_1_id = rand_id()

        n_set = [{'__type': 'T_test_topo_diff_commit', 'id': n_0_id },
                 {'__type': 'T_test_topo_diff_commit', 'id': n_1_id }]
        l_set = [{'__type': 'T_test_topo_diff_commit', '__src': n_0_id, '__dst': n_1_id},
                 {'__type': 'T_test_topo_diff_commit', '__src': n_1_id, '__dst': n_0_id}]

        topo_diff = Topo_Diff(node_set_add=n_set,
                              link_set_add=l_set)

        op = dbc.DBO_topo_diff_commit(topo_diff)
        self.assertEqual(len(op.statement_set), 3) # one parameterized node create. 2 link create
        self.db_ctl.exec_op(op)
        
        id_set = self.db_ctl.exec_op(dbc.DBO_match_node_set_by_id_attribute([n_0_id, n_1_id]))
        self.assertEqual(len(id_set), 2)
        id_set = self.db_ctl.exec_op(dbc.DBO_match_link_set_by_src_or_dst_id_attributes(src_id=n_0_id, dst_id=n_1_id))
        self.assertEqual(len(id_set), 1)
        id_set = self.db_ctl.exec_op(dbc.DBO_match_link_set_by_src_or_dst_id_attributes(src_id=n_1_id, dst_id=n_0_id))
        self.assertEqual(len(id_set), 1)

    def tearDown(self): pass

if __name__ == "__main__":
    unittest.main()
