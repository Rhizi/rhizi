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


import logging
import unittest

from .. import db_controller as dbc
from ..db_op import (DBO_add_link_set, DBO_block_chain__commit,
                             DBO_rzdoc__clone, DBO_rzdb__init_DB,
                             DBO_rzdb__fetch_DB_metablock)
from ..db_op import DBO_add_node_set
from ..db_op import DBO_block_chain__list
from ..db_op import DBO_diff_commit__attr
from ..db_op import DBO_diff_commit__topo
from ..db_op import DBO_load_link_set
from ..db_op import DBO_load_node_set_by_DB_id
from ..db_op import DBO_match_link_id_set
from ..db_op import DBO_match_node_id_set
from ..db_op import DBO_match_node_set_by_id_attribute
from ..db_op import DBO_raw_query_set
from ..model.graph import Attr_Diff
from ..model.graph import Topo_Diff
from ..model.model import Link
from ..neo4j_cypher import DB_Query
from ..neo4j_util import Neo4JException
from ..neo4j_util import meta_attr_list_to_meta_attr_map
from ..rz_api_rest import Req_Context
from ..rz_config import RZ_Config

from .neo4j_test_util import DBO_random_data_generation, rand_label
from .util import (generate_random_link_dict, generate_random_node_dict,
                       RhiziTestBase)
from .test_util__pydev import debug__pydev_pd_arg


skip_missing_db = unittest.skip("broken - assumes existing DB")


class TestDBController(RhiziTestBase):

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

    def setUp(self):
        # flush_DB
        # op = DBO_flush_db()
        # self.db_ctl.exec_op(op)

        # self.db_ctl.exec_op(DBO_add_node_set(self.n_map))
        # self.db_ctl.exec_op(DBO_add_link_set(self.l_map))
        pass


    def test_add_node_set(self):
        test_label = rand_label()
        n_0, n_0_id = generate_random_node_dict(test_label)
        n_1, n_1_id = generate_random_node_dict(test_label)
        n_map = meta_attr_list_to_meta_attr_map([n_0, n_1])
        op = DBO_add_node_set(n_map)

        self.assertEqual(len(op.query_set), 1)  # assert a single statement is issued

        ret_id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(ret_id_set), 2)
        self.assertTrue(n_0_id in ret_id_set)
        self.assertTrue(n_1_id in ret_id_set)


    def test_add_link_set(self):
        test_label = rand_label()
        n_0, n_0_id = generate_random_node_dict(test_label)
        n_1, n_1_id = generate_random_node_dict(test_label)
        n_2, n_2_id = generate_random_node_dict(test_label)

        l_0, l_0_id = generate_random_link_dict(test_label, n_0_id, n_1_id)
        l_1, l_1_id = generate_random_link_dict(test_label, n_0_id, n_2_id)

        n_map = meta_attr_list_to_meta_attr_map([n_0, n_1, n_2])
        op = DBO_add_node_set(n_map)
        self.db_ctl.exec_op(op)

        l_map = { test_label : [l_0, l_1]}
        op = DBO_add_link_set(l_map)
        self.assertEqual(len(op.query_set), 2)  # no support yet for parameterized statements for link creation

        ret_id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(ret_id_set), 2)
        self.assertTrue(l_0_id in ret_id_set)
        self.assertTrue(l_1_id in ret_id_set)


    def test_block_chain__commit_and_print(self):
        topo_1, _, _ = self._make_topo_diff()
        topo_2, _, _ = self._make_topo_diff()
        ctx = Req_Context()
        ctx.rzdoc = 'testdoc'
        op_0 = DBO_block_chain__commit(commit_obj=topo_1.to_json_dict(), ctx=ctx)
        op_1 = DBO_block_chain__commit(commit_obj=topo_2.to_json_dict(), ctx=ctx)
        op_print = DBO_block_chain__list()

        topo_ret1 = self.db_ctl.exec_op(op_0)
        hash_ret1 = topo_ret1.node_set_add[0]['id']
        topo_ret2 = self.db_ctl.exec_op(op_1)
        hash_ret2 = topo_ret2.node_set_add[0]['id']
        hash_list = self.db_ctl.exec_op(op_print)

        # TODO - what happened here that this part of the test now fails?
        #hash_commit_0 = DBO_block_chain__commit.calc_blob_hash()  # default empty blob hash

        #self.assertEqual(hash_list.pop(), hash_commit_0)
        self.assertEqual(hash_list[1], hash_ret1)
        self.assertEqual(hash_list[0], hash_ret2)


    def test_db_op_statement_iteration(self):
        s_arr = ['create (b:Book {title: \'foo\'}) return b',
                 'match (n) return n', ]

        op = dbc.DB_op()
        op.add_statement(s_arr[0])
        op.add_statement(s_arr[1])

        i = 0
        for s, r in op:
            # access: second tuple item -> REST-form 'statement' key
            self.assertTrue(type(s), DB_Query)
            self.assertTrue(type(r), tuple)
            i = i + 1

        self.db_ctl.exec_op(op)

        i = 0
        for s, r_set in op:
            # access: second tuple item -> REST-form 'statement' key
            self.assertNotEqual(None, r_set)
            for x in r_set:
                pass
            i = i + 1


    def _make_topo_diff(self):
        test_label = rand_label()
        n_0, n_0_id = generate_random_node_dict(test_label)
        n_1, n_1_id = generate_random_node_dict(test_label)
        n_2, n_2_id = generate_random_node_dict(test_label)

        l_0, l_0_id = generate_random_link_dict(test_label, n_0_id, n_1_id)
        l_1, l_1_id = generate_random_link_dict(test_label, n_0_id, n_2_id)

        n_set = [n_0, n_1, n_2]
        l_set = [l_0, l_1]
        topo_diff = Topo_Diff(node_set_add=n_set,
                              link_set_add=l_set)
        return topo_diff, n_set, l_set

    def _assert_no_two_nodes_of_same_attr(self, attr):
        # not working, no idea why
        #op = DBO_raw_query_set(['match n where has(n.id) return count(n) = count(distinct(n))'])
        op = DBO_raw_query_set(['match n where has(n.%s) return n.%s' % (attr, attr)])
        ret = self.db_ctl.exec_op(op)
        self.assertTrue(len(ret) == len(set(ret)))

    def _assert_no_two_nodes_of_same_name_or_id(self):
        self._assert_no_two_nodes_of_same_attr('id')
        self._assert_no_two_nodes_of_same_attr('name')

    def test_diff_commit__topo(self):

        topo_diff, n_set, l_set = self._make_topo_diff()
        n_0_id, n_1_id, n_2_id = [n['id'] for n in n_set]
        l_0_id, l_1_id = [l['id'] for l in l_set]
        # commit diff
        op = DBO_diff_commit__topo(topo_diff)
        ret_topo_diff = self.db_ctl.exec_op(op)

        # test return type
        self.assertTrue('node_id_set_add' in ret_topo_diff)
        self.assertTrue('link_id_set_add' in ret_topo_diff)
        self.assertTrue('node_id_set_rm' in ret_topo_diff)
        self.assertTrue('link_id_set_rm' in ret_topo_diff)

        # test return set lengths
        self.assertEqual(len(ret_topo_diff['node_id_set_add']), len(n_set))
        self.assertEqual(len(ret_topo_diff['link_id_set_add']), len(l_set))
        self.assertEqual(len(ret_topo_diff['node_id_set_rm']), 0)
        self.assertEqual(len(ret_topo_diff['link_id_set_rm']), 0)

        # assert nodes persisted
        id_set = self.db_ctl.exec_op(DBO_match_node_set_by_id_attribute([n_0_id, n_1_id]))
        self.assertEqual(len(id_set), 2)

        # assert links persisted
        l_ptr_0 = Link.link_ptr(src_id=n_0_id, dst_id=n_1_id)
        l_ptr_1 = Link.link_ptr(src_id=n_0_id, dst_id=n_2_id)
        op = DBO_load_link_set.init_from_link_ptr_set([l_ptr_0, l_ptr_1])
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 2)

        # repeat commit, assert no additional nodes of same id or name exist
        self._assert_no_two_nodes_of_same_name_or_id()
        op = DBO_diff_commit__topo(topo_diff)
        ret_topo_diff = self.db_ctl.exec_op(op)
        self._assert_no_two_nodes_of_same_name_or_id()

        # remove links
        topo_diff = Topo_Diff(link_id_set_rm=[l_0_id, l_1_id])
        op = DBO_diff_commit__topo(topo_diff)
        ret_topo_diff = self.db_ctl.exec_op(op)
        self.assertEqual(len(ret_topo_diff['link_id_set_rm']), 2)

        # assert links removed
        op = DBO_load_link_set.init_from_link_ptr_set([l_ptr_0, l_ptr_1])
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 0)

        # removal nodes
        topo_diff = Topo_Diff(node_id_set_rm=[n_2_id])
        op = DBO_diff_commit__topo(topo_diff)
        ret_topo_diff = self.db_ctl.exec_op(op)
        self.assertEqual(len(ret_topo_diff['node_id_set_rm']), 1)

        # assert nodes removed
        op = DBO_match_node_set_by_id_attribute([n_2_id])
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 0)


    def test_diff_commit__attr(self):
        # create test node
        test_label = rand_label()
        n_0, n_0_id = generate_random_node_dict(test_label)
        # n_0['attr_0'] = 0 # we don't support additional attributes in a
        # Topo_Diff right now; they must go in an Attr_Diff
        topo_diff = Topo_Diff(node_set_add=[n_0])
        op = DBO_diff_commit__topo(topo_diff)
        self.db_ctl.exec_op(op)

        # apply attr_diff
        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_write(n_0_id, 'attr_0', 0)
        attr_diff.add_node_attr_write(n_0_id, 'attr_1', 'a')
        attr_diff.add_node_attr_rm(n_0_id, 'attr_2')

        op = DBO_diff_commit__attr(attr_diff)
        ret_diff = self.db_ctl.exec_op(op)

        self.assertEqual(len(ret_diff.type__node), 1)
        self.assertTrue(None != ret_diff.type__node[n_0_id])

        # attr-set only
        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_write(n_0_id, 'attr_2', 0)

        op = DBO_diff_commit__attr(attr_diff)
        ret_diff = self.db_ctl.exec_op(op)
        self.assertTrue(None != ret_diff.type__node[n_0_id]['__attr_write'].get('attr_2'))

        # attr-remove only
        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_rm(n_0_id, 'attr_2')

        op = DBO_diff_commit__attr(attr_diff)
        ret_diff = self.db_ctl.exec_op(op)
        self.assertTrue('attr_2' in ret_diff.type__node[n_0_id]['__attr_remove'])


    @skip_missing_db
    def test_load_link_set(self):

        # load by l_ptr
        l_ptr = Link.link_ptr(src_id='person_00', dst_id='skill_00')
        op = DBO_load_link_set.init_from_link_ptr(l_ptr)
        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 1)

        l_ptr = Link.link_ptr(src_id='person_00')
        op = DBO_load_link_set.init_from_link_ptr(l_ptr)
        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 2)

        l_ptr = Link.link_ptr(dst_id='skill_00')
        op = DBO_load_link_set.init_from_link_ptr(l_ptr)
        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 1)

        # load by l_ptr sets
        l_ptr_set = [Link.link_ptr(s, d) for (s, d) in [('person_00', 'skill_00'), ('person_00', 'skill_01')]]
        op = DBO_load_link_set.init_from_link_ptr_set(l_ptr_set)
        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 2)

        # this should return the same link twice
        l_ptr_set = [Link.link_ptr(s, d) for (s, d) in [('person_00', 'skill_00'), ('person_00', 'skill_01')]]
        l_ptr_set.append(Link.link_ptr(dst_id='skill_00'))
        op = DBO_load_link_set.init_from_link_ptr_set(l_ptr_set)
        l_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(l_set), 3)


    @unittest.skip("broken - because id is not provided to DBO_add_node_set")
    def test_load_node_set_by_DB_id(self):
        """
        test node DB id life cycle
        """

        # create nodes, get DB ids
        op = DBO_add_node_set({'T_test_load_node_set_by_DB_id': [{'name': 'John Doe'},
                                                                     {'name': 'John Doe'}]})
        id_set = self.db_ctl.exec_op(op)

        # match against DB ids
        op = DBO_load_node_set_by_DB_id(id_set)
        n_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(n_set), len(id_set), 'incorrect result size')


    @skip_missing_db
    def test_match_node_set_by_type(self):
        op = DBO_match_node_id_set(filter_label='Person')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 2)

        op = DBO_match_node_id_set(filter_label='Nan_Type')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 0)


    @skip_missing_db
    def test_match_node_set_by_attribute(self):
        fam = { 'name': ['Bob', u'Judo'], 'age': [128] }
        n_set = self.db_ctl.exec_op(DBO_match_node_id_set(filter_attr_map=fam))
        self.assertEqual(len(n_set), 1)

        fam = { 'age': [128, 256, 404] }
        n_set = self.db_ctl.exec_op(DBO_match_node_id_set(filter_attr_map=fam))
        self.assertEqual(len(n_set), 2)


    def test_match_node_set_by_DB_id(self):
        pass  # TODO


    @skip_missing_db
    def test_match_node_set_by_id_attribute(self):
        n_set = self.db_ctl.exec_op(DBO_match_node_set_by_id_attribute(['skill_00', 'person_01']))
        self.assertEqual(len(n_set), 2)


    @skip_missing_db
    def test_match_link_set_by_type(self):
        op = DBO_match_link_id_set(filter_label='Knows')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 2)

        op = DBO_match_link_id_set(filter_label='Nan_Type')
        id_set = self.db_ctl.exec_op(op)
        self.assertEqual(len(id_set), 0)


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
        n_set = self.db_ctl.exec_op(DBO_match_node_set_by_id_attribute([n_id]))
        self.assertEqual(len(n_set), 0)


    @unittest.skip("DBO_random_data_generation doesn't pass neo4j_cypher_parser due to toString")
    def test_rz_clone(self):
        # op = DBO_random_data_generation(lim_n=8, lim_r=16, prob_link_create=0.7)
        n_label = op.node_set_label
        l_label = op.link_set_label
        self.db_ctl.exec_op(op)  # commit random data

        op = DBO_rzdoc__clone(filter_label=n_label, limit=32)
        topo_diff = self.db_ctl.exec_op(op)
        n_set = topo_diff.node_set_add
        l_set = topo_diff.link_set_add

        # TODO improve assertions
        self.assertTrue(0 < len(n_set))
        self.assertTrue(0 < len(l_set))


    @unittest.skip("broken due to reinitializing existing DB - creating a clean db and doing this test initially will fix this (can we assert in setUp function?)")
    def test_rzdb__init_DB(self):
        rz_cfg = RZ_Config.generate_default()
        op = DBO_rzdb__init_DB(rz_cfg.rzdoc__mainpage_name)
        self.db_ctl.exec_op(op)

        with self.assertRaises(Exception):  # assert second init call fails
            self.db_ctl.exec_op(op)


    def test_rzdb__fetch_DB_metadata(self):
        op = DBO_rzdb__fetch_DB_metablock()
        dbmb = self.db_ctl.exec_op(op)
        print('%s' % (dbmb))


    def tearDown(self):
        pass


@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='TestDBController.test_rzdb__fetch_DB_metadata', verbosity=2)


if __name__ == "__main__":
    main()
