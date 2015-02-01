import copy
import logging
import shelve
import sys


class User_Account(object):

    def __init__(self, first_name,
                       last_name,
                       rz_username,
                       email_address,
                       role_set=[]):

        self.first_name = first_name
        self.last_name = last_name
        self.rz_username = rz_username
        self.email_address = email_address
        self.role_set = role_set

class User_DB(object):
    """
    Simple user database:
       - caller is responsible for calling init() & shutdown()
       - users identified by string uid
       - unique user email_address constraint enforced
    """

    def __init__(self, db_path):
        self.user_db_path = db_path

    def dump_to_file__str(self, output_file_path=None):
        """
        Dump record string representation to file

        @param output_file_path: if not specified stdout is used
        """

        def _write_record(f_out, uid, u):
            f_out.write('uid: %s: %s\n' % (uid, str(u)))

        if output_file_path:
            with open(output_file_path, 'w') as f_out:
                for uid, u in self.persistent_data_store.items():
                    _write_record(f_out, uid, u)
        else:
            for uid, u in self.persistent_data_store.items():
                _write_record(sys.stdout, uid, u)

    def init(self, mode='r'):
        """
        @param mode: see anydbm.open()
        """
        self.persistent_data_store = shelve.open(self.user_db_path, flag=mode, writeback=False)  # local handling of writeback

    def __process_return_value(self, uid, u):
        """
        common lookup function return value processing:
           - return dict copies
           - sanitize sensitive data
        """

        u_ret = copy.copy(u)
        del u_ret.pw_hash
        return uid, u_ret

    def lookup_user__by_uid(self, uid):

        assert str == type(uid)

        u = self.persistent_data_store.get(uid)

        if None == u:
            raise Exception('no user found with uid=%s' % (uid))

        return self.__process_return_value(uid, u)

    def lookup_user__by_email_address(self, email_address):
        for uid, u in self.persistent_data_store.items():
            if u.email_address == email_address:
                return self.__process_return_value(uid, u)

        raise Exception('no user found with email_address=%s' % (email_address))

    def user_add(self, first_name, last_name, rz_username, email_address):
        """
        @return: the string uid of the newly added user
        """
        # apply unique email constraint
        for uid, u in self.persistent_data_store.items():
            if u.email_address == email_address:
                raise Exception('existing user with identical email address: uid: %s ' % (uid))

        uid = str(len(self.persistent_data_store) + 1)
        u = User_Account(first_name=first_name,
                         last_name=last_name,
                         rz_username=rz_username,
                         email_address=email_address,
                         role_set=[])

        self.persistent_data_store[uid] = u
        return uid

    def user_rm(self, uid):
        del self.persistent_data_store[uid]

    def user_add_role(self, uid, role):
        u = self.persistent_data_store[uid]
        u.role_set.append(role)
        self.persistent_data_store[uid] = u

    def user_has_role(self, uid, role):
        """
        @return: True if user roles contain passed role
        """

        u = self.persistent_data_store[uid]
        return role in u.role_set

    def shutdown(self):
        self.persistent_data_store.close()
