import tempfile
import unittest
from rz_user_db import User_DB


class TestUser_DB(unittest.TestCase):

    @classmethod
    def setUpClass(self):
        pass

    def setUp(self):
        pass

    def test_db_lifecycle(self):
        tmp_file = tempfile.NamedTemporaryFile(prefix='rz_userdb_', dir='/tmp', suffix='_db')
        tmp_file.close()

        u_name = 'bob'
        u_email = 'bob@example.org'

        user_db = User_DB(db_path=tmp_file.name)
        user_db.init(mode='c')
        uid = user_db.user_add(u_name, u_email)
        user_db.user_add_role(uid, 'admin')
        user_db.shutdown()

        # reload & validate
        user_db = User_DB(db_path=tmp_file.name)
        user_db.init()

        # lookup_user__by_uid
        ret_uid, ret_u = user_db.lookup_user__by_uid(uid)
        self.assertEqual(ret_uid, uid)
        self.assertEqual(u_name, ret_u['user_name'])
        self.assertEqual(u_email, ret_u['email_address'])

        # lookup_user__by_username
        ret_uid, ret_u = user_db.lookup_user__by_email_address(u_email)
        self.assertEqual(ret_uid, uid)
        self.assertEqual(u_name, ret_u['user_name'])
        self.assertEqual(u_email, ret_u['email_address'])

        user_db.dump_to_file__str()
        user_db.shutdown()

    def tearDown(self):
        pass

def main():
    unittest.main()

if __name__ == "__main__":
    main()
