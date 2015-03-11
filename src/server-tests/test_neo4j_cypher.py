import unittest

from db_op import DBO_rz_clone, DBO_add_node_set, DBO_add_link_set, \
    DBO_block_chain__commit, DBO_diff_commit__attr, DBO_diff_commit__topo, \
    DBO_rm_node_set
import test_util
from model.graph import Attr_Diff, Topo_Diff
from test_util import generate_random_node_dict, generate_random_link_dict
import neo4j_test_util
from neo4j_util import meta_attr_list_to_meta_attr_map
import logging
from rz_server import Config, init_log
import re
from neo4j_cypher import Cypher_Parser
import neo4j_cypher

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

        def attempt_parse(parser, clause):
            try:
                pt = parser.parse_expression(clause)
                self.log.debug('\n'.join(['input string: %s' % (clause),
                                          'output query: %s' % (pt.str__cypher_query()),
                                          'struct: \n%s' % (pt.str__struct_tree()),
                                          ]))
                for kw, clause_set in pt.kw_to_clause_set_map.items():
                    self.log.debug('keyword: %s, clause-set: %s' % (kw, clause_set))
                    for p_clause in clause_set:
                        self.log.debug('   %s' % (p_clause))
            except Exception as e:
                self.log.exception('parse: fail: input: %s' % (clause))
                self.fail()


        self.log.debug('\n')

        #
        # parse expression set
        #
        parser = Cypher_Parser()
        exp_set = [
                   'match ()',
                   'match (n:`F oo`:A {a: \'ba r\', b: 0}), (m {c: 0})',
                   'create (n:A)-[r:B]->(m:C:D), ({a: 0, b: \'b\'})',
                   'match (n), ()-[r]-()',
                   'match ()-[:A]->()',
                   'match (n:`T_nMu7ktxW` {node_attr})',
                   'match (n:A:B)-[r_b:Knows {a: \'0\'}]-(m:Skill), (n)-[]-(m)'
                   ]
        for clause in exp_set:
            attempt_parse(parser, clause)

        #
        # parse all db ops
        #
        test_label = neo4j_test_util.rand_label()
        op_set = []
        #op_set = self.gen_full_db_op_set(test_label)

        for op in op_set:
            for _idx, db_q, _db_q_result in op:
                for keyword, clause_set in db_q:
                    if keyword in neo4j_cypher.tok_set__kw__unsupported:
                        self.log.exception('skipping clause with unsupported kw: \'%s\'' % (keyword))
                        continue

                    for clause in clause_set:
                        attempt_parse(parser, clause)

def main():
    unittest.main(defaultTest='Test_DB_Op.test_cypher_exp_parsing', verbosity=2)

if __name__ == "__main__":
    main()
