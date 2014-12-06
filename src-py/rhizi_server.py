#!/usr/bin/python

import logging
import json
import util
import os
import neo4j_util
import argparse
import db_controller as dbc
import rhizi_api
import flask
import crypt_util

from flask import session
from flask import redirect
from flask import url_for

class Config(object):
    """
    rhizi-server configuration

    TODO: config option documentation
    
        htpasswd_path
        listen_address
        listen_port
        neo4j_url
        root_path
    """

    @staticmethod
    def init_from_file(file_path):

        if False == os.path.exists(file_path):
            raise Exception('config file not found: ' + file_path)

        # apply defaults
        cfg = {}
        cfg['access_control'] = True
        cfg['config_dir'] = os.path.abspath(os.path.dirname(file_path))  # bypass prop restriction
        cfg['development_mode'] = False
        cfg['listen_address'] = '127.0.0.1'
        cfg['listen_port'] = 8080
        cfg['root_path'] = os.getcwd()
        cfg['static_url_path'] = '/static'

        # Flask keys
        cfg['SECRET_KEY'] = ''

        with open(file_path, 'r') as f:
            for line in f:
                if re.match('(^#)|(\s+$)', line):
                    continue

                kv_arr = line.split('=')
                if 2 != len(kv_arr):
                    raise Exception('failed to parse config line: ' + line)

                k, v = map(str.strip, kv_arr)

                if None != cfg.get(k):
                    # apply type conversion based on default value type
                    type_f = type(cfg[k])
                    if bool == type_f:
                        v = v in ("True", "true")  # workaround bool('false') = True
                    else:
                        v = type_f(v)

                # [!] we can't use k.lower() as we are loading Flask configuration
                # keys which are expected to be capitalized
                cfg[k] = v

        ret = Config()
        ret.__dict__ = cfg  # allows setting of @property attributes
        return ret

    def __str__(self):
        return '\n'.join('%s: %s' % (k, v) for k, v in self.__dict__.items())

    @property
    def db_base_url(self):
        return self.neo4j_url

    @property
    def tx_api_path(self):
        return '/db/data/transaction'

    @property
    def config_dir_path(self):
        return self.config_dir

    @property
    def secret_key(self):
        return self.SECRET_KEY

class RhiziServer(object):
    pass

def init_logging():

    log = logging.getLogger('rhizi')
    log.setLevel(logging.DEBUG)
    log_handler_c = logging.StreamHandler()
    log_handler_f = logging.FileHandler('/var/log/rhizi/rhizi-server.log')

    log.addHandler(log_handler_c)
    log.addHandler(log_handler_f)
    return log

def init_rest_api(flask_webapp):
    """
    map REST API calls
    """

    def rest_entry(path, f, flask_args={'methods': ['POST']}):
        return (path, f, flask_args)

    def login_decorator(f):
        """
        [!] security boundary: asserd logged-in user before executing REST api call
        """
        @wraps(f)
        def wrapped_function(*args, **kw):
            if not 'username' in session:
                return redirect('/login')
            return f(*args, **kw)

        return wrapped_function

    rest_entry_set = [
                      rest_entry('/add/node-set' , rhizi_api.add_node_set),
                      rest_entry('/graph/clone', rhizi_api.rz_clone),
                      rest_entry('/graph/diff-commit-set', rhizi_api.diff_commit_set),
                      rest_entry('/graph/diff-commit-topo', rhizi_api.diff_commit_topo),
                      rest_entry('/graph/diff-commit-attr', rhizi_api.diff_commit_attr),
                      rest_entry('/graph/diff-commit-vis', rhizi_api.diff_commit_vis),
                      rest_entry('/index', rhizi_api.index, {'methods': ['GET']}),
                      rest_entry('/load/node-set-by-id', rhizi_api.load_node_set_by_id_attr),
                      rest_entry('/load/link-set/by_link_ptr_set', rhizi_api.load_link_set_by_link_ptr_set),
                      rest_entry('/login', rhizi_api.login, {'methods': ['GET', 'POST']}),
                      rest_entry('/logout', rhizi_api.logout, {'methods': ['GET', 'POST']}),
                      rest_entry('/match/node-set', rhizi_api.match_node_set_by_attr_filter_map),
                      rest_entry('/monitor/server-info', rhizi_api.monitor__server_info),
                  ]

    for re_entry in rest_entry_set:
        rest_path, f, flask_args = re_entry

        if '/login' != rest_path:
            # currently require login on all but /login paths
            f = login_decorator(f)

        # [!] order seems important - apply route decorator last
        route_dec = flask_webapp.route(rest_path, **flask_args)
        f = route_dec(f)

        flask_webapp.f = f  # assign decorated function

def init_webapp(cfg):
    root_path = cfg.root_path
    webapp = rhizi_api.FlaskExt(__name__,
                                static_folder='static',
                                template_folder=os.path.join(root_path, 'templates'),
                                static_url_path='')
    webapp.config.from_object(cfg)
    webapp.root_path = root_path  # for some reason calling config.from_pyfile()

    db_ctl = dbc.DB_Controller(cfg)
    rhizi_api.db_ctl = db_ctl

    webapp.rz_config = cfg
    return webapp

def init_config(cfg_dir):
    cfg_path = os.path.join(cfg_dir, 'rhizi-server.conf')
    cfg = Config.init_from_file(cfg_path)
    return cfg


if __name__ == "__main__":

    p = argparse.ArgumentParser(description='rhizi-server')
    p.add_argument('--config-dir', help='path to Rhizi config dir', default='res/etc')
    p.add_argument('--init-htpasswd-db', help='init login htpasswd db', action='store_const', const=True)
    args = p.parse_args()

    log = init_logging()
    cfg = init_config(args.config_dir)


    webapp = init_webapp(cfg)
    init_rest_api(webapp)

    log.info('launching webapp via Flusk development server')
    webapp.run(host=cfg.listen_address,
               port=cfg.listen_port)

