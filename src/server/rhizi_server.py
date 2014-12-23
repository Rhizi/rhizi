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
import re

from flask import Flask
from flask import session
from flask import redirect
from flask import request
from flask import send_from_directory

from functools import wraps

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

        # validate config
        if False == os.path.isabs(ret.root_path):
            ret.root_path = os.path.abspath(ret.root_path)

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

class FlaskExt(Flask):
    """
    Flask server customization
    """

    def __init__(self, import_name, *args, **kwargs):
        """
        reserved for future use
        """
        super(FlaskExt, self).__init__(import_name, *args, **kwargs)

    def before_request(self, *args, **kwargs):
        # TODO impl
        pass

    def make_default_options_response(self):
        ret = Flask.make_default_options_response(self)

        ret.headers['Access-Control-Allow-Origin'] = 'http://rhizi.net'
        ret.headers['Access-Control-Allow-Headers'] = "Accept, Authorization, Content-Type, Origin"
        ret.headers['Access-Control-Allow-Credentials'] = 'true'

        # ret.headers['Access-Control-Allow-Methods'] = ', '.join(m_list)
        return ret

def init_log(cfg):
    """
    init log file, location derived from configuration
    """
    log = logging.getLogger('rhizi')
    log.setLevel(logging.DEBUG)
    log_handler_c = logging.StreamHandler()
    log_handler_f = logging.FileHandler(cfg.log_path)

    log.addHandler(log_handler_c)
    log.addHandler(log_handler_f)
    return log

def init_rest_api(cfg, flask_webapp):
    """
    map REST API calls
    """

    def rest_entry(path, f, flask_args={'methods': ['POST']}):
        return (path, f, flask_args)

    def dev_mode__resend_from_static(static_url):
        """
        redirect static links while in dev mode:
           - /res/<path> -> <path>
        """
        static_folder = flask.current_app.static_folder

        new_req_path = None
        if request.path.startswith('/res/'):
            # turn absolute/res/... URLs to static-folder relative
            new_req_path = request.path.replace('/res/', '')
        return send_from_directory(static_folder, new_req_path)

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
                      rest_entry('/graph/diff-commit-set', rhizi_api.diff_commit__set),
                      rest_entry('/graph/diff-commit-topo', rhizi_api.diff_commit__topo),
                      rest_entry('/graph/diff-commit-attr', rhizi_api.diff_commit__attr),
                      rest_entry('/graph/diff-commit-vis', rhizi_api.diff_commit__vis),
                      rest_entry('/index', rhizi_api.index, {'methods': ['GET']}),
                      rest_entry('/load/node-set-by-id', rhizi_api.load_node_set_by_id_attr),
                      rest_entry('/load/link-set/by_link_ptr_set', rhizi_api.load_link_set_by_link_ptr_set),
                      rest_entry('/login', rhizi_api.login, {'methods': ['GET', 'POST']}),
                      rest_entry('/logout', rhizi_api.logout, {'methods': ['GET', 'POST']}),
                      rest_entry('/match/node-set', rhizi_api.match_node_set_by_attr_filter_map),
                      rest_entry('/monitor/server-info', rhizi_api.monitor__server_info),
                  ]

    if cfg.development_mode:
        dev_path_set = ['/static', '/res']
        rest_dev_entry_set = []
        for dev_path in dev_path_set:
            rest_dev_entry_set.append(rest_entry(dev_path + '/<path:static_url>',
                                                 dev_mode__resend_from_static,
                                                 {'methods': ['GET']}))
        rest_entry_set += rest_dev_entry_set

    if False == cfg.access_control:
        log.warn('access control disabled, public access set on all URLs')

    for re_entry in rest_entry_set:
        rest_path, f, flask_args = re_entry

        if cfg.access_control and '/login' != rest_path:
            # currently require login on all but /login paths
            f = login_decorator(f)

        # [!] order seems important - apply route decorator last
        route_dec = flask_webapp.route(rest_path, **flask_args)
        f = route_dec(f)

        flask_webapp.f = f  # assign decorated function

def init_webapp(cfg):
    root_path = cfg.root_path
    webapp = FlaskExt(__name__,
                      static_folder='static',
                      template_folder=os.path.join(root_path, 'templates'),
                      static_url_path=cfg.static_url_path)
    webapp.config.from_object(cfg)
    webapp.root_path = root_path  # for some reason calling config.from_xxx() does not have effect

    db_ctl = dbc.DB_Controller(cfg)
    rhizi_api.db_ctl = db_ctl

    webapp.rz_config = cfg
    return webapp

def init_config(cfg_dir):
    cfg_path = os.path.join(cfg_dir, 'rhizi-server.conf')
    cfg = Config.init_from_file(cfg_path)
    return cfg

def test(cfg_dir):
    cfg = init_config(cfg_dir)
    init_webapp(cfg)
    return rhizi_api.db_ctl

if __name__ == "__main__":

    p = argparse.ArgumentParser(description='rhizi-server')
    p.add_argument('--config-dir', help='path to Rhizi config dir', default='res/etc')
    p.add_argument('--init-htpasswd-db', help='init login htpasswd db', action='store_const', const=True)
    args = p.parse_args()

    cfg = init_config(args.config_dir)
    log = init_log(cfg)
    log.debug('loaded configuration:\n%s' % cfg)

    if args.init_htpasswd_db:
        init_pw_db(cfg)
        exit(0)

    webapp = init_webapp(cfg)
    init_rest_api(cfg, webapp)

    log.info('launching webapp via Flask development server')
    webapp.run(host=cfg.listen_address,
               port=cfg.listen_port)

