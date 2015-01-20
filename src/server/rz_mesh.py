from collections import namedtuple
from flask import Response
from flask import request
from functools import wraps
from geventwebsocket.handler import WebSocketHandler
import logging
from socketio import socketio_manage
from socketio.server import SocketIOHandler
from socketio.server import SocketIOServer

from db_op import DBO_block_chain__commit
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

            bc_commit = False
            if 'ctx' in kw and kw.get('ctx')['__caller'] == 'ws':
                bc_commit = False

            # assert type(f_ret) in [list, tuple]

            gen_copy = [o for o in f_ret]  # copy generator items

            pkt_data = map(_prep_for_serialization, [diff_obj for (diff_obj, op, op_ret) in gen_copy])
            msg_name = f.__name__
            pkt = dict(type="event",
                       name=msg_name,
                       args=pkt_data,
                       endpoint='/graph')

            ws_srv.log_multicast(msg_name)
            ws_broadcast_to_all(pkt)

            if bc_commit == False:
                for f_ret_item in gen_copy:

                    diff_obj, op, op_ret = f_ret_item
                    if not isinstance(op, DBO_block_chain__commit):
                        continue

                    pkt_data = _prep_for_serialization(op_ret)
                    msg_name = f.__name__
                    pkt = dict(type="event",
                               name=msg_name,
                               args=pkt_data,
                               endpoint='/graph')
                    ws_broadcast_to_all(pkt)

            for o in gen_copy:
                yield o

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
