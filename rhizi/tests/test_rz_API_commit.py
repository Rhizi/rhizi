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
        """ Create an API test document """

        cls.kernel.rzdoc__create(rzdoc_name)
        cls.rzdoc_test = cls.kernel.rzdoc__lookup_by_name(rzdoc_name)

        # store rzdoc name
        cls.rzdoc_name = rzdoc_name

        # HACK: we use the same rhizi server for all tests, so set access
        # control here since we override it in other tests
        cls.cfg.access_control = False

    @classmethod
    def tearDownClass(cls):
        """ Delete test document after tests execution """
        pass
        lookup_ret = cls.kernel.rzdoc__lookup_by_name(rzdoc_name)
        if lookup_ret != None:
            cls.kernel.rzdoc__delete(lookup_ret)

    def get_random_node(self):
        names =  ['Tom', 'Snappy', 'Kitty', 'Jessie', 'Chester']
        groups =  ["friend", "foe", "neutral", "others"]
        node =  {}
        node["name"] = random.choice(names)
        node["id"] = str(random.getrandbits(32))
        node["__label_set"] = [random.choice(groups)]
        return node

    def get_link(self, nodeA_id, nodeB_id):
        relationships = ["loves", "hates", "despises", "admires", "ignores"]
        link = {}
        link["id"] = str(random.getrandbits(32))
        link["__dst_id"] = nodeA_id
        link["__src_id"] = nodeB_id
        link["__type"] = [random.choice(relationships)]
        return link

    def test_commit_topo_should_have_meta_attributes(self):
        """ API commit_topo should throw error with bad-formatted JSON""" 
        with self.webapp.test_client() as c:
            node = { "id" : str(random.getrandbits(32))} #node without __label_set value

            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : {"node_set_add" :[ node ] }}
            req = c.post('/api/rzdoc/diff-commit__topo',
                             content_type='application/json',
                             data=json.dumps(payload))
            self.assertEqual(req.status_code, 500) # TODO : should throw 400
            self.assertIn("missing type meta-attribute", req.data)

            node = self.get_random_node()
            node["__label_set"].append("ha") # add a 2nd label

            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : {"node_set_add" :[ node ] }}
            req = c.post('/api/rzdoc/diff-commit__topo',
                             content_type='application/json',
                             data=json.dumps(payload))
            self.assertEqual(req.status_code, 500) # TODO : should throw 400
            self.assertIn("only single-label mapping currently supported for nodes", req.data)

            node = self.get_random_node()
            node["__label_set"] =  "hahah" # use string instead of list

            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : {"node_set_add" :[ node ] }}
            req = c.post('/api/rzdoc/diff-commit__topo',
                             content_type='application/json',
                             data=json.dumps(payload))
            self.assertEqual(req.status_code, 500) # TODO : should throw 400
            self.assertIn("with non-list type", req.data)


    def test_commit_topo_add_node(self):
        """ API should allow creation of new node"""

        with self.webapp.test_client() as c:

            nodeA = self.get_random_node()
            nodeB = self.get_random_node()
            print nodeA, nodeB

            # attributes
            topo_diff = { "node_set_add" : [ nodeA, nodeB ]  }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}

            req = c.post('/api/rzdoc/diff-commit__topo',
                         content_type='application/json',
                         data=json.dumps(payload))

            resp = json.loads(req.data)
            print resp
            self.assertEqual(req.status_code, 200)
            self.assertEqual(len(resp["data"]["node_id_set_add"]), 2)

    def test_commit_topo_add_nodes_with_links(self):
        """ API should allow creation of new node"""

        with self.webapp.test_client() as c:

            nodeA = self.get_random_node()
            nodeB = self.get_random_node()
            print nodeA, nodeB

            linkA = self.get_link(nodeA["id"], nodeB["id"])
            linkB = self.get_link(nodeA["id"], nodeB["id"])
            print linkA, linkB

            # attributes
            topo_diff = {  "node_set_add" : [ nodeA, nodeB ], "link_set_add" : [ linkA, linkB ]  }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}

            req = c.post('/api/rzdoc/diff-commit__topo',
                         content_type='application/json',
                         data=json.dumps(payload))

            resp = json.loads(req.data)
            print resp

            self.assertEqual(req.status_code, 200)
            self.assertEqual(len(resp["data"]["link_id_set_add"]), 2)
            self.assertEqual(len(resp["data"]["node_id_set_add"]), 2)

    def test_commit_topo_add_links(self):

        with self.webapp.test_client() as c:
            # add nodes
            nodeA = self.get_random_node()
            nodeB = self.get_random_node()
            topo_diff = { "node_set_add" : [ nodeA, nodeB ]  }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}
            req = c.post('/api/rzdoc/diff-commit__topo',
                         content_type='application/json',
                         data=json.dumps(payload))
            
            resp = json.loads(req.data)
            node_ids = resp["data"]["node_id_set_add"]

            linkA = self.get_link(node_ids**)
            linkB = self.get_link(node_ids**)

            topo_diff = { "link_set_add" : [ linkA, linkB ]  }
            payload = { "rzdoc_name" : self.rzdoc_name, "topo_diff" : topo_diff}

            req = c.post('/api/rzdoc/diff-commit__topo',
                         content_type='application/json',
                         data=json.dumps(payload) )
            self.assertEqual(req.status_code, 200)
            self.assertEqual(len(resp["data"]["link_id_set_add"]), 2)



@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='Test_DB_Op.test_cypher_exp_parsing', verbosity=2)

if __name__ == "__main__":
    main()
