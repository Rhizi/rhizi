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

import random
import json
from rhizi.tests.test_util__pydev import debug__pydev_pd_arg
from rhizi.tests.util import RhiziTestBase

rzdoc_name = 'Test Document for Rhizi API'


class TestRhiziAPI(RhiziTestBase):

    @classmethod
    def setUpClass(cls):
        super(TestRhiziAPI, cls).setUpClass()
        # store rzdoc name
        cls.rzdoc_name = rzdoc_name

        # HACK: we use the same rhizi server for all tests, so set access
        # control here since we override it in other tests
        cls.cfg.access_control = False

        # initialize random nodes generator
        cls._nodes_gen = cls.get_nodes_gen()
        cls._nodes_gen.send(None)

    @classmethod
    def setUp(cls):
        # clear all nodes & links & meta nodes
        cls.kernel.reset_graph()
        # create a test document
        cls.kernel.rzdoc__create(cls.rzdoc_name)
        cls.rzdoc_test = cls.kernel.rzdoc__lookup_by_name(cls.rzdoc_name)

    @classmethod
    def tearDownClass(cls):
        """ Delete test document after tests execution """
        # clear all nodes & links & meta nodes
        cls.kernel.reset_graph()

    @classmethod
    def get_nodes_gen(cls):
        names = ['Tom', 'Snappy', 'Kitty', 'Jessie', 'Chester']
        groups = ["friend", "foe", "neutral", "others"]
        ind = 0
        count = yield
        while True:
            nodes = [{
                        "name": names[i % len(names)],
                        "id": str(random.getrandbits(32)),
                        "__label_set": [groups[i % len(groups)]]
                     } for i in range(ind, ind + count)]
            ind = (ind + count) % len(names)
            count = yield nodes

    def get_nodes(self, count):
        return self._nodes_gen.send(count)

    def get_random_node(self):
        return self.get_nodes(1)[0]

    def get_link(self, nodeA_id, nodeB_id):
        relationships = ["loves", "hates", "despises", "admires", "ignores"]
        link = {}
        link["id"] = str(random.getrandbits(32))
        link["__dst_id"] = nodeA_id
        link["__src_id"] = nodeB_id
        link["__type"] = [random.choice(relationships)]
        return link

    def get_link_empty_type(self, nodeA_id, nodeB_id):
        link = self.get_link(nodeA_id, nodeB_id)
        link['__type'] = ['']
        return link

    def test_commit_topo_should_have_meta_attributes(self):
        """ API commit_topo should throw error with bad-formatted JSON"""
        with self.webapp.test_client() as c:
            node = { "id" : str(random.getrandbits(32)), 'name': str(random.getrandbits(32))} #node without __label_set value

            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : {"node_set_add" :[ node ] }}
            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)
            self.assertEqual(req.status_code, 500) # TODO : should throw 400
            self.assertIn("missing type meta-attribute", req.data.decode('utf-8'))

            node = self.get_random_node()
            node["__label_set"].append("ha") # add a 2nd label

            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : {"node_set_add" :[ node ] }}
            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)
            self.assertEqual(req.status_code, 500) # TODO : should throw 400
            self.assertIn("only single-label mapping currently supported for nodes", req.data.decode('utf-8'))

            node = self.get_random_node()
            node["__label_set"] =  "hahah" # use string instead of list

            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : {"node_set_add" :[ node ] }}
            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)
            self.assertEqual(req.status_code, 500) # TODO : should throw 400
            self.assertIn("with non-list type", req.data.decode('utf-8'))

    def test_commit_topo_add_link_empty_name(self):
        """ API must allow empty names on links """
        with self.webapp.test_client() as c:
            nodeA, nodeB = self.get_nodes(2)
            linkA = self.get_link_empty_type(nodeA["id"], nodeB["id"])
            topo_diff = { "node_set_add" : [ nodeA, nodeB ], 'link_set_add': [ linkA ] }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}
            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)
            self.assertEqual(req.status_code, 200)
            # read it back, make sure it appears as an empty label
            link_id = resp['data']['link_id_set_add'][0]
            req, resp = self._json_post(c, '/api/rzdoc/clone', { 'rzdoc_name' : self.rzdoc_name })
            new_link_label = [l['__type'] for l in resp['data'][0]['link_set_add'] if l['id'] == link_id][0][0]
            self.assertEqual(req.status_code, 200)
            self.assertEqual(new_link_label, '')

    def test_commit_topo_add_node(self):
        """ API should allow creation of new node"""

        with self.webapp.test_client() as c:

            nodeA, nodeB = self.get_nodes(2)

            # attributes
            topo_diff = { "node_set_add" : [ nodeA, nodeB ]  }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}

            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)
            self.assertEqual(req.status_code, 200)
            self.assertEqual(len(resp["data"]["node_id_set_add"]), 2)

    def test_commit_topo_add_nodes_with_links(self):
        """ API should allow creation of new node and links"""

        with self.webapp.test_client() as c:

            nodeA, nodeB = self.get_nodes(2)

            linkA = self.get_link(nodeA["id"], nodeB["id"])
            linkB = self.get_link(nodeA["id"], nodeB["id"])

            # attributes
            topo_diff = {  "node_set_add" : [ nodeA, nodeB ], "link_set_add" : [ linkA, linkB ]  }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}

            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)

            self.assertEqual(req.status_code, 200)
            self.assertEqual(len(resp["data"]["link_id_set_add"]), 2)
            self.assertEqual(len(resp["data"]["node_id_set_add"]), 2)

    def test_commit_topo_add_links(self):

        with self.webapp.test_client() as c:

            # add nodes
            nodeA, nodeB = self.get_nodes(2)
            topo_diff = { "node_set_add" : [ nodeA, nodeB ]  }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}
            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)

            # get nodes ids
            node_ids = resp["data"]["node_id_set_add"]

            # create links
            linkA = self.get_link(node_ids[0], node_ids[1])
            linkB = self.get_link(node_ids[0], node_ids[1])

            topo_diff = { "link_set_add" : [ linkA, linkB ]  }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}
            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)

            self.assertEqual(req.status_code, 200)
            self.assertEqual(len(resp["data"]["link_id_set_add"]), 2)

    def test_commit_topo_delete_nodes(self):

        with self.webapp.test_client() as c:

            # add nodes
            nodeA, nodeB = self.get_nodes(2)
            topo_diff = { "node_set_add" : [ nodeA, nodeB ]  }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}
            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)

            # get nodes ids
            node_ids = resp["data"]["node_id_set_add"]

            # delete nodes
            topo_diff = { "node_id_set_rm" : node_ids }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}
            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)

            self.assertEqual(req.status_code, 200)
            self.assertEqual(len(resp["data"]["node_id_set_rm"]), 2)
            self.assertEqual(set(resp["data"]["node_id_set_rm"]), set(node_ids))

    def test_commit__attr(self):

        with self.webapp.test_client() as c:

            # add nodes
            nodeA, nodeB = self.get_nodes(2)
            topo_diff = { "node_set_add" : [ nodeA, nodeB ]  }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}
            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__topo', payload)

            # get nodes ids
            node_ids = resp["data"]["node_id_set_add"]

            # modify id should raise error
            attr_diff = {}
            attr_diff["__type_node"] = {
                node_ids[0] : {
                    "__attr_write"  : { "id" : "1234234" }
                },
                node_ids[1] : {
                    "__attr_write"  : { "id" : "1234234" }
                }
            }
            payload = { "rzdoc_name" : self.rzdoc_name, "attr_diff" : attr_diff}

            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__attr', payload)

            self.assertEqual(req.status_code, 500)
            self.assertIn("write to 'id'", resp["error"])

            # modify name
            attr_diff = {}
            attr_diff["__type_node"] = {
                node_ids[0] : {
                    "__attr_write"  : {"name" : "some new name", "type" : "Collaborator"},
                },
                node_ids[1] : {
                    "__attr_write"  : {"name" : "blabla", "type" : "Project"},
                }
            }
            payload = { "rzdoc_name" : self.rzdoc_name, "attr_diff" : attr_diff}

            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__attr', payload)

            self.assertEqual(req.status_code, 200)
            self.assertEqual(resp["error"], None)
            resp_data = resp["data"]["__type_node"]
            self.assertEqual(resp_data[node_ids[0]]["__attr_write"]["name"], "some new name")
            self.assertEqual(resp_data[node_ids[1]]["__attr_write"]["name"], "blabla")
            self.assertEqual(resp_data[node_ids[0]]["__attr_write"]["type"], "Collaborator")
            self.assertEqual(resp_data[node_ids[1]]["__attr_write"]["type"], "Project")

            # delete attr
            attr_diff = {}
            attr_diff["__type_node"] = {
                node_ids[0] : {
                    "__attr_remove"  : {"type" : ""},
                },
                node_ids[1] : {
                    "__attr_remove"  : {"type" : "", "name" :""},
                }
            }
            payload = { "rzdoc_name" : self.rzdoc_name, "attr_diff" : attr_diff}

            req, resp = self._json_post(c, '/api/rzdoc/diff-commit__attr', payload)

            self.assertEqual(req.status_code, 200)
            self.assertEqual(resp["error"], None)
            resp_data = resp["data"]["__type_node"]

            self.assertEqual(resp_data[node_ids[0]]["__attr_remove"], ["type"])
            self.assertEqual(set(resp_data[node_ids[1]]["__attr_remove"]), {"type", "name"})



@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='Test_DB_Op.test_cypher_exp_parsing', verbosity=2)

if __name__ == "__main__":
    main()
