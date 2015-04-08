from collections import namedtuple
from flask import Response
from flask import request
from functools import wraps
from geventwebsocket.handler import WebSocketHandler
import inspect
import logging
from socketio import socketio_manage
from socketio.server import SocketIOHandler
from socketio.server import SocketIOServer

from model.graph import Attr_Diff, Topo_Diff
from rz_api_websocket import WebSocket_Graph_NS
from rz_kernel import RZ_Kernel
from rz_req_handling import make_response__http__empty


log = logging.getLogger('rhizi')

class RZ_WebSocket_Server(SocketIOServer):
    """
    Rhizi customized SocketIOServer:
        - allow response header injection on websocket connections
    """

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

    def __init__ (self, cfg, wsgi_app):
        self.wsgi_app = wsgi_app
        SocketIOServer.__init__(self,
                                (cfg.listen_address, cfg.listen_port),
                                wsgi_app,
                                resource='socket.io',  # URL prefix for socket.io requests
                                policy_server=False,
                                handler_class=RZ_WebSocket_Server.RZ_SocketIOHandler,
                                ws_handler_class=RZ_WebSocket_Server.RZ_WebSocketHandler)

    def log_multicast(self, msg_name):
        multicast_size = len(self.sockets) - 1  # subtract self socket
        log.info('ws: multicast: msg: \'%s\', cast-size ~= %d' % (msg_name, multicast_size))  # ~=: as race conditions apply

def init_ws_interface(cfg, kernel, flask_webapp):
    """
    Initialize websocket interface:
       - apply websocket route handlers
    
    @return: an initialized RZ_WebSocket_Server object
    """

    # init websocket-env
    ws_env = namedtuple('RZ_websocket_env', ['kernel'])
    ws_env.kernel = kernel

    def socketio_route_handler(url_path):
        try:
            if None == request.environ.get('socketio'):
                # avoid python-socketio's direct access to environ['socketio']
                raise Exception('failed to obtain socketio object from WSGI environment')

            # connect socketio manager
            socketio_manage(request.environ, {'/graph': WebSocket_Graph_NS}, ws_env)
        except:
            flask_webapp.logger.error("Exception while handling socketio connection", exc_info=True)
        return make_response__http__empty(101)  # 'switching protocols' HTTP status code

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

            rzdoc = rzdoc_from_f_args_extractor(args)

            pkt_data = map(_prep_for_serialization, f_ret)

            msg_name = f.__name__
            pkt = dict(type="event",
                       name=msg_name,
                       args=pkt_data,
                       endpoint='/graph')

            ws_srv.log_multicast(msg_name)

            ws_broadcast_to_rzdoc_readers(ws_srv, pkt, rzdoc)

            return f_ret

        return wrapped_function

    def rzdoc_from_f_args_extractor(f_args):  # extract rzdoc from req ctx
        if len(f_args) < 2 or not isinstance(f_args[1], Req_Context):
            return
        req_ctx = f_args[1]
        return req_ctx.rzdoc

    def ws_broadcast_to_rzdoc_readers(ws_srv, pkt, rzdoc):
        """
        Cast update messege to subscribed readers
        """

        cast_set = []
        rzdoc_r_set = kernel.rzdoc__reader_set_from_rzdoc(rzdoc)
        for r_assoc in rzdoc_r_set:
            cast_set.append(r_assoc)

        log.debug('reader diff cast: rzdoc: %s, cast size: %d' % (rzdoc.name, len(cast_set)))
        for r_assoc in cast_set:
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

    kernel.diff_commit__topo = decorator__ws_multicast(ws_srv,
                                                       kernel.diff_commit__topo,
                                                       f_multicast=WebSocket_Graph_NS.on_diff_commit__topo)
    kernel.diff_commit__attr = decorator__ws_multicast(ws_srv,
                                                       kernel.diff_commit__attr,
                                                       f_multicast=WebSocket_Graph_NS.on_diff_commit__attr)

    return ws_srv;
