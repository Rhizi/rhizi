import logging
import unittest

import db_controller
import neo4j_test_util
from rz_kernel import RZ_Kernel
from rz_server import Config
from test_util__pydev import debug__pydev_pd_arg


class TestRZDoc(unittest.TestCase):

    @classmethod
    def setUpClass(self):
        cfg = Config.init_from_file('res/etc/rhizi-server.conf')
        self.db_ctl = db_controller.DB_Controller(cfg)
        self.log = logging.getLogger('rhizi')
        self.log.addHandler(logging.StreamHandler())
        self.kernel = RZ_Kernel()
        self.kernel.db_ctl = self.db_ctl

    def setUp(self): pass

    def test_rzdoc_lifcycle(self):
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

    def tearDown(self): pass

@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='TestRZDoc.test_rzdoc_lifcycle', verbosity=2)

if __name__ == "__main__":
    main()
