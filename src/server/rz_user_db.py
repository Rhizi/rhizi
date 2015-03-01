import copy
import logging
import shelve
import sys

import rz_user

class User_Account(object):

    def __init__(self, first_name,
                       last_name,
                       rz_username,
                       email_address,
                       pw_hash,
                       role_set=[]):

        self.first_name = first_name
        self.last_name = last_name
        self.rz_username = rz_username
        self.email_address = email_address
        self.pw_hash = pw_hash
        self.role_set = role_set

    def __str__(self, *args, **kwargs):
        ret_arr = ['rz_username: %s' % (self.rz_username),
                   'email_address: %s' % (self.email_address),
                   'role-set: %s' % (self.role_set),
                   ]
        return ','.join(ret_arr)

class User_DB(object):
    """
    Simple user database:
       - caller is responsible for calling init() & shutdown()
       - users identified by string uid
       - unique user email_address constraint enforced
       - handle user password authentication
    """

    def __init__(self, db_path):
        self.user_db_path = db_path

    def __iter__(self):
        for uid in self.persistent_data_store.keys():
            yield self.lookup_user__by_uid(uid)  # return sanitized account

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

    def __lookup_user__by_email_address(self, email_address):

        # FIXME: avoid linear search
        for uid, u in self.persistent_data_store.items():
            if u.email_address == email_address:
                return uid, u

        raise Exception('no user found with email_address=%s' % (email_address))

    def lookup_user__by_uid(self, uid):
        """
        @return: user record with pw entry removed
        """
        assert str == type(uid)

        u = self.persistent_data_store.get(uid)

        if None == u:
            raise Exception('no user found with uid=%s' % (uid))

        return self.__process_return_value(uid, u)

    def lookup_user__by_email_address(self, email_address):
        """
        @return: user record with pw entry removed
        """
        uid, u = self.__lookup_user__by_email_address(email_address)
        return self.__process_return_value(uid, u)

    def user_add(self, u_account):
        """
        @return: the string uid of the newly added user
        """
        # apply unique email constraint
        for uid, u in self.persistent_data_store.items():
            if u.email_address == u_account.email_address:
                raise Exception('existing user with identical email address: uid: %s ' % (uid))

        assert None != u_account.pw_hash, 'missing pw_hash for new user'

        uid = str(len(self.persistent_data_store) + 1)
        self.persistent_data_store[uid] = u_account
        return uid

    def update_user_password(self, uid, new_plaintxt_pw):
        u_account = self.persistent_data_store[uid]
        old_pw_hash = u_account.pw_hash
        u_account.pw_hash = rz_user.calc_user_pw_hash(new_plaintxt_pw)
        self.persistent_data_store[uid] = u_account  # write new record
        return old_pw_hash

    def user_rm(self, uid):
        del self.persistent_data_store[uid]

    def user_add_role(self, uid, role):
        if not self.valid_role(uid, role):
            raise Exception("invalid role %s for user %s" % (role, uid))
        u = self.persistent_data_store[uid]
        u.role_set.append(role)
        self.persistent_data_store[uid] = u

    def user_rm_role(self, uid, role):
        u = self.persistent_data_store[uid]
        i = u.role_set.index(role)
        if -1 == i:
            return
        del u.role_set[i]
        self.persistent_data_store[uid] = u

    def user_has_role(self, uid, role):
        """
        @return: True if user roles contain passed role
        """

        u = self.persistent_data_store[uid]
        return role in u.role_set

    def valid_role(self, uid, role):
        """
        @return: True if role is appropriate for uid. Currently ignores uid
        """
        return role in ['admin', 'user']

    def validate_login(self, email_address, pw_hash):
        _, u_account = self.__lookup_user__by_email_address(email_address)
        existing_pw_hash = u_account.pw_hash

        assert None != existing_pw_hash, 'missing pw_hash for existing user'

        if pw_hash != existing_pw_hash:
            raise Exception('Not authorized')

    def shutdown(self):
        self.persistent_data_store.close()
