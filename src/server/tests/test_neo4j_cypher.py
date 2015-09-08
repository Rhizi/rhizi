# coding=utf-8   # TODO: rm on python 3 migration

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


import unittest

from ..db_op import DBO_rzdoc__clone, DBO_add_node_set, DBO_add_link_set, \
    DBO_block_chain__commit, DBO_diff_commit__attr, DBO_diff_commit__topo, \
    DBO_rm_node_set, DB_composed_op, DBO_block_chain__init, DBO_rzdoc__create, \
    DBO_rzdoc__delete, DBO_rzdoc__search, DBO_rzdoc__lookup_by_name, DB_op
from ..model.graph import Attr_Diff, Topo_Diff
from ..neo4j_cypher import Cypher_Parser, DB_Query
from ..neo4j_qt import QT_RZDOC_NS_Filter
import neo4j_test_util
from ..neo4j_util import meta_attr_list_to_meta_attr_map
from ..rz_config import RZ_Config
from ..rz_server import init_log
from test_util import generate_random_node_dict, generate_random_link_dict, \
    generate_random_RZDoc
from test_util__pydev import debug__pydev_pd_arg


class Test_DB_Op(unittest.TestCase):

    @classmethod
    def setUpClass(self):
        cfg = RZ_Config.init_from_file('res/etc/rhizi-server.conf')
        self.log = init_log(cfg)

    def setUp(self):
        pass

    def gen_full_db_op_set(self, test_label):
        n_0, n_0_id = generate_random_node_dict(test_label)
        n_1, n_1_id = generate_random_node_dict(test_label)
        l_0, l_0_id = generate_random_link_dict(test_label, n_0_id, n_1_id)

        n_set = [n_0, n_1]
        l_set = [l_0]
        topo_diff = Topo_Diff(node_set_add=n_set, link_set_add=l_set)

        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_write(n_0_id, 'attr_0', 0)

        test_rzdoc = generate_random_RZDoc(test_label)

        op_set = [
                  DBO_rzdoc__clone(),
                  DBO_add_node_set(meta_attr_list_to_meta_attr_map(n_set)),
                  DBO_add_link_set(meta_attr_list_to_meta_attr_map(l_set, meta_attr='__type')),
                  DBO_diff_commit__attr(attr_diff),
                  DBO_diff_commit__topo(topo_diff),
                  DBO_rm_node_set(id_set=[n_0_id]),

                  # block chain
                  DBO_block_chain__init(test_rzdoc),
                  DBO_block_chain__commit(commit_obj=topo_diff.to_json_dict()),

                  # rzdoc
                  DBO_rzdoc__create(test_rzdoc),
                  DBO_rzdoc__delete(test_rzdoc),
                  DBO_rzdoc__search(''),
                  DBO_rzdoc__lookup_by_name(test_rzdoc.name),
                  ]
        return op_set

    def tearDown(self):
        pass

    def test_cypher_exp_parsing(self):

        def validate_parse_tree(pt, q_str):
            self.assertEquals(pt.str__cypher_query(), q_str,
                              u"""{} != {}
{}""".format(pt.str__cypher_query(), q_str, pt.str__struct_tree()))  # test for precise query string match

        valid_exp_set = []
        #
        # parse expression set
        #
        parser = Cypher_Parser()
        exp_set = [
                   'create (n:A)-[r:B]->(m:C:D), ({a: 0, b: \'b\'})',
                   'match (n) with n order by n.id skip 0 limit 2 optional match (n)-[r]->(m) return n,labels(n),collect([m.id, r, type(r)])',
                   'match (src {id: {src}.id}), (dst {id: {dst}.id})',
                   'match (n {id: {id_foo}})',
                   'match ()',
                   'match (n:`F oo`:A {a: \'ba r\', b: 0}), (m {c: 0})',
                   'match (n), ()-[r]-()',
                   'match ()-[:A]->()',
                   'match (n:`T_nMu7ktxW` {node_attr})',
                   'match (n:A:B)-[r_b:Knows {a: \'0\'}]-(m:Skill), (n)-[]-(m)',
                   'match ()-[]-()',

                   # path quantifier
                   'match (n:A)-[r:B*0..4]-(m)',
                   'match ()-[*]-()',
                   'match (m)-[*0..2]-(m)',
                   'match ()-[r*0..6]-()',

                   #
                   # UNICODE tests
                   #
                   u'create (n:א)-[r:ב]->(m:ג:ד)',
                   u'create ({א: 0})',
                   u'create ({א: 0, נ: \'ערך ב\'})',

                   #
                   # Punctuation tests
                   #
                   "create (n:Test {name: 'test,'})",
                   "create (n:Test {name: 'test:'})",
                   "create (n:Test {name: 'test.'})",
                   "create (n:Test {name: 'test?'})",
                   "create (n:'Test:')",
                   "create (n:'Test:')",
                   "create (n:'Test|')",
                   "create (n:'Test\"')",
                   "create (n:'Test?')",
                   ]
        # exp_set = []
        for clause in exp_set:
            pt = parser.parse_expression(clause)
            validate_parse_tree(pt, clause)
            valid_exp_set += [clause]

        #
        # parse all db ops
        #
        test_label = neo4j_test_util.rand_label()
        op_set = self.gen_full_db_op_set(test_label)
        # op_set = []

        for op in op_set:
            if isinstance(op, DB_composed_op): continue  # validated through sub-ops
            for _idx, db_q, _db_q_result in op.iter__r_set():
                q_str = db_q.q_str
                validate_parse_tree(db_q.pt_root, q_str)
                valid_exp_set += [q_str]

        self.log.debug('-' * 80 + '\npassed expression count: %d:\n\n%s' % (len(valid_exp_set),
                                                                          '\n'.join(valid_exp_set)))


    def test_T__add_node_filter__meta_label(self):
        test_label = neo4j_test_util.rand_label()

        dbq_set = []
        op_set = self.gen_full_db_op_set(test_label)
        for op in op_set:
            if isinstance(op, DB_composed_op): continue  # sub-queries tested instead
            for _idx, db_q, _db_q_result in op.iter__r_set():
                dbq_set.append(db_q)

        self.helper_T__common(dbq_set, lambda *args: lambda db_q: db_q.t__add_node_filter__meta_label())

    def test_T__add_node_filter__rzdoc_id_label(self):
        test_label = neo4j_test_util.rand_label()
        test_rzdoc = generate_random_RZDoc(test_label)

        dbq_set = []
        op_set = self.gen_full_db_op_set(test_label)

        for op in op_set:
            if isinstance(op, DB_composed_op): continue  # sub-queries tested instead
            for dbq in op:
                dbq_set.append(dbq)

        q_arr = ['match (n)-[l_old {id: {id}}]->(m)',
                 'where type(l_old)<>\'is not\'',
                 'delete l_old, params: {\'id\': u\'9fbhxwcn\'}']
        dbq = DB_Query(q_arr)
        dbq_set = [dbq]

        # dbq_set = dbq_set[:1]
        self.helper_T__common(dbq_set, QT_RZDOC_NS_Filter(test_rzdoc))

    def helper_T__common(self, dbq_set, T, *args):
        db_op = DB_op()
        for db_q in dbq_set:
            db_op.add_db_query(db_q)
        T(db_op)
        for db_q in dbq_set:
            q_str__post = db_q.pt_root.str__cypher_query()
            #self.log.debug('test case:\n\t q: %s\n\tq\': %s\n' % (q_str__pre, q_str__post))

@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='Test_DB_Op.test_cypher_exp_parsing', verbosity=2)

if __name__ == "__main__":
    main()
