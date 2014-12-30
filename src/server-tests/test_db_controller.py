import unittest
import logging
import db_controller as dbc

from rhizi_server import Config
from neo4j_test_util import rand_id
from neo4j_test_util import flush_db
from neo4j_test_util import gen_rand_data
from neo4j_util import Neo4JException

from model.graph import Attr_Diff
from model.graph import Topo_Diff
from model.model import Link

class TestDBController(unittest.TestCase):

    db_ctl = None
    log = None

    n_map = { 'Skill': [{'id': 'skill_00', 'name': 'Kung Fu'},
                        {'id': 'skill_01', 'name': 'Judo'}
                        ],

              'Person': [{'id': 'person_00', 'age': 128, 'name': 'Bob'},
                         {'id': 'person_01', 'age': 256, 'name': 'Alice' }
                         ]
            }

    l_map = { 'Knows' : [Link.link_ptr('person_00', 'skill_00'),
                         Link.link_ptr('person_00', 'skill_01')] }

    @classmethod
    def setUpClass(self):
        cfg = Config.init_from_file('res/etc/rhizi-server.conf')
        self.db_ctl = dbc.DB_Controller(cfg)
        self.log = logging.getLogger('rhizi')
        self.log.addHandler(logging.StreamHandler())

    def setUp(self):
        flush_db(self.db_ctl)  # remove once embedded DB test mode is supported
        self.db_ctl.exec_op(dbc.DBO_add_node_set(self.n_map))
        self.db_ctl.exec_op(dbc.DBO_add_link_set(self.l_map))

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
        op = dbc.DBO_match_node_id_set(filter_label='Person')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 2)

        op = dbc.DBO_match_node_id_set(filter_label='Nan_Type')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 0)

    def test_match_node_set_by_attribute(self):
        fam = { 'name': ['Bob', u'Judo'], 'age': [128] }
        n_set = self.db_ctl.exec_op(dbc.DBO_match_node_id_set(filter_attr_map=fam))
        self.assertEqual(len(n_set), 1)

        fam = { 'age': [128, 256, 404] }
        n_set = self.db_ctl.exec_op(dbc.DBO_match_node_id_set(filter_attr_map=fam))
        self.assertEqual(len(n_set), 2)

    def test_match_node_set_by_DB_id(self):
        pass  # TODO

    def test_match_node_set_by_id_attribute(self):
        n_set = self.db_ctl.exec_op(dbc.DBO_match_node_set_by_id_attribute(['skill_00', 'person_01']))
        self.assertEqual(len(n_set), 2)

    def test_match_link_set_by_type(self):
        op = dbc.DBO_match_link_id_set(filter_label='Knows')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 2)

        op = dbc.DBO_match_link_id_set(filter_label='Nan_Type')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 0)

    def test_load_link_set(self):

        # load by l_ptr
        l_ptr = Link.link_ptr(src_id='person_00', dst_id='skill_00')
        op = dbc.DBO_load_link_set.init_from_link_ptr(l_ptr)
        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 1)

        l_ptr = Link.link_ptr(src_id='person_00')
        op = dbc.DBO_load_link_set.init_from_link_ptr(l_ptr)
        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 2)

        l_ptr = Link.link_ptr(dst_id='skill_00')
        op = dbc.DBO_load_link_set.init_from_link_ptr(l_ptr)
        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 1)

        # load by l_ptr sets
        l_ptr_set = [Link.link_ptr(s, d) for (s, d) in [('person_00', 'skill_00'), ('person_00', 'skill_01')]]
        op = dbc.DBO_load_link_set.init_from_link_ptr_set(l_ptr_set)
        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 2)

        # this should return the same link twice
        l_ptr_set = [Link.link_ptr(s, d) for (s, d) in [('person_00', 'skill_00'), ('person_00', 'skill_01')]]
        l_ptr_set.append(Link.link_ptr(dst_id='skill_00'))
        op = dbc.DBO_load_link_set.init_from_link_ptr_set(l_ptr_set)
        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 3)

    def test_load_node_set_by_DB_id(self):
        """
        test node DB id life cycle
        """

        # create nodes, get DB ids
        op = dbc.DBO_add_node_set({'T_test_load_node_set_by_DB_id': [{'name': 'John Doe'},
                                                                     {'name': 'John Doe'}]})
        id_set = self.db_ctl.exec_op(op)

        # match against DB ids
        op = dbc.DBO_load_node_set_by_DB_id(id_set)
        n_set = self.db_ctl.exec_op(op)
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

        self.assertRaises(Neo4JException, self.db_ctl.exec_op, op)

        self.assertEqual(len(op.result_set), 2)
        self.assertEqual(len(op.error_set), 1)

        # assert node creation did not persist
        n_set = self.db_ctl.exec_op(dbc.DBO_match_node_set_by_id_attribute([n_id]))
        self.assertEqual(len(n_set), 0)

    def test_topo_diff_commit(self):
        n_0_id = rand_id()
        n_1_id = rand_id()
        n_2_id = rand_id()
        n_T = 'T_test_topo_diff_commit'

        n_set = [{'__type': n_T, 'id': n_0_id },
                 {'__type': n_T, 'id': n_1_id },
                 {'__type': n_T, 'id': n_2_id }]
        l_set = [{'__type': n_T, '__src_id': n_0_id, '__dst_id': n_1_id},
                 {'__type': n_T, '__src_id': n_1_id, '__dst_id': n_0_id}]

        topo_diff = Topo_Diff(node_set_add=n_set,
                              link_set_add=l_set)

        op = dbc.DBO_topo_diff_commit(topo_diff)
        op_ret = self.db_ctl.exec_op(op)
        self.assertEqual(len(op_ret), 2)  # to id-sets, nodes & links
        self.assertEqual(len(op_ret[0]), 3)  # expect id-set of length 3
        self.assertEqual(len(op_ret[1]), 2)  # expect id-set of length 2

        id_set = self.db_ctl.exec_op(dbc.DBO_match_node_set_by_id_attribute([n_0_id, n_1_id]))
        self.assertEqual(len(id_set), 2)

        l_ptr = Link.link_ptr(src_id=n_0_id, dst_id=n_1_id)
        id_set = self.db_ctl.exec_op(dbc.DBO_load_link_set.init_from_link_ptr(l_ptr))
        self.assertEqual(len(id_set), 1)

        l_ptr = Link.link_ptr(src_id=n_1_id, dst_id=n_0_id)
        id_set = self.db_ctl.exec_op(dbc.DBO_load_link_set.init_from_link_ptr(l_ptr))
        self.assertEqual(len(id_set), 1)

        id_set_rm = [n_2_id]
        topo_diff = Topo_Diff(node_set_rm=id_set_rm)
        op = dbc.DBO_topo_diff_commit(topo_diff)
        self.db_ctl.exec_op(op)
        op = dbc.DBO_match_node_set_by_id_attribute(id_set_rm)
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 0)

    def test_attr_diff_commit(self):
        # create test node
        n_id = rand_id()
        topo_diff = Topo_Diff(node_set_add=[{'__label_set': ['T_test_attr_diff_commit'],
                                             'id': n_id, 'attr_0': 0}])
        op = dbc.DBO_topo_diff_commit(topo_diff)
        self.db_ctl.exec_op(op)

        # apply attr_diff
        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_write(n_id, 'attr_0', 0)
        attr_diff.add_node_attr_write(n_id, 'attr_1', 'a')
        attr_diff.add_node_attr_rm(n_id, 'attr_2')

        op = dbc.DBO_attr_diff_commit(attr_diff)
        ret_diff = self.db_ctl.exec_op(op)

        self.assertEqual(len(ret_diff.type__node), 1)
        self.assertTrue(None != ret_diff.type__node[n_id])

        # attr-set only
        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_write(n_id, 'attr_2', 0)

        op = dbc.DBO_attr_diff_commit(attr_diff)
        ret_diff = self.db_ctl.exec_op(op)
        self.assertTrue(None != ret_diff.type__node[n_id]['__attr_write'].get('attr_2'))

        # attr-remove only
        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_rm(n_id, 'attr_2')

        op = dbc.DBO_attr_diff_commit(attr_diff)
        ret_diff = self.db_ctl.exec_op(op)
        self.assertTrue('attr_2' in ret_diff.type__node[n_id]['__attr_remove'])

    def test_rm_node_set(self):
        n_0_id = rand_id()
        n_1_id = rand_id()
        n_2_id = rand_id()
        n_3_id = rand_id()
        n_T = 'T_test_rm_node_set'

        n_set = [{'__type': n_T, 'id': n_0_id },
                 {'__type': n_T, 'id': n_1_id },
                 {'__type': n_T, 'id': n_2_id },
                 {'__type': n_T, 'id': n_3_id }]
        l_set = [{'__type': n_T, '__src_id': n_2_id, '__dst_id': n_2_id},
                 {'__type': n_T, '__src_id': n_2_id, '__dst_id': n_3_id}]

        topo_diff = Topo_Diff(node_set_add=n_set,
                              link_set_add=l_set)

        op = dbc.DBO_topo_diff_commit(topo_diff)
        self.db_ctl.exec_op(op)

        op = dbc.DBO_rm_node_set([n_0_id, n_1_id])
        self.db_ctl.exec_op(op)

        op = dbc.DBO_rm_node_set([n_2_id, n_3_id], rm_links=True)
        self.db_ctl.exec_op(op)

        # assert all deleted
        op = dbc.DBO_match_node_id_set(filter_label=n_T)
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 0)

    def test_rz_clone(self):
        l_n, l_r = gen_rand_data(self.db_ctl, lim_n=8, lim_r=16, prob_link_create=0.7)
        op = dbc.DBO_rz_clone(filter_label=l_n, limit=32)
        ret = self.db_ctl.exec_op(op)
        n_set = ret['node_set']
        l_set = ret['link_set']

        # TODO improve assertions
        self.assertTrue(0 < len(n_set))
        self.assertTrue(0 < len(l_set))

    def tearDown(self): pass

if __name__ == "__main__":
    unittest.main()
