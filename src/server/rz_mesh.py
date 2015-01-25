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


log = logging.getLogger('rhizi')

class RZ_WebSocket_Server(SocketIOServer):
    """
    Rhizi customized SocketIOServer:
        - allow response header injection on websocket connections
    """

    class WebSocketHandlerExt(SocketIOHandler):

        def start_response(self, status, headers, exc_info=None):
            headers['Access-Control-Allow-Origin'] = '*'
            return WebSocketHandler.start_response(self, status, headers, exc_info)

        def handle_one_response(self):
            return WebSocketHandler.handle_one_response(self)

        def upgrade_websocket(self):
            return WebSocketHandler.upgrade_websocket(self)

    def __init__ (self, cfg, wsgi_app):
        self.wsgi_app = wsgi_app
        # Thread.__init__(self)
        SocketIOServer.__init__(self,
                                (cfg.listen_address, cfg.listen_port),
                                wsgi_app,
                                resource='socket.io',
                                policy_server=False)

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
        return Response()

    def ws_broadcast_to_all(pkt):
        for sessid, socket in ws_srv.sockets.iteritems():
            socket.send_packet(pkt)

    # link ws hooks: multicast on topo_diff, attr_diff
    def decorator__ws_multicast(ws_srv, f, f_multicast):
        """
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

            try:
                # TODO: avoid stack inspection if possible
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
                log.exception('decorator__ws_multicast: failed to differentiate REST vs Websocket call path based on stack state', e)

            assert type(f_ret) in [list, tuple]

            pkt_data = map(_prep_for_serialization, f_ret)

            msg_name = f.__name__
            pkt = dict(type="event",
                       name=msg_name,
                       args=pkt_data,
                       endpoint='/graph')

            ws_srv.log_multicast(msg_name)

            ws_broadcast_to_all(pkt)

            return f_ret

        return wrapped_function

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
