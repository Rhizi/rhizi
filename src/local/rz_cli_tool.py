import argparse
import os
import pickle
import re

import crypt_util
from rz_server import init_config


def init_pw_db(cfg, user_pw_list_file):

    def add_user_login(htpasswd_path, salt, u, p):
        with open(htpasswd_path, 'rb') as f:
            data = f.read()
            pw_db = pickle.loads(data)

        with open(htpasswd_path, 'wb') as f:
            pw_db[u] = hash_pw(str(p), salt)
            pickle.dump(pw_db, f)

        log.info('htpasswd db: added entry: user: %s, pw: %s...' % (u, pw_db[u][:5]))

    htpasswd_path = cfg.htpasswd_path

    if os.path.exists(htpasswd_path):
        print('htpasswd_path already exists, aborting: ' + htpasswd_path)
        return

    with open(htpasswd_path, 'wb') as f:  # init file
        pickle.dump({}, f)

    salt = cfg.secret_key
    assert len(salt) > 8, 'server-key not found or too short'
    print('using config secret_key for salt generation: ' + salt[:3] + '...')

    u_count = 0
    with open(user_pw_list_file, 'r') as f:
        for line in f:
            if re.match('(^#)|(\s+$)', line):
                continue

            kv_arr = line.split(',')
            if 2 != len(kv_arr):
                raise Exception('failed to parse user,pw line: ' + line)

            user, pw = map(str.strip, kv_arr)
            add_user_login(htpasswd_path, salt, user, pw)
            print('added user: u: ' + user)
            u_count = u_count + 1
    print('htpasswd generated: path: %s, user-count: %d' % (htpasswd_path, u_count))

def main():
    p = argparse.ArgumentParser(description='rz-cli tool')
    p.add_argument('--config-dir', help='path to Rhizi config dir', default='res/etc')
    p.add_argument('--init-htpasswd-db', help='init login htpasswd db', action='store_const', const=True)
    p.add_argument('--htpasswd-init-file', help='htpasswd db initialization file in \'user,pw\' format')

    args = p.parse_args()
    cfg = init_config(args.config_dir)

    if args.init_htpasswd_db:
        init_pw_db(cfg, args.htpasswd_init_file)
        exit(0)

if __name__ == '__main__':
    main()
