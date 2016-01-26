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


import unittest

from ..rz_api_rest import Req_Context
from ..model.graph import Topo_Diff, Attr_Diff
from . import util
from .test_util__pydev import debug__pydev_pd_arg
from .util import RhiziTestBase
from ..db_op import DBO_find_links_touching


class TestRZDoc(RhiziTestBase):

    @classmethod
    def setUpClass(clz):
        clz.maxDiff = None
        super(TestRZDoc, clz).setUpClass()

    @classmethod
    def tearDownClass(self):
        self.kernel.shutdown()

    def setUp(self):
        self.kernel.reset_graph()

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

    def test_node_in_multiple_docs(self):
        # create A with a-[goes]->b
        rzdoc_a, ctx_a = self.helper_create_doc(name='A', sentence='a  goes  b')
        # create B empty
        rzdoc_b, ctx_b = self.helper_create_doc(name='B')
        node_a, node_b = rzdoc_a.nodes
        self._assert_clone(rzdoc_a, [node_a, node_b], rzdoc_a.links)
        self._assert_clone(rzdoc_b, [], [])
        # add a and b to B
        self.helper_topo_diff(ctx_b, nodes=[node_a])
        self.helper_topo_diff(ctx_b, nodes=[node_b])
        self._assert_clone(rzdoc_a, [node_a, node_b], rzdoc_a.links)
        self._assert_clone(rzdoc_b, [node_a, node_b], [])
        # set some properties and read them back
        attr_diff = Attr_Diff()
        attr_diff.add_node_attr_write(node_a['id'], 'love', 'plenty')
        attr_diff.add_link_attr_write(rzdoc_a.links[0]['id'], 'hate', 'also plenty')
        self.kernel.diff_commit__attr(attr_diff=attr_diff, ctx=ctx_a)
        # update out dicts so the clone tests for those properties
        node_a['love'] = 'plenty'
        result_link = dict(rzdoc_a.links[0])
        result_link['hate'] = 'also plenty'
        # verify a is not linked to b in B via clone
        self._assert_clone(rzdoc_a, [node_a, node_b], [result_link])
        self._assert_clone(rzdoc_b, [node_a, node_b], [])
        # add the link to node_b too, set another property, verify it is set on
        # both. note that adding a link now means: if 'id' already exists,
        # merge existing element with incoming data, otherwise as usual create it.
        self.helper_topo_diff(ctx_b, links=rzdoc_a.links)
        attr_diff = Attr_Diff()
        attr_diff.add_link_attr_write(rzdoc_a.links[0]['id'], 'boredom', 'you had to ask')
        self.kernel.diff_commit__attr(attr_diff=attr_diff, ctx=ctx_b)
        result_link['boredom'] = 'you had to ask'
        self._assert_clone(rzdoc_a, [node_a, node_b], [result_link])
        self._assert_clone(rzdoc_b, [node_a, node_b], [result_link])
        # remove some nodes, see they are removed in just the doc in
        # question
        self.helper_topo_diff(ctx_a, node_id_set_rm=[node_a['id']])
        self._assert_clone(rzdoc_a, [node_b], [])
        self._assert_clone(rzdoc_b, [node_a, node_b], [result_link])

    def test_single_doc_delete_more_than_one(self):
        rzdoc, ctx = self.helper_create_doc(name='a', id_start=1000,
                                            sentence='a  goes  b  goes  c  goes  d')
        nodes = {n['name']: n for n in rzdoc.nodes}
        links = {(l['__src_id'], l['__dst_id']): l for l in rzdoc.links}
        a, b, c, d = nodes['a'], nodes['b'], nodes['c'], nodes['d']
        cd = links[(c['id'], d['id'])]
        self.helper_topo_diff(ctx, node_id_set_rm=[a['id'], b['id']])
        self._assert_clone(rzdoc, [c, d], [cd])

    def test_two_doc_delete_more_than_one_same_ids(self):
        rzdoc, ctx = self.helper_create_doc(name='a', id_start=1000,
                                            sentence='a  goes  b  goes  c  goes  d')
        # will share nodes since ids are the same (and names are the same)
        rzdoc2, ctx2 = self.helper_create_doc(name='b', id_start=1000,
                                              sentence='a  goes  b  goes  c  goes  d')
        nodes = {n['name']: n for n in rzdoc.nodes}
        links = {(l['__src_id'], l['__dst_id']):l for l in rzdoc.links}
        a, b, c, d = nodes['a'], nodes['b'], nodes['c'], nodes['d']
        ab = links[(a['id'], b['id'])]
        bc = links[(b['id'], c['id'])]
        cd = links[(c['id'], d['id'])]
        take_id = lambda l: [x['id'] for x in l]
        self.helper_topo_diff(ctx, node_id_set_rm=take_id([a, b]), link_id_set_rm=take_id([ab, bc]))
        self._assert_clone(rzdoc, [c, d], [cd])
        self._assert_clone(rzdoc2, rzdoc.nodes, rzdoc.links)
        self.helper_topo_diff(ctx2, node_id_set_rm=take_id([a, b]), link_id_set_rm=take_id([ab, bc]))
        self._assert_clone(rzdoc, [c, d], [cd])
        self._assert_clone(rzdoc2, [c, d], [cd])

    def test_two_doc_delete_more_than_one_same_names(self):
        rzdoc, ctx   = self.helper_create_doc(name='a', id_start=2000, sentence='a  goes  b  goes  c  goes  d')
        rzdoc2, ctx2 = self.helper_create_doc(name='b', id_start=1000, sentence='a  goes  b  goes  c  goes  d')
        self._assert_clone(rzdoc, rzdoc.nodes, rzdoc.links)
        self._assert_clone(rzdoc2, rzdoc.nodes, rzdoc.links)

    def test_two_doc_delete_more_than_one_same_names_no_links(self):
        s = 'a    b    c    d'
        rzdoc, ctx = self.helper_create_doc(name='a', id_start=2000,
            sentence=s)
        self.assertEqual(rzdoc.links, [])
        rzdoc2, ctx2 = self.helper_create_doc(name='b', id_start=1000,
            sentence=s)
        self._assert_clone(rzdoc, rzdoc.nodes, rzdoc.links)
        self._assert_clone(rzdoc2, rzdoc.nodes, rzdoc.links)

    def test_topo_diff_returns_same_format_as_clone(self):
        """
        topo_diff node_set_add and link_set_add must be the same format as clone
        """

        def tuple_set(items):
            ret = set()
            for k, v in items:
                if isinstance(v, list):
                    v = tuple(v)
                ret.add((k, v))
            return ret

        rzdoc, ctx = self.helper_create_doc(name='a', id_start=3000, sentence='a  with  b')
        node_ids = [x['id'] for x in rzdoc.nodes]
        clone = self.kernel.rzdoc__clone(rzdoc)
        clone_subset = self.kernel._clone_subset(node_ids)
        # TODO: currently the client doesn't handle them the same, so until then
        # check that _clone_subset returns a superset of the clone output
        clone_node_add_dict = {n['id']: n for n in clone.node_set_add}
        clone_subset_node_add_dict = {n['id']: n for n in clone_subset['node_set_add']}
        self.assertEqual(set(clone_node_add_dict.keys()), set(clone_subset_node_add_dict.keys()))
        for node_id in clone_node_add_dict.keys():
            clone_pairs = tuple_set(clone_node_add_dict[node_id].items())
            clone_subset_pairs = tuple_set(clone_subset_node_add_dict[node_id].items())
            self.assertGreater(clone_subset_pairs, clone_pairs)

        clone_link_add_dict = {n['id']: n for n in clone.link_set_add}
        clone_subset_link_add_dict = {n['id']: n for n in clone_subset['link_set_add']}
        self.assertEqual(set(clone_link_add_dict.keys()), set(clone_subset_link_add_dict.keys()))
        for link_id in clone_link_add_dict.keys():
            clone_pairs = tuple_set(clone_link_add_dict[link_id].items())
            clone_subset_pairs = tuple_set(clone_subset_link_add_dict[link_id].items())
            self.assertGreater(clone_subset_pairs, clone_pairs)



class TestFindLinksTouching(RhiziTestBase):

    def test_sanity(self):
        rzdoc, _ = self.helper_create_doc('find-links-touching', sentence='a  bemoans  b  besots  c')
        id_a, id_b = rzdoc.nodes[0]['id'], rzdoc.nodes[1]['id']
        id_bemoans, id_besots = rzdoc.links[0]['id'], rzdoc.links[1]['id']
        for inp, outp in [([id_a, id_b], [id_bemoans, id_besots]), ([id_a], [id_bemoans])]:
            test_op = DBO_find_links_touching(inp)
            ret = self.db_ctl.exec_op(test_op)
            self.assertEqual(ret, outp)




@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='TestRZDoc.test_rzdoc_lifcycle', verbosity=2)


if __name__ == "__main__":
    main()
