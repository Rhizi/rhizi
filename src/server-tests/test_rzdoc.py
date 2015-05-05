import logging
import unittest

import db_controller
import neo4j_test_util
from rz_config import RZ_Config
from rz_kernel import RZ_Kernel
import test_util
from test_util__pydev import debug__pydev_pd_arg


class TestRZDoc(unittest.TestCase):

    @classmethod
    def setUpClass(self):
        cfg = RZ_Config.init_from_file('res/etc/rhizi-server.conf')
        self.db_ctl = db_controller.DB_Controller(cfg.db_base_url)
        self.log = logging.getLogger('rhizi')
        self.log.addHandler(logging.StreamHandler())
        self.kernel = RZ_Kernel()
        self.kernel.db_ctl = self.db_ctl

    def setUp(self): pass

    def test_rzdoc_lifecycle(self):
        test_label = neo4j_test_util.rand_label()

        rzdoc_name = test_label
        lookup_ret = self.kernel.rzdoc__lookup_by_name(rzdoc_name)
        self.assertIsNone(lookup_ret)

        ret_create = self.kernel.rzdoc__create(rzdoc_name)
        lookup_ret = self.kernel.rzdoc__lookup_by_name(ret_create.name)
        self.assertTrue(None != lookup_ret and lookup_ret.name == rzdoc_name)

        self.kernel.rzdoc__delete(lookup_ret)
        lookup_ret = self.kernel.rzdoc__lookup_by_name(rzdoc_name)
        self.assertIsNone(lookup_ret)

    def test_rzdoc_commit_log(self):
        rzdoc_a = 'test_commit_log_doc_a'
        rzdoc_b = 'test_commit_log_doc_b'
        for rzdoc_name in [rzdoc_a, rzdoc_b]:
            lookup_ret = self.kernel.rzdoc__lookup_by_name(rzdoc_name)
            if lookup_ret != None:
                self.kernel.rzdoc__delete(lookup_ret)
        ret_create = self.kernel.rzdoc__create(rzdoc_a)
        ret_create = self.kernel.rzdoc__create(rzdoc_b)
        node_a, _ = test_util.generate_random_node_dict('type_a')
        node_b, _ = test_util.generate_random_node_dict('type_b')
        topo_diff_a = Topo_Diff(node_set_add=[node_a], meta={'sentence': 'a'})
        topo_diff_b = Topo_Diff(node_set_add=[node_b], meta={'sentence': 'b'})
        class FakeRZDoc(object):
            def __init__(self, id):
                self.id = id
        class FakeContext(object):
            def __init__(self, id):
                self.rzdoc = FakeRZDoc(id)
                self.user_name = None
        ctx_a = FakeContext(rzdoc_a)
        ctx_b = FakeContext(rzdoc_b)
        self.kernel.diff_commit__topo(topo_diff=topo_diff_a, ctx=ctx_a)
        self.kernel.diff_commit__topo(topo_diff=topo_diff_b, ctx=ctx_b)
        commit_log = self.kernel.rzdoc__commit_log(rzdoc=ctx_a, limit=10)

    def tearDown(self): pass

@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='TestRZDoc.test_rzdoc_lifcycle', verbosity=2)

if __name__ == "__main__":
    main()
