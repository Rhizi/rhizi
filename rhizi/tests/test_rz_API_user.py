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
import os

from ..rz_config import RZ_Config
from ..rz_server import init_webapp
from ..rz_user import rest__user_signup, User_Signup_Request
from .util import gen_random_name, gen_random_user_signup, RhiziTestBase
from .test_util__pydev import debug__pydev_pd_arg


class Test_RZ_User(RhiziTestBase):

    def test_user_signup__validate_emails(self):
        """Registration should accept only valid email addresses"""
        self.webapp.testing = True
        self.webapp.rz_config.access_control = True

        us_req = gen_random_user_signup()
        with self.webapp.test_client() as test_client:
            us_req['email_address'] = "foo@bar"
            req, req_data = self._json_post(test_client, '/signup', us_req)
            self.assertIn(b"Illegal", req.data)
            self.assertIn(b"email address", req.data)
            self.assertEqual(400, req.status_code, req_data)

    def test_user_signup__acl_domain(self):
        """Email registration should support domains whitelisting"""
        self.webapp.testing = True
        self.webapp.rz_config.access_control = True
        self.webapp.rz_config.acl_wl__email_domain_set = 'a.org, b.org'

        us_req = gen_random_user_signup()
        with self.webapp.test_client() as test_client:
            for email_address, expected_status_code in [('bob@a.org', 200),
                                                        ('bob@b.org', 200),
                                                        ('alice@foo.bar', 400),
                                                        ('bob@c.org', 400)]:

                us_req['email_address'] = email_address
                req, req_data = self._json_post(test_client, '/signup', us_req)

                self.assertEqual(expected_status_code, req.status_code, req_data)

    def test_user_signup__whitelist_emails(self):
        """Email registration should support email whitelisting"""
        self.webapp.testing = True
        self.webapp.rz_config.access_control = True
        self.webapp.rz_config.acl_wl__email_domain_set = 'a.org'
        self.webapp.rz_config.acl_wl__email_address_set_cached = ['alice@c.org', 'haha@c.org']  # hack: acl_wl__email_address_set_cached attribute access

        us_req = gen_random_user_signup()
        with self.webapp.test_client() as test_client:
            for email_address, expected_status_code in [('haha@c.org', 200), # whitelist specific user
                                                        ('alice@a.org', 200), # whitelist domain
                                                        ('roger@test.org', 400)]: # out

                us_req['email_address'] = email_address
                req, req_data = self._json_post(test_client, '/signup', us_req)
        """Email registration should support email whitelisting using file"""

    def test_user_signup__whitelist_emails_file(self):

        self.webapp.testing = True
        self.webapp.rz_config.access_control = True
        self.webapp.rz_config.acl_wl__email_address_set_cached = [] # init clean
        self.webapp.rz_config.acl_wl__email_address_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),'emails.txt')
        self.webapp.rz_config.acl_wl__email_address_set_cached = ['alice@c.org']
        us_req = gen_random_user_signup()

        with self.webapp.test_client() as test_client:
            for email_address, expected_status_code in [('joe@test.org', 200), # whitelisted in file
                                                        ('jane@test.org', 200), # whitelisted in file
                                                        ('someone@domain.org', 200), # whitelisted in file
                                                        ('alice@c.org', 200), # whitelisted in cache
                                                        ('roger@foo.bar', 400)]: # not whitelisted

                us_req['email_address'] = email_address
                req, req_data = self._json_post(test_client, '/signup', us_req)

                self.assertEqual(expected_status_code, req.status_code, req_data)
                self.assertEqual(expected_status_code, req.status_code, req_data)

@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='Test_RZ_User.test_user_signup__acl_domain', verbosity=2)

if __name__ == "__main__":
    main()
