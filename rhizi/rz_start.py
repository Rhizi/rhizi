#!/usr/bin/python2.7

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
from flask import Flask
from flask import redirect
from flask import request
from flask import session
from functools import wraps
import logging
import os
import sys
import signal
import traceback


# Hack to create modules for usage by old user_db shelve
from .rz_user import User_Account
from . import rz_user_db
from . import rz_user

# Support for old (<0.3.0 debian package) shelve files
sys.modules['rz_user_db'] = rz_user_db
sys.modules['rz_user'] = rz_user
rz_user_db.User_Account = User_Account


from .db_controller import DB_Controller
from .db_op import DBO_rzdb__init_DB
from . import rz_api
from . import rz_api_rest
from . import rz_blob
from .rz_config import RZ_Config
from . import rz_feedback
from .rz_kernel import RZ_Kernel
from .rz_server import  init_webapp
from .rz_mesh import init_ws_interface
from .rz_req_handling import make_response__http__empty, \
    sock_addr_from_env_HTTP_headers, sock_addr_from_REMOTE_X_keys
from . import rz_server_ctrl
from . import rz_user
from .rz_user_db import User_DB, Fake_User_DB


webapp = None


def init_log(cfg):
    """
    init log file, location derived from configuration
    """
    log = logging.getLogger('rhizi')

    log_level = logging.getLevelName(cfg.log_level.upper())
    assert None != log_level, 'failed to determine log level'

    log.setLevel(log_level)
    handlers = [logging.FileHandler(cfg.log_path),
                logging.StreamHandler()]

    formatter = logging.Formatter(u'%(asctime)s [%(levelname)s] %(name)s %(message)s')
    for handler in handlers:
        handler.setFormatter(formatter)
        log.addHandler(handler)
    return log


def init_config(cfg_dir):
    cfg_path = os.path.join(cfg_dir, 'rhizi-server.conf')
    cfg = RZ_Config.init_from_file(cfg_path)
    return cfg


def init_user_db(cfg):
    global user_db

    if not cfg.access_control:
        user_db = Fake_User_DB()
        return user_db

    try:
        if os.path.exists(cfg.user_db_path):
            mode = 'w'  # anydbm doc: open existing database for reading and writing
            log.info('user DB located, path: %s' % (cfg.user_db_path))
        else:
            mode = 'n'  # anydbm doc: create a new, empty database, open for reading and writing
            log.info('user DB missing, generating one: path: %s' % (cfg.user_db_path))

        user_db = User_DB(db_path=cfg.user_db_path)
        user_db.init(mode=mode)
    except Exception as e:
        log.exception('failed to init user_db, configured user_db path: %s' % (cfg.user_db_path))
        raise e

    log.info('user DB initialized: path: %s, user-count: %s' % (cfg.user_db_path, user_db.user_count()))
    return user_db


def init_signal_handlers():

    def signal_handler__exit(signum, frame):
        log.info('received exit signal: SIGINT/SIGTERM')
        shutdown()
        exit(0)

    signal.signal(signal.SIGINT, signal_handler__exit)
    signal.signal(signal.SIGTERM, signal_handler__exit)


def shutdown():
    log.info('rz_server: shutting down')
    user_db.shutdown()
    if webapp is not None:
        webapp.kernel.shutdown()


def main():

    global log
    global webapp

    try:  # enable pydev remote debugging
        import pydevd
        pydevd.settrace()
    except ImportError:
        pass

    p = argparse.ArgumentParser(description='rhizi-server')
    p.add_argument('--config-dir', help='path to Rhizi config dir', default='res/etc')
    args = p.parse_args()

    log = logging.getLogger('rhizi')  # init config-unaware log, used until we call init_log

    try:
        cfg = init_config(args.config_dir)
        log = init_log(cfg)
    except Exception as e:
        log.error('failed to initialize server: {}'.format(e.args))
        traceback.print_exc()
        exit(-1)

    try:
        cfg_indent_str = '   ' + str(cfg).replace('\n', '\n   ')
        log.info('loaded configuration:\n%s' % cfg_indent_str)  # print indented
        if False == cfg.access_control:
            log.warn('[!] access control disabled, all-granted access set on all URLs')

        init_signal_handlers()
        init_user_db(cfg)
    except Exception as e:
        log.exception('failed to initialize server')
        traceback.print_exc()
        exit(-1)

    #
    # init kernel
    #
    kernel = RZ_Kernel()
    kernel.db_ctl = DB_Controller(cfg.db_base_url)

    #
    # init webapp
    #
    webapp = init_webapp(cfg, kernel)
    webapp.user_db = user_db
    kernel.db_op_factory = webapp  # assist kernel with DB initialization
    ws_srv = init_ws_interface(cfg, kernel, webapp)

    try:
        kernel.start()
        ws_srv.serve_forever()
    except Exception as e:
        log.exception(e)

    shutdown()


if __name__ == "__main__":
    main()
