import json
import logging
import unittest

from rz_config import RZ_Config
from rz_server import FlaskExt, init_webapp
from rz_user import rest__user_signup, User_Signup_Request
from test_util import gen_random_name
from test_util__pydev import debug__pydev_pd_arg


log = logging.getLogger('rhizi')

class Test_RZ_User(unittest.TestCase):

    @classmethod
    def setUpClass(self):
        cfg = RZ_Config.generate_default()
        webapp = init_webapp(cfg, None)
        webapp.testing = True
        self.webapp = webapp

    def setUp(self):
        pass

    def test_user_signup__acl_domain(self):

        self.webapp.rz_config.access_control = True
        self.webapp.rz_config.mta_port = 50000  # prevent accidental email sending
        self.webapp.rz_config.acl_wl__email_domain_set = 'a.org, b.org'
        self.webapp.rz_config.acl_wl__email_address_set_cached = ['alice@foo.bar', 'alice@zoo.bar']  # hack: acl_wl__email_address_set_cached attribute access

        us_req = self.gen_random_user_signup()
        with self.webapp.test_client() as test_client:
            for email_address, expected_status_code in [('bob@a.org', 500),  # FIXME: use 200, 500 caused by mta_port hack
                                                        ('bob@b.org', 500),  # FIXME: use 200, 500 caused by mta_port hack
                                                        ('alice@foo.bar', 500),
                                                        ('bob@c.org', 400)]:

                us_req['email_address'] = email_address
                req = test_client.post('/signup',
                                       content_type='application/json',
                                       data=json.dumps(us_req))

                req_data = json.loads(req.data)
                self.assertEqual(expected_status_code, req.status_code, req_data)

    def tearDown(self):
        pass

@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='Test_RZ_User.test_user_signup__acl_domain', verbosity=2)

if __name__ == "__main__":
    main()
