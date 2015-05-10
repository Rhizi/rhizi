#!/usr/bin/python2.7

import argparse
from flask import Flask
from flask import redirect
from flask import request
from flask import session
from functools import wraps
import logging
import os
import signal
import traceback


from db_controller import DB_Controller
from db_op import DBO_rzdb__init_DB
import rz_api
import rz_api_rest
import rz_blob
from rz_config import RZ_Config
import rz_feedback
from rz_kernel import RZ_Kernel
from rz_mesh import init_ws_interface
from rz_req_handling import make_response__http__empty, \
    sock_addr_from_env_HTTP_headers, sock_addr_from_REMOTE_X_keys
import rz_server_ctrl
import rz_user
from rz_user_db import User_DB, Fake_User_DB


class FlaskExt(Flask):
    """
    Flask server customization
    """

    class Req_Probe__sock_addr__proxy(object):

        def __init__(self, proxy_host, proxy_port):
            self.proxy_host = proxy_host
            self.proxy_port = proxy_port

        def probe_client_socket_addr__http_req(self, req):

            ret = sock_addr_from_REMOTE_X_keys(req.environ)

            #
            # relying on the presence of the 'X-Forwarded-For' is preferable, but
            # a bit flaky as it is not always present - see #496
            #
            # TODO: evaluate proxy server's behavior on this
            #
            try:
                _, __ = sock_addr_from_env_HTTP_headers(req.environ, key_name__addr='X-Forwarded-For')
            except Exception as e:
                log.warning('flask: client socket addr probe: %s, peer-addr ~: %s:%s' % (e.message, ret[0], ret[1]))

            return ret

        def probe_requested_host__http_req(self, req, probe_for_proxy=True):

            ret = self.proxy_host, self.proxy_port

            #
            # relying on the presence of the 'X-Forwarded-Host' is preferable, but
            # a bit flaky as it is not always present - see #496
            #
            # TODO: evaluate proxy server's behavior on this
            #
            try:
                _, __ = sock_addr_from_env_HTTP_headers(req.environ, key_name__addr='X-Forwarded-Host')
            except Exception as e:
                log.warning('flask: client socket addr probe: %s, replacing with: \'%s:%s\'' % (e.message, ret[0], ret[1]))

            return ret

    class Req_Probe__sock_addr__direct(object):

        def __init__(self, dafault_port):
            self.dafault_port = dafault_port

        def probe_client_socket_addr__http_req(self, req):
            return sock_addr_from_REMOTE_X_keys(req.environ)

        def probe_requested_host__http_req(self, req, probe_for_proxy=True):
            req_host__addr, _ = sock_addr_from_env_HTTP_headers(req.environ, key_name__addr='Host')
            req_host__port = self.dafault_port
            return req_host__addr, req_host__port

    def __init__(self, import_name, *args, **kwargs):
        """
        reserved for future use
        """
        super(FlaskExt, self).__init__(import_name, *args, **kwargs)
        self.rz_config = None
        self.req_probe__sock_addr = None

        # register before_request functions
        self.before_request(lambda: self.__pre_req__inject_peer_sock_addr())

    def __pre_req__inject_peer_sock_addr(self):
        request.peer_sock_addr = self.req_probe__sock_addr.probe_client_socket_addr__http_req(request)
        request.host_sock_addr = self.req_probe__sock_addr.probe_requested_host__http_req(request)

    def gen_op__rzdb__init_DB(self):  # provided to assist kernel with DB initialization
        return DBO_rzdb__init_DB(self.rz_config.rzdoc__mainpage_name)

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

    log_level = logging._levelNames.get(cfg.log_level.upper())
    assert None != log_level, 'failed to determine log level'

    log.setLevel(log_level)
    log_handler_c = logging.StreamHandler()
    log_handler_f = logging.FileHandler(cfg.log_path)

    formatter = logging.Formatter(u'%(asctime)s [%(levelname)s] %(name)s %(message)s')
    log_handler_c.setFormatter(formatter)
    log_handler_f.setFormatter(formatter)

    log.addHandler(log_handler_c)
    log.addHandler(log_handler_f)
    return log

def init_rest_interface(cfg, flask_webapp):
    """
    Initialize REST interface
    """

    def rest_entry(path, f, flask_args={'methods': ['POST']}):
        return (path, f, flask_args)

    def redirect_entry(path, path_to, flask_args):
        def redirector():
            return redirect(path_to, code=302)
        redirector.func_name = 'redirector_%s' % path.replace('/', '_')
        return (path, redirector, flask_args)

    def login_decorator(f):
        """
        security boundary: assert logged-in user before executing REST api call
        """
        @wraps(f)
        def wrapped_function(*args, **kw):
            if None == session.get('username'):
                return redirect('/login')
            return f(*args, **kw)

        return wrapped_function


    def localhost_access_decorator__ipv4(f):
        """
        security boundary: assert request originated from localhost 

        @bug: consider broken until #496 is resolved - in the meantime use AC in proxy
        """

        @wraps(f)
        def wrapped_function(*args, **kw):

            rmt_addr, _ = request.peer_sock_addr
            if '127.0.0.1' != rmt_addr:
                log.warning('unauthorized attempt to access localhost restricted path: %s' % (request.path))
                return make_response__http__empty(stauts=403)

            return f(*args, **kw)

        return wrapped_function

    rest_entry_set = [
                      # REST endpoints
                      rest_entry('/feedback', rz_feedback.rest__send_user_feedback__email),
                      rest_entry('/graph/diff-commit-set', rz_api_rest.diff_commit__set),
                      rest_entry('/graph/diff-commit-topo', rz_api_rest.diff_commit__topo),
                      rest_entry('/graph/diff-commit-attr', rz_api_rest.diff_commit__attr),
                      rest_entry('/graph/diff-commit-vis', rz_api_rest.diff_commit__vis),
                      rest_entry('/index', rz_api.index, {'methods': ['GET']}),
                      rest_entry('/load/node-set-by-id', rz_api_rest.load_node_set_by_id_attr),
                      rest_entry('/load/link-set/by_link_ptr_set', rz_api_rest.load_link_set_by_link_ptr_set),
                      rest_entry('/login', rz_user.rest__login, {'methods': ['GET', 'POST']}),
                      rest_entry('/logout', rz_user.rest__logout, {'methods': ['GET', 'POST']}),
                      rest_entry('/match/node-set', rz_api_rest.match_node_set_by_attr_filter_map),
                      rest_entry('/pw-reset', rz_user.rest__pw_reset, {'methods': ['GET', 'POST']}),

                      # doc endpoints
                      rest_entry('/rz/<path:rzdoc_name>', rz_api_rest.rzdoc__via_rz_url, {'methods': ['GET']}),  # pretty URLs
                      rest_entry('/api/rzdoc/clone', rz_api_rest.rzdoc_clone),
                      rest_entry('/api/rzdoc/list', rz_api_rest.rzdoc__list),
                      rest_entry('/api/rzdoc/<path:rzdoc_name>/create', rz_api_rest.rzdoc__create),
                      rest_entry('/api/rzdoc/<path:rzdoc_name>/delete', rz_api_rest.rzdoc__delete, {'methods': ['GET', 'DELETE']}),  # TODO: rm 'GET' once we have UI deletion support - see #436

                      # upload endpoints - this might change to external later, keep minimal and separate
                      rest_entry('/blob/upload', rz_blob.upload, {'methods': ['POST']}),
                      # [!] this is for development only. served from frontend web server in production
                      rest_entry('/blob/uploads/<path:path>', rz_blob.retreive, {'methods': ['GET', 'DELETE']}),

                      # server administration: access restricted to localhost
                      rest_entry('/monitor/server-info', rz_server_ctrl.monitor__server_info, {'methods': ['GET']}),
                      rest_entry('/monitor/user/list', rz_server_ctrl.rest__list_users, {'methods': ['GET']}),

                      # redirects
                      redirect_entry('/', '/index', {'methods': ['GET']}),
                      redirect_entry('/index.html', '/index', {'methods': ['GET']}),

                  ]
    if cfg.signup_enabled:
        rest_entry_set.append(rest_entry('/signup', rz_user.rest__user_signup, {'methods': ['GET', 'POST']}))

    # FIXME: but should be rate limited (everything should be, regardless of login)
    no_login_paths = ['/feedback', '/login', '/pw-reset', '/signup']

    for re_entry in rest_entry_set:
        rest_path, f, flask_args = re_entry

        if cfg.access_control and rest_path not in no_login_paths:
            # currently require login on all but /login paths
            f = login_decorator(f)

        # apply local host access restriction
        if rest_path.startswith('/monitor'):
            f = localhost_access_decorator__ipv4(f)

        # [!] order seems important - apply route decorator last
        route_dec = flask_webapp.route(rest_path, **flask_args)
        f = route_dec(f)

        flask_webapp.f = f  # assign decorated function

def init_webapp(cfg, kernel):
    """
    Initialize webapp:
       - call init_rest_interface()
    """
    global webapp

    root_path = cfg.root_path
    assert os.path.exists(root_path), "root path doesn't exist: %s" % root_path

    #
    # init webapp
    #

    # due to magic in os.path.join: os.path.join('/a', '/b') -> '/b',
    # we pass a non-absolute template_d path, even though it is configured as such
    template_d_relpath = cfg.template_d_path
    if template_d_relpath.startswith('/'): template_d_relpath = template_d_relpath[1:]

    webapp = FlaskExt(__name__,
                      static_folder='static',
                      static_url_path=cfg.static_url_path,
                      template_folder=template_d_relpath)

    webapp.config.from_object(cfg)
    webapp.root_path = root_path  # for some reason calling config.from_xxx() does not have effect
    webapp.rz_config = cfg
    webapp.kernel = kernel
    if cfg.reverse_proxy_host is not None:  # proxy mode
        webapp.req_probe__sock_addr = FlaskExt.Req_Probe__sock_addr__proxy(cfg.reverse_proxy_host,
                                                                           cfg.reverse_proxy_port)
    else:
        webapp.req_probe__sock_addr = FlaskExt.Req_Probe__sock_addr__direct(cfg.listen_port)

    init_rest_interface(cfg, webapp)
    return webapp

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
    webapp.kernel.shutdown()

if __name__ == "__main__":

    global log

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
        log.error('failed to initialize server: ' + e.message)
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
    kernel.op_factory__DBO_rzdb__init_DB = webapp  # assist kernel with DB initialization
    ws_srv = init_ws_interface(cfg, kernel, webapp)

    try:
        kernel.start()
        ws_srv.serve_forever()
    except Exception as e:
        log.exception(e)

    shutdown()
