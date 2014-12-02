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
    """

    @staticmethod
    def init_from_file(file_path):
        ret = Config()

        if False == os.path.exists(file_path):
            raise Exception('config file not found: ' + file_path)

        with open(file_path, 'r') as f:
            cfg = json.loads(f.read())

            #
            # TODO: config option documentation
            #
            # htpasswd_path
            # listen_address
            # listen_port
            # neo4j_url
            # root_path

            for k, v in cfg.items():
                ret.__setattr__(k, v)

        ret.__setattr__('config_dir', os.path.dirname(file_path))  # bypass prop restriction
        return ret

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
    log_handler_f = logging.FileHandler('/tmp/rhizi-server.log')

    log.addHandler(log_handler_c)
    log.addHandler(log_handler_f)
    return log

def init_rest_api(flask_webapp):
    """
    map REST API calls
    """

    def rest_entry(path, f, flask_args={}):
        return (path, f, flask_args)

    def login_decorator(f):
        """
        check user is logged in before executing REST api call
        """
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
                      rest_entry('/index', rhizi_api.index),
                      rest_entry('/load/node-set-by-id', rhizi_api.load_node_set_by_id_attr),
                      rest_entry('/load/link-set/by_link_ptr_set', rhizi_api.load_link_set_by_link_ptr_set),
                      rest_entry('/login', rhizi_api.login, {'methods': ['GET', 'POST']}),
                      rest_entry('/logout', rhizi_api.logout),
                      rest_entry('/match/node-set', rhizi_api.match_node_set_by_attr_filter_map),
                      rest_entry('/monitor/server-info', rhizi_api.monitor__server_info),
                  ]

    for re in rest_entry_set:
        rest_path, f, flask_args = re
        route_decorator = flask_webapp.route(rest_path, **flask_args)
        flask_webapp.f = route_decorator(f)

        if '/login' != rest_path:
            # currently require login on all but /login paths
            flask_webapp.f = login_decorator(f)

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

