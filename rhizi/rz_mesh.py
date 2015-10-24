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


from collections import namedtuple
from flask import request
from functools import wraps
from geventwebsocket.handler import WebSocketHandler
import inspect
import logging
from socketio import socketio_manage
from socketio.server import SocketIOHandler
from socketio.server import SocketIOServer

from .model.graph import Topo_Diff
from .rz_api_rest import Req_Context
from .rz_api_websocket import WebSocket_Graph_NS
from .rz_req_handling import (make_response__http__empty,
    HTTP_STATUS__500_INTERNAL_SERVER_ERROR, make_response__json,
    sock_addr_from_env_HTTP_headers, sock_addr_from_REMOTE_X_keys)


log = logging.getLogger('rhizi')

class WS_Req_Env(object):

    def __init__(self):
        self.kernel = None

class RZ_WebSocket_Server(SocketIOServer):
    """
    Rhizi customized SocketIOServer:
        - allow response header injection on websocket connections
    """

    class Req_Probe__sock_addr__proxy(object):

        def probe_client_socket_addr__ws_conn(self, ws_environ):

            ret = sock_addr_from_REMOTE_X_keys(ws_environ)

            #
            # relying on the presence of the 'X-Forwarded-For' is preferable, but
            # a bit flaky as it is not always present - see #496
            #
            # TODO: evaluate proxy server's behavior on this
            #
            try:
                _, __ = sock_addr_from_env_HTTP_headers(ws_environ, key_name__addr='X-Forwarded-For')
            except Exception as e:
                log.warning('ws: client socket addr probe: %s, peer-addr ~: %s:%s' % (e.message, ret[0], ret[1]))

            return ret

    class Req_Probe__sock_addr__direct(object):

        def probe_client_socket_addr__ws_conn(self, ws_environ):
            return sock_addr_from_REMOTE_X_keys(ws_environ)

    class RZ_SocketIOHandler(SocketIOHandler):

        def __init__(self, config, *args, **kwargs):
            SocketIOHandler.__init__(self, config, *args, **kwargs)

        def start_response(self, status, headers, exc_info=None):
            # headers['Access-Control-Allow-Origin'] = '*'
            return SocketIOHandler.start_response(self, status, headers, exc_info)

        def handle_disconnect_request(self):
            SocketIOHandler.handle_disconnect_request(self)

    class RZ_WebSocketHandler(WebSocketHandler):

        def __init__(self, socket, address, server, rfile=None):
            WebSocketHandler.__init__(self, socket, address, server, rfile=rfile)

        def upgrade_connection(self):
            return WebSocketHandler.upgrade_connection(self)

        def upgrade_websocket(self):
            return WebSocketHandler.upgrade_websocket(self)

    def __init__ (self, rz_config, wsgi_app):
        self.wsgi_app = wsgi_app
        sock_addr = (rz_config.listen_address, rz_config.listen_port)
        SocketIOServer.__init__(self,
                                sock_addr,
                                wsgi_app,
                                close_timeout=60,
                                policy_server=False,
                                heartbeat_interval=20,  # should be less than the heartbeat_timeout
                                heartbeat_timeout=40,
                                handler_class=RZ_WebSocket_Server.RZ_SocketIOHandler,
                                resource='socket.io',  # URL prefix for socket.io requests
                                ws_handler_class=RZ_WebSocket_Server.RZ_WebSocketHandler)

        self.req_probe__sock_addr = None

def init_ws_interface(cfg, kernel, flask_webapp):
    """
    Initialize websocket interface:
       - apply websocket route handlers

    @return: an initialized RZ_WebSocket_Server object
    """

    def decorator__ws_multicast(ws_srv, f, f_multicast):
        """
        Emit multicast on topo_diff, attr_diff

        @param f: [!] wrapped function, name used to derive socket message name
        """

        def _prep_for_serialization(obj):
            # handle special serialization cases
            if isinstance(obj, Topo_Diff):
                return obj.to_json_dict()
            return obj

        @wraps(f)
        def wrapped_function(*args, **kw):

            f_ret = f(*args, **kw)
            assert type(f_ret) in [list, tuple]  # expect (X_Diff, X_Diff.Commit_Result_Type)

            #
            # Identify f caller
            #
            # TODO: avoid stack inspection if possible
            #
            try:
                stack = inspect.stack()
                stack_frame = stack[1][0]

                obj_instance = stack_frame.f_locals.get('self')
                if None != obj_instance:
                    # [!] no need emit broadcast if call originated from a websocket as
                    # WebSocket_Graph_NS#on_diff_commit__xxx emit their own self-excluding multicast
                    # we still asser call class == WebSocket_Graph_NS

                    caller_class = obj_instance.__class__
                    assert WebSocket_Graph_NS == caller_class, 'decorator__ws_multicast: unknown callpath: not from WebSocket_Graph_NS'

                    return f_ret

            except Exception as e:
                log.exception('decorator__ws_multicast: failed to detect REST/Websocket call via stack inspection')  # exception derived from stack
                return  # f caller unidentified, abort cast

            rzdoc = rzdoc_from_f_args_extractor(args)

            pkt_data = map(_prep_for_serialization, f_ret)

            msg_name = f.__name__
            pkt = dict(type="event",
                       name=msg_name,
                       args=pkt_data,
                       endpoint='/graph')

            ws_broadcast_to_rzdoc_readers(ws_srv, pkt, rzdoc)

            return f_ret

        return wrapped_function

    def rzdoc_from_f_args_extractor(f_args):  # extract rzdoc from req ctx
        if len(f_args) < 2 or not isinstance(f_args[1], Req_Context):
            return
        req_ctx = f_args[1]
        return req_ctx.rzdoc

    def socketio_route_handler(url_path):

        # FIXME: rm if unused
        if None == request.environ.get('socketio'):  # attempt ws upgrade process for non socketio clients
            header__upgrade = request.headers.get('Upgrade')
            if 'websocket' == header__upgrade:

                resp = make_response__http__empty(101)  # 'switching protocols' HTTP status code
                resp.headers['Upgrade'] = 'websocket'
                resp.headers['Connection'] = 'Upgrade'

                rmt_addr, rmt_port = request.req_probe__sock_addr.probe_client_socket_addr__ws_conn(request.environ)
                log.debug('ws: \'Upgrade: websocket\' header detected, serving \'101\': remote-socket-addr: %s:%s' % (rmt_addr, rmt_port))

                return resp
            else:
                raise Exception('ws: failed to obtain socketio object from WSGI environment')

        # init websocket-env
        ws_req_env = WS_Req_Env()
        ws_req_env.kernel = kernel
        ws_req_env.peer_sock_addr = ws_srv.req_probe__sock_addr.probe_client_socket_addr__ws_conn(request.environ)

        try:
            socketio_manage(request.environ, {'/graph': WebSocket_Graph_NS}, ws_req_env)  # connect socketio manager
        except:
            log.exception("ws: exception while handling connection", exc_info=True)
            return make_response__json(status=HTTP_STATUS__500_INTERNAL_SERVER_ERROR)

    def ws_broadcast_to_rzdoc_readers(ws_srv, pkt, rzdoc):
        """
        Cast update messege to subscribed readers
        """

        r_assoc_set = kernel.rzdoc__reader_set_from_rzdoc(rzdoc)

        log.debug('ws: rzdoc cast: msg: \'%s\': rzdoc: %s, cast-size ~= %d' % (pkt.get('name'),
                                                                                      rzdoc.name,
                                                                                      len(r_assoc_set)))
        for r_assoc in r_assoc_set:
            try:
                r_assoc.socket.send_packet(pkt)
            except Exception as e:
                r_assoc.err_count__IO += 1

    # connect socketio route
    route_dec = flask_webapp.route('/socket.io/<path:url_path>')
    f = route_dec(socketio_route_handler)
    flask_webapp.f = f

    # init ws server
    ws_srv = RZ_WebSocket_Server(cfg, flask_webapp)
    if cfg.reverse_proxy_host is not None:  # proxy mode
        ws_srv.req_probe__sock_addr = RZ_WebSocket_Server.Req_Probe__sock_addr__proxy()
    else:
        ws_srv.req_probe__sock_addr = RZ_WebSocket_Server.Req_Probe__sock_addr__direct()

    kernel.diff_commit__topo = decorator__ws_multicast(ws_srv,
                                                       kernel.diff_commit__topo,
                                                       f_multicast=WebSocket_Graph_NS.on_diff_commit__topo)
    kernel.diff_commit__attr = decorator__ws_multicast(ws_srv,
                                                       kernel.diff_commit__attr,
                                                       f_multicast=WebSocket_Graph_NS.on_diff_commit__attr)

    return ws_srv;
