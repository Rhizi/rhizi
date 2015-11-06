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

import argparse
import os
import pickle
import pwd
import re
import sys
from getpass import getpass

from .. crypt_util import hash_pw
from .. rz_server import init_config
from .. rz_user import User_Account
from .. rz_user_db import User_DB

def add_user_login(user_db, salt, first_name, last_name,
                   rz_username, email_address, pw_plaintext):

    pw_hash = hash_pw(str(pw_plaintext), salt)
    u_account = User_Account(first_name=first_name,
                             last_name=last_name,
                             rz_username=rz_username,
                             email_address=email_address,
                             pw_hash=pw_hash,
                             role_set=['user'])
    user_db.user_add(u_account)


def init_pw_db(cfg, user_pw_list_file, user_db_path, ugid_str='www-data'):
    """
    @param ugid_str: shared uid, gid set on generated file
    """

    if os.path.exists(user_db_path):
        print('user_db_path already exists, aborting: ' + user_db_path)
        return

    user_db = User_DB(db_path=user_db_path)
    user_db.init(mode='n')  # always create a new, empty database, open for reading and writing

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
            add_user_login(user_db=user_db,
                           self=cfg.secret_key,
                           first_name=first_name,
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

def list_users(user_db_path):
    user_db = open_existing_user_db(user_db_path)
    for i, user in user_db:
        print('{}'.format(user))

def add_user(user_db_path, cfg, email, password, first, last, username):
    user_db = open_existing_user_db(user_db_path)
    add_user_login(user_db=user_db,
                   salt=cfg.secret_key,
                   first_name=first,
                   last_name=last,
                   rz_username=username,
                   email_address=email,
                   pw_plaintext=password)

def main():
    commands = ['role-add', 'role-rm', 'list', 'add']
    p = argparse.ArgumentParser(description='rz-cli tool. You must provide a command, one of:\n{}'.format(commands))
    p.add_argument('--config-dir', help='path to Rhizi config dir', default='res/etc')
    p.add_argument('--user-db-path', help='path to user_db (ignore config)')
    p.add_argument('--init-user-db', help='init user db', action='store_const', const=True)
    p.add_argument('--user-db-init-file', help='user_db db initialization file in \'user,pw\' format')
    p.add_argument('--email', help='email of user to operate on')
    p.add_argument('--role', help='role to add or remove to/from user, i.e. admin or user')
    p.add_argument('--first-name', help="first name for added user")
    p.add_argument('--last-name', help='last name for added user')
    p.add_argument('--username', help='username for added user')

    args, rest = p.parse_known_args()
    illegal = False
    if len(rest) != 1:
        print("only one non argument parameter expected")
        illegal = True
    elif rest[0] not in commands:
        print("command not in {}".format(commands))
        illegal = True
    elif rest[0] in ['role-add', 'role-rm'] and not args.email:
        print("command {} requires an email argument".format(command))
        illegal = True
    elif rest[0] == 'add' and None in set([args.first_name, args.last_name, args.username]):
        print("missing one of first-name, last-name or username for user addition")
        illegal = True
    if illegal:
        p.print_help()
        raise SystemExit

    command = rest[0]
    cfg = init_config(args.config_dir)
    user_db_path = args.user_db_path if args.user_db_path is not None else cfg.user_db_path

    if args.init_user_db:
        init_pw_db(cfg, args.user_db_init_file, user_db_path)
        exit(0)

    if command == 'role-add':
        role_add(user_db_path, args.email, args.role)

    elif command == 'role-rm':
        role_rm(user_db_path, args.email, args.role)

    elif command == 'list':
        list_users(user_db_path)

    elif command == 'add':
        print("please enter password:")
        password = getpass()
        add_user(user_db_path=user_db_path, cfg=cfg, email=args.email, password=password,
                 first=args.first_name, last=args.last_name, username=args.username)

if __name__ == '__main__':
    main()
