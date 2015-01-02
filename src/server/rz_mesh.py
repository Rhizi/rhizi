import logging

from flask import request
from flask import Response

from socketio.server import SocketIOHandler
from socketio import socketio_manage
from socketio.namespace import BaseNamespace

from socketio.mixins import BroadcastMixin
from socketio.server import SocketIOServer

from geventwebsocket.handler import WebSocketHandler

log = logging.getLogger('rhizi')

class WebSocket_Graph_NS(BaseNamespace, BroadcastMixin):
    """
    Rhizi '/graph' websocket namespace
    """
    def multicast_msg(self, msg_name, *args):
        self.socket.server.log_multicast(msg_name)
        super(WebSocket_Graph_NS, self).broadcast_event_not_me(msg_name, *args)

    def _log_conn(self, prefix_msg):
        rmt_addr = self.environ['REMOTE_ADDR']
        rmt_port = self.environ['REMOTE_PORT']
        sid = self.environ['socketio'].sessid
        log.info('ws: %s: sid: %s, remote-socket: %s:%s' % (prefix_msg, sid, rmt_addr, rmt_port))

    def recv_connect(self):
        self._log_conn('conn open')

    def recv_disconnect(self):
        self._log_conn('conn close')

    def on_diff_commit__topo(self, topo_diff):
        log.info('ws: rx: topo diff: ' + str(topo_diff))
        self.multicast_msg('diff_commit__topo', topo_diff)

    def on_diff_commit__attr(self, attr_diff):
        log.info('ws: rx: attr diff: ' + str(attr_diff))
        self.multicast_msg('diff_commit__attr', attr_diff)

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

    def __init__ (self, cfg, webapp):
        # Thread.__init__(self)
        SocketIOServer.__init__(self,
                                (cfg.listen_address, cfg.listen_port),
                                webapp,
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

    rz_request_env = {}  # available in namespace functions via 'self.request' - see socketio_manage
    def socketio_route_handler(url_path):
        try:
            socketio_manage(request.environ, {'/graph': WebSocket_Graph_NS}, rz_request_env)
        except:
            flask_webapp.logger.error("Exception while handling socketio connection",
                             exc_info=True)
        return Response()

    # connect socketio route
    route_dec = flask_webapp.route('/socket.io/<path:url_path>')
    f = route_dec(socketio_route_handler)
    flask_webapp.f = f

    # init ws server
    ws_srv = RZ_WebSocket_Server(cfg, flask_webapp)

    # link ws hooks: multicast on topo_diff, attr_diff
    def decorator__ws_multicast(ws_srv, f, f_multicast):
        """
        @param f: [!] wrapped function, name used to derive socket message name
        """

        @wraps(f)
        def wrapped_function(*args, **kw):
            f_ret = f(*args, **kw)

            pkt_data = f_ret
            if isinstance(f_ret, Topo_Diff):
                pkt_data = f_ret.to_json_dict()

            msg_name = f.__name__
            pkt = dict(type="event",
                       name=msg_name,
                       args=[pkt_data],
                       endpoint='/graph')

            ws_srv.log_multicast(msg_name)
            for sessid, socket in ws_srv.sockets.iteritems():
                socket.send_packet(pkt)

            return f_ret

        return wrapped_function

    kernel.diff_commit__topo = decorator__ws_multicast(ws_srv,
                                                       kernel.diff_commit__topo,
                                                       f_multicast=WebSocket_Graph_NS.on_diff_commit__topo)
    kernel.diff_commit__attr = decorator__ws_multicast(ws_srv,
                                                       kernel.diff_commit__attr,
                                                       f_multicast=WebSocket_Graph_NS.on_diff_commit__attr)

    return ws_srv;
