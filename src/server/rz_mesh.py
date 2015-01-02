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
        multicast_size = len(self.socket.server.sockets) - 1  # subtract self socket
        log.info('ws: tx: msg: \'%s\': cast-size ~= %d' % (msg_name, multicast_size))  # ~=: as race conditions apply
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

def init_ws_interface(cfg, flask_webapp):
    """
    Initialize websocket interface:
       - apply websocket route handlers
    
    @return: an initialized RZ_WebSocket_Server object
    """

    def socketio(url_path):
        try:
            socketio_manage(request.environ, {'/graph': WebSocket_Graph_NS}, request)
        except:
            flask_webapp.logger.error("Exception while handling socketio connection",
                             exc_info=True)
        return Response()

    def socketio_entry(path, f, flask_args={}):
        return (path, f, flask_args)

    socketio_entry_set = [
                      socketio_entry('/socket.io/<path:url_path>' , socketio),
                      ]

    for sio_entry in socketio_entry_set:
        sio_path, f, flask_args = sio_entry

        route_dec = flask_webapp.route(sio_path, **flask_args)
        f = route_dec(f)
        flask_webapp.f = f

    ret = RZ_WebSocket_Server(cfg, flask_webapp)
    return ret;
