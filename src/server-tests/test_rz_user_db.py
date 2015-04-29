import tempfile
import unittest

from rz_user import User_Account
from rz_user_db import User_DB
from test_util__pydev import debug__pydev_pd_arg

class TestUser_DB(unittest.TestCase):

    @classmethod
    def setUpClass(self):
        pass

    def setUp(self):
        pass

    def test_db_lifecycle(self):
        tmp_file = tempfile.NamedTemporaryFile(prefix='rz_userdb_', dir='/tmp', suffix='_db')
        tmp_file.close()

        u_first_name = 'bob'
        u_email = 'bob@example.org'
        pw_hash = ''

        u_account = User_Account(first_name=u_first_name,
                                 last_name=u_first_name,
                                 rz_username=u_email,
                                 email_address=u_email,
                                 pw_hash=pw_hash)

        user_db = User_DB(db_path=tmp_file.name)
        user_db.init(mode='c')
        uid = user_db.user_add(u_account)
        user_db.user_add_role(uid, 'admin')
        user_db.shutdown()

        # reload & validate
        user_db = User_DB(db_path=tmp_file.name)
        user_db.init()

        # lookup_user__by_uid
        ret_uid, ret_u = user_db.lookup_user__by_uid(uid)
        self.assertEqual(ret_uid, uid)
        self.assertEqual(u_email, ret_u.email_address)
        self.assertEqual(u_email, ret_u.rz_username)
        self.assertEqual(u_first_name, ret_u.first_name)
        self.assertFalse(hasattr(ret_u, 'pw_hash'))

        # lookup_user__by_username
        ret_uid, ret_u = user_db.lookup_user__by_email_address(u_email)
        self.assertEqual(ret_uid, uid)
        self.assertEqual(u_email, ret_u.rz_username)
        self.assertEqual(u_email, ret_u.email_address)

        user_db.dump_to_file__str()
        user_db.shutdown()

    def tearDown(self):
        pass

@debug__pydev_pd_arg
def main():
    unittest.main(defaultTest='TestUser_DB.test_db_lifecycle', verbosity=2)

if __name__ == "__main__":
    main()
