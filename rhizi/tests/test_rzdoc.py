# coding=utf-8

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
import time
import unittest

from ..rz_config import RZ_Config
from ..rz_kernel import RZ_Kernel
from ..rz_api_rest import Req_Context
from ..model.graph import Topo_Diff, Attr_Diff
from ..model.model import Link
from . import neo4j_test_util
from . import util
from .test_util__pydev import debug__pydev_pd_arg
from .util import RhiziTestBase
from ..db_op import DBO_raw_query_set


class TestRZDoc(RhiziTestBase):

    @classmethod
    def setUpClass(clz):
        clz.maxDiff = None
        super(TestRZDoc, clz).setUpClass()

    def setUp(self):
        pass

    def _ensure_deleted(self, rzdoc_name):
        lookup_ret = self.kernel.rzdoc__lookup_by_name(rzdoc_name)
        if lookup_ret != None:
            self.kernel.rzdoc__delete(lookup_ret)

    def test_rzdoc_commit_log(self):
        rzdoc_a_name = 'test_commit_log_doc_a'
        rzdoc_b_name = 'test_commit_log_doc_b'
        for rzdoc_name in [rzdoc_a_name, rzdoc_b_name]:
            self._ensure_deleted(rzdoc_name)
        rzdoc_a = self.kernel.rzdoc__create(rzdoc_a_name)
        rzdoc_b = self.kernel.rzdoc__create(rzdoc_b_name)
        node_a, _ = util.generate_random_node_dict('type_a')
        node_b, _ = util.generate_random_node_dict('type_b')
        topo_diff_a = Topo_Diff(node_set_add=[node_a], meta={'sentence': 'a'})
        topo_diff_b = Topo_Diff(node_set_add=[node_b], meta={'sentence': 'b'})
        ctx_a = Req_Context(rzdoc=rzdoc_a)
        ctx_b = Req_Context(rzdoc=rzdoc_b)
        self.kernel.diff_commit__topo(topo_diff=topo_diff_a, ctx=ctx_a)
        self.kernel.diff_commit__topo(topo_diff=topo_diff_b, ctx=ctx_b)
        commit_log = self.kernel.rzdoc__commit_log(rzdoc=rzdoc_a, limit=10)

    def test_rzdoc_lifecycle(self):
        for test_label in ['first', u'שלןם']:
            rzdoc_name = test_label
            lookup_ret__by_name = self.kernel.rzdoc__lookup_by_name(rzdoc_name)
            self.assertIsNone(lookup_ret__by_name)

            # create
            rzdoc = self.kernel.rzdoc__create(rzdoc_name)

            # lookup
            for rzd in [rzdoc]:
                lookup_ret__by_name = self.kernel.rzdoc__lookup_by_name(rzd.name)
                self.assertTrue(None != lookup_ret__by_name)

            # delete
            self.kernel.rzdoc__delete(rzdoc)
            lookup_ret__by_name = self.kernel.rzdoc__lookup_by_name(rzdoc_name)
            self.assertIsNone(lookup_ret__by_name)

    def test_rzdoc_search(self):
        rzdoc_common_name = util.gen_random_name()
        rzdoc_post_a = util.generate_random_RZDoc(rzdoc_common_name + '_a')
        rzdoc_post_b = util.generate_random_RZDoc(rzdoc_common_name + '_b')
        rzdoc_pre_c = util.generate_random_RZDoc('c_' + rzdoc_common_name)
        rzdoc_plain = util.generate_random_RZDoc(rzdoc_common_name)

        for rzdoc in [rzdoc_post_a, rzdoc_post_b, rzdoc_pre_c, rzdoc_plain]:
            self.kernel.rzdoc__create(rzdoc_name=rzdoc.name)

        ret = self.kernel.rzdoc__search(rzdoc_common_name)
        self.assertEquals(4, len(ret))

        ret = self.kernel.rzdoc__search(rzdoc_common_name + '_')
        self.assertEquals(2, len(ret))

        ret = self.kernel.rzdoc__search('c_' + rzdoc_common_name)
        self.assertEquals(1, len(ret))

    def _assert_clone(self, rzdoc, nodes, links):
        ret = self.kernel.rzdoc__clone(rzdoc)
        ret_nodes = ret.node_set_add
        ret_links = ret.link_set_add
        self.assertDictEqual({n['id']:n for n in ret_nodes}, {n['id']:n for n in nodes})
        self.assertDictEqual({l['id']:l for l in ret_links}, {l['id']:l for l in links})

    #@unittest.skip
    def test_node_in_multiple_docs(self):
        rzdoc_a_name = 'A'
        rzdoc_b_name = 'B'
        # create A
        # create B
        for rzdoc_name in [rzdoc_a_name, rzdoc_b_name]:
            self._ensure_deleted(rzdoc_name)
        rzdoc_a = self.kernel.rzdoc__create(rzdoc_a_name)
        rzdoc_b = self.kernel.rzdoc__create(rzdoc_b_name)
        ctx_a = Req_Context(rzdoc=rzdoc_a)
        ctx_b = Req_Context(rzdoc=rzdoc_b)
        # add 'a' to A
        # add 'a' to B
        # add 'b' to A
        # add 'b' to B
        node_a, _ = util.generate_random_node_dict('type_a')
        node_b, _ = util.generate_random_node_dict('type_b')
        topo_diff_a = Topo_Diff(node_set_add=[node_a], meta={'sentence': 'a'})
        topo_diff_b = Topo_Diff(node_set_add=[node_b], meta={'sentence': 'b'})
        self.kernel.diff_commit__topo(topo_diff=topo_diff_a, ctx=ctx_a)
        self.kernel.diff_commit__topo(topo_diff=topo_diff_b, ctx=ctx_a)
        self._assert_clone(rzdoc_a, [node_a, node_b], [])
        self._assert_clone(rzdoc_b, [], [])
        self.kernel.diff_commit__topo(topo_diff=topo_diff_a, ctx=ctx_b)
        self.kernel.diff_commit__topo(topo_diff=topo_diff_b, ctx=ctx_b)
        self._assert_clone(rzdoc_a, [node_a, node_b], [])
        self._assert_clone(rzdoc_b, [node_a, node_b], [])
        # link a to b in A
        link = Link.link_ptr(node_a['id'], node_b['id'])
        link['__type'] = ['mylink']
        link['id'] = 'testlinkid'
        topo_diff_link = Topo_Diff(link_set_add=[link], meta={'sentence': 'b'})
        self.kernel.diff_commit__topo(topo_diff=topo_diff_link, ctx=ctx_a)
        # set some properties and read them back
        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_write(node_a['id'], 'love', 'plenty')
        attr_diff.add_link_attr_write(link['id'], 'hate', 'also plenty')
        self.kernel.diff_commit__attr(attr_diff=attr_diff, ctx=ctx_a)
        # update out dicts so the clone tests for those properties
        node_a['love'] = 'plenty'
        result_link = dict(link)
        result_link['hate'] = 'also plenty'
        # verify a is not linked to b in B via clone
        self._assert_clone(rzdoc_a, [node_a, node_b], [result_link])
        self._assert_clone(rzdoc_b, [node_a, node_b], [])
        # add the link to node_b too, set another property, verify it is set on
        # both. note that adding a link now means: if 'id' already exists,
        # merge existing element with incoming data, otherwise as usual create it.
        self.kernel.diff_commit__topo(topo_diff=topo_diff_link, ctx=ctx_b)
        attr_diff = Attr_Diff()
        attr_diff.add_link_attr_write(link['id'], 'boredom', 'you had to ask')
        self.kernel.diff_commit__attr(attr_diff=attr_diff, ctx=ctx_b)
        result_link['boredom'] = 'you had to ask'
        self._assert_clone(rzdoc_a, [node_a, node_b], [result_link])
        self._assert_clone(rzdoc_b, [node_a, node_b], [result_link])
        # TODO: remove some nodes, see they are removed in just the doc in
        # question

    @classmethod
    def tearDownClass(self):
        self.kernel.shutdown()


@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='TestRZDoc.test_rzdoc_lifcycle', verbosity=2)

if __name__ == "__main__":
    main()
