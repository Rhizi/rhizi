import unittest

from db_op import DBO_rz_clone, DBO_add_node_set, DBO_add_link_set, \
    DBO_block_chain__commit, DBO_diff_commit__attr, DBO_diff_commit__topo, \
    DBO_rm_node_set, DB_composed_op
import test_util
from model.graph import Attr_Diff, Topo_Diff
from test_util import generate_random_node_dict, generate_random_link_dict
import neo4j_test_util
from neo4j_util import meta_attr_list_to_meta_attr_map
import logging
from rz_server import Config, init_log
import re
from neo4j_cypher import Cypher_Parser, DB_Query, QT_Node_Filter__Doc_ID_Label
import neo4j_cypher
import sys

class Test_DB_Op(unittest.TestCase):

    @classmethod
    def setUpClass(self):
        cfg = Config.init_from_file('res/etc/rhizi-server.conf')
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

        op_set = [
                  DBO_rz_clone(),
                  DBO_add_node_set(meta_attr_list_to_meta_attr_map(n_set)),
                  DBO_add_link_set(meta_attr_list_to_meta_attr_map(l_set, meta_attr='__type')),
                  DBO_block_chain__commit(),
                  DBO_diff_commit__attr(attr_diff),
                  DBO_diff_commit__topo(topo_diff),
                  DBO_rm_node_set(id_set=[n_0_id]),
                  ]
        return op_set

    def tearDown(self):
        pass

    def test_cypher_exp_parsing(self):

        def validate_parse_tree(pt, q_str):
            self.log.debug('\n'.join([' q: %s' % (q_str),
                                      'q\': %s' % (pt.str__cypher_query()),
                                      'struct: \n%s' % (pt.str__struct_tree()),
                                      ]))

            if pt.str__cypher_query() != q_str:  # test for precise query string match
                self.fail()

        valid_exp_set = []
        #
        # parse expression set
        #
        parser = Cypher_Parser()
        exp_set = [
                   'match (n) with n order by n.id skip 0 limit 2 optional match (n)-[r]->(m) return n,labels(n),collect([m.id, r, type(r)])',
                   'create (n:A)-[r:B]->(m:C:D), ({a: 0, b: \'b\'})',
                   'match (src {id: {src}.id}), (dst {id: {dst}.id})',
                   'match (n {id: {id_foo}})',
                   'match ()',
                   'match (n:`F oo`:A {a: \'ba r\', b: 0}), (m {c: 0})',
                   'match (n), ()-[r]-()',
                   'match ()-[:A]->()',
                   'match (n:`T_nMu7ktxW` {node_attr})',
                   'match (n:A:B)-[r_b:Knows {a: \'0\'}]-(m:Skill), (n)-[]-(m)'
                   ]

        for clause in exp_set:
            pt = parser.parse_expression(clause)
            validate_parse_tree(pt, clause)
            valid_exp_set += [clause]

        #
        # parse all db ops
        #
        test_label = neo4j_test_util.rand_label()
        op_set = self.gen_full_db_op_set(test_label)

        for op in op_set:
            if isinstance(op, DB_composed_op): continue
            for _idx, db_q, _db_q_result in op:
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
            for _idx, db_q, _db_q_result in op:
                dbq_set.append(db_q)

        self.test_T__common(dbq_set, DB_Query.t__add_node_filter__meta_label)

    def test_T__add_node_filter__doc_id_label(self):
        test_label = neo4j_test_util.rand_label()

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

        #dbq_set = dbq_set[:1]
        self.test_T__common(dbq_set, QT_Node_Filter__Doc_ID_Label, test_label)

    def test_T__common(self, dbq_set, T, *args):
        self.log.debug('\n')

        for db_q in dbq_set:
            q_str__pre = db_q.q_str

            try:
                t = T(*args) # instantiate transformation
                t(db_q)
                q_str__post = db_q.pt_root.str__cypher_query()
                self.log.debug('test case:\n\t q: %s\n\tq\': %s\n' % (q_str__pre,
                                                                      q_str__post))
            except Exception as e:
                self.log.debug('transformation failed:\n\tq: %s\n%r' % (q_str__pre,
                                                                        db_q.pt_root))
                self.log.exception(e)

def main():
    unittest.main(defaultTest='Test_DB_Op.test_cypher_exp_parsing', verbosity=2)

if __name__ == "__main__":
    main()
