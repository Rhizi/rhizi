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
from werkzeug.test import Client
from werkzeug.test import EnvironBuilder

from rhizi.db_op import DBO_raw_query_set
from rhizi.rz_server import init_webapp
from rhizi.tests.test_util__pydev import debug__pydev_pd_arg
from rhizi.tests.test_util import RhiziTestBase


class TestRhiziAPI(RhiziTestBase):

    @classmethod
    def setUpClass(clz):
        super(TestRhiziAPI, clz).setUpClass()
        clz.webapp = webapp = init_webapp(clz.cfg, clz.kernel)
        webapp.user_db = clz.user_db
        clz.kernel.db_op_factory = webapp  # assist kernel with DB initialization
        # TODO: use a document that we create (Welcome Rhizi is the default init db right now,
        # can use that but need to have an assert on that earlier)
        clz.rzdoc_name = 'Welcome Rhizi'


    def test_load_node_non_existing(self):
        """
        loading a non existing node test
        """
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
        """
        loading an existing node test
        """
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

    def test_load_node_set(self):
        pass

@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='Test_DB_Op.test_cypher_exp_parsing', verbosity=2)

if __name__ == "__main__":
    main()
