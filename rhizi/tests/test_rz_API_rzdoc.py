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


import json
import logging
import unittest
import urlparse
from werkzeug.test import Client
from werkzeug.test import EnvironBuilder

from rhizi.db_op import DBO_raw_query_set
from rhizi.tests.test_util__pydev import debug__pydev_pd_arg
from rhizi.tests.util import RhiziTestBase


rzdoc_name = 'Test Document for Rhizi API'

class TestRhiziAPI(RhiziTestBase):

    @classmethod
    def setUpClass(clz):
        super(TestRhiziAPI, clz).setUpClass()
        """ Create an API test document """
        clz.kernel.rzdoc__create(rzdoc_name)

        # store rzdoc name
        clz.rzdoc_name = rzdoc_name

        # HACK: we use the same rhizi server for all tests, so set access
        # control here since we override it in other tests
        clz.cfg.access_control = False

    @classmethod
    def tearDownClass(clz):
        """ Delete test document after tests execution """
        lookup_ret = clz.kernel.rzdoc__lookup_by_name(rzdoc_name)
        if lookup_ret != None:
            clz.kernel.rzdoc__delete(lookup_ret)

    def test_politeness(self):
        """ App should be polite, so errors can be forgiven :) """
        with self.webapp.test_client() as c:
            req = c.get('/some-random-page-that-does-not-exist')
            self.assertIn("sorry", req.data) # say sorry on 404

    def test_index_redirect(self):
        """ Index '/' should redirect to '/index' """
        with self.webapp.test_client() as c:
            resp = c.get('/')
            self.assertIn("/index", resp.location)
            self.assertEqual(resp.status_code, 302) #

    # def test_index_html(self):
    #     """" '/index' should serve a static page with the right context"""
    #     with self.webapp.test_client() as c:
    #         resp = c.get('/index')
    #         self.assertEqual(resp.status_code, 201)
    #         self.assertIn("rhizi", resp.data) # company name should be in the homepage

    def test_create_new_doc(self):
        """API should allow creation of new documents"""
        with self.webapp.test_client() as c:
            req = c.post('/api/rzdoc/test_doc/create',
                         content_type='application/json',
                         data=json.dumps({}))
            req_data = json.loads(req.data)
            self.assertEqual(req.status_code, 201) # creation ok
            lookup_test_doc = self.kernel.rzdoc__lookup_by_name("test_doc")
            self.assertNotEqual(lookup_test_doc, None) # exists in db
            self.kernel.rzdoc__delete(lookup_test_doc)

    def test_doc_already_exists(self):
        """ API should prevent creation of doc with  identical name  """
        with self.webapp.test_client() as c:
            # create doc
            self.kernel.rzdoc__create("test_duplicate_doc") # create doc
            lookup_duplicate_doc = self.kernel.rzdoc__lookup_by_name("test_duplicate_doc")

            # check API
            req = c.post('/api/rzdoc/test_duplicate_doc/create',
                         content_type='application/json',
                         data=json.dumps({}))
            req_data = json.loads(req.data)
            self.assertEqual(req.status_code, 500) # raise error
            self.assertIn("already exists", req.data) # return error message

            # delete doc
            self.kernel.rzdoc__delete(lookup_duplicate_doc)

    def test_doc_delete(self):
        """API should allow deletion of documents"""
        with self.webapp.test_client() as c:
            self.kernel.rzdoc__create("test_delete_doc") # create doc

            req = c.delete('/api/rzdoc/test_delete_doc/delete',
                         content_type='application/json',
                         data=json.dumps({}))
            self.assertEqual(req.status_code, 204) # deletion ok

            lookup_duplicate_doc = self.kernel.rzdoc__lookup_by_name("test_duplicate_doc")
            self.assertEqual(lookup_duplicate_doc, None)

    def test_search(self):
        """API should allow to find documents by name"""
        with self.webapp.test_client() as c:

            req = c.post('/api/rzdoc/search',
                         content_type='application/json',
                         data=json.dumps({'search_query': self.rzdoc_name}))
            self.assertEqual(req.status_code, 200)
            req_data = json.loads(req.data)
            self.assertIn(self.rzdoc_name, str(req_data["data"]))
            self.assertEqual(req_data["error"], None)

    def test_search_error(self):
        """Wrong query in API search should raise error"""
        with self.webapp.test_client() as c:
            req = c.post('/api/rzdoc/search',
                 content_type='application/json',
                 data=json.dumps({'search_query': "random non-existing stuff"}))

            self.assertEqual(req.status_code, 200)
            req_data = json.loads(req.data)
            self.assertEqual(req_data["data"], [])
            self.assertEqual(req_data["error"], None )

    # Fetch nodes sets
    def test_load_node_non_existing(self):
        """ Loading a non existing node test """
        id_set = ['non_existing_id']
        with self.webapp.test_client() as c:
            req = c.post('/api/rzdoc/fetch/node-set-by-id',
                         content_type='application/json',
                         data=json.dumps({ 'id_set': id_set, 'rzdoc_name': self.rzdoc_name}))
            req_data = json.loads(req.data)
            rz_data = req_data['data']
            rz_err = req_data['error']
            self.assertEqual(None, rz_err)
            self.assertEqual(0, len(rz_data))

    def test_load_node_set_by_id_existing(self):
        """ Loading an existing node test """
        id_set = ['skill_00']
        q = ['create (s:Skill {id: \'skill_00\'} )']
        op = DBO_raw_query_set(q)
        self.db_ctl.exec_op(op)

        with self.webapp.test_client() as c:
            req = c.post('/api/rzdoc/fetch/node-set-by-id',
                         content_type='application/json',
                         data=json.dumps({ 'id_set': id_set, 'rzdoc_name': self.rzdoc_name}))
            n_set = json.loads(req.data)['data']

            self.assertEqual(1, len(n_set))
            self.assertEqual(n_set[0]['id'], id_set[0])

@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='Test_DB_Op.test_cypher_exp_parsing', verbosity=2)

if __name__ == "__main__":
    main()
