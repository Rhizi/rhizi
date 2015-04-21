#!/usr/bin/python2.7

import argparse
import os
import pickle
import pwd
import re
import sys

from crypt_util import hash_pw
from rz_server import init_config
from rz_user import User_Account
from rz_user_db import User_DB


def init_pw_db(cfg, user_pw_list_file, user_db_path, ugid_str='www-data'):
    """
    @param ugid_str: shared uid, gid set on generated file
    """

    def add_user_login(first_name, last_name,
                       rz_username, email_address, pw_plaintext):

        pw_hash = hash_pw(str(pw_plaintext), salt)
        u_account = User_Account(first_name=first_name,
                                 last_name=last_name,
                                 rz_username=rz_username,
                                 email_address=email_address,
                                 pw_hash=pw_hash,
                                 role_set=['user'])
        user_db.user_add(u_account)

    if os.path.exists(user_db_path):
        print('user_db_path already exists, aborting: ' + user_db_path)
        return

    user_db = User_DB(db_path=user_db_path)
    user_db.init(mode='n')  # always create a new, empty database, open for reading and writing

    salt = cfg.secret_key
    assert len(salt) > 8, 'server-key not found or too short'
    print('using config secret_key for salt generation: ' + salt[:3] + '...')

    u_count = 0
    with open(user_pw_list_file, 'r') as f:
        for line in f:
            if re.match('(^#)|(\s+$)', line):
                continue

            kv_arr = line.split(',')
            if 5 != len(kv_arr):
                raise Exception('failed to parse first-name,last-name,email,user,pw line: ' + line)

            first_name, last_name, rz_username, email_address, pw_plaintext = map(str.strip, kv_arr)
            add_user_login(first_name=first_name,
                           last_name=last_name,
                           rz_username=rz_username,
                           email_address=email_address,
                           pw_plaintext=pw_plaintext)

            print('user_db: added entry: rz_username: %s, pw: %s...' % (rz_username, pw_plaintext[:3]))
            u_count = u_count + 1

    user_db.shutdown()

    ugid = pwd.getpwnam(ugid_str).pw_uid
    os.chown(user_db_path, ugid, ugid)

    print('user_db generated: path: %s, user-count: %d' % (user_db_path, u_count))

def open_existing_user_db(user_db_path):
    user_db = User_DB(db_path=user_db_path)
    user_db.init(mode='w')
    return user_db

def role_add(user_db_path, user_email, role):
    user_db = open_existing_user_db(user_db_path)
    uid, u = user_db.lookup_user__by_email_address(user_email)
    user_db.user_add_role(uid, role)

def role_rm(user_db_path, user_email, role):
    user_db = open_existing_user_db(user_db_path)
    uid, u = user_db.lookup_user__by_email_address(user_email)
    user_db.user_rm_role(uid, role)

def main():
    p = argparse.ArgumentParser(description='rz-cli tool')
    p.add_argument('--config-dir', help='path to Rhizi config dir', default='res/etc')
    p.add_argument('--user-db-path', help='path to user_db (ignore config)')
    p.add_argument('--init-user-db', help='init user db', action='store_const', const=True)
    p.add_argument('--user-db-init-file', help='user_db db initialization file in \'user,pw\' format')
    p.add_argument('--email', help='email of user to operate on')
    p.add_argument('--role-add', help='role to add to user, i.e. admin or user')
    p.add_argument('--role-rm', help='role to remove from user')

    args = p.parse_args()
    cfg = init_config(args.config_dir)
    user_db_path = cfg.user_db_path

    if args.init_user_db:
        init_pw_db(cfg, args.user_db_init_file, user_db_path)
        exit(0)

    if args.email:
        if args.role_add:
            role_add(user_db_path, args.email, args.role_add)
        if args.role_rm:
            role_rm(user_db_path, args.email, args.role_rm)

if __name__ == '__main__':
    main()
