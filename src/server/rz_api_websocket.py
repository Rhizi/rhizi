"""
Rhizi websocket web API
"""

import json
import logging
from socketio.mixins import BroadcastMixin
from socketio.namespace import BaseNamespace
import traceback

from model.graph import Attr_Diff, Topo_Diff


log = logging.getLogger('rhizi')

class WebSocket_Graph_NS(BaseNamespace, BroadcastMixin):
    """
    Rhizi '/graph' websocket namespace
    """
    def __init__(self, *args, **kw):
        super(WebSocket_Graph_NS, self).__init__(*args, **kw)

    def __context__common(self):
        """
        build a common rquest context to pass along with a kernel diff commit
        """
        # FIXME: impl
        pass

    def multicast_msg(self, msg_name, *args):
        self.socket.server.log_multicast(msg_name)
        try:
            super(WebSocket_Graph_NS, self).broadcast_event_not_me(msg_name, *args)
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())

    def _log_conn(self, prefix_msg):
        rmt_addr = self.environ['REMOTE_ADDR']
        rmt_port = self.environ['REMOTE_PORT']
        sid = self.environ['socketio'].sessid
        log.info('ws: %s: sid: %s, remote-socket: %s:%s' % (prefix_msg, sid, rmt_addr, rmt_port))

    def recv_connect(self):
        self._log_conn('conn open')

    def recv_disconnect(self):
        self._log_conn('conn close')

    def on_diff_commit__topo(self, json_data):
        json_dict = json.loads(json_data)
        topo_diff = Topo_Diff.from_json_dict(json_dict)
        log.info('ws: rx: topo diff: ' + str(topo_diff))

        ctx = self.__context__common()
        kernel = self.request.kernel
        topo_diff, commit_ret = kernel.diff_commit__topo(topo_diff, ctx)

        # handle serialization
        topo_diff_dict = topo_diff.to_json_dict()

        assert Topo_Diff.Commit_Result_Type == type(commit_ret)

        return self.multicast_msg('diff_commit__topo', topo_diff_dict, commit_ret)

    def on_diff_commit__attr(self, json_data):
        json_dict = json.loads(json_data)
        attr_diff = Attr_Diff.from_json_dict(json_dict)
        log.info('ws: rx: attr diff: ' + str(attr_diff))

        ctx = self.__context__common()
        kernel = self.request.kernel
        attr_diff, commit_ret = kernel.diff_commit__attr(attr_diff, ctx)

        # [!] note: here we actually send the attr_diff twice, but in the future
        # commit_ret may not be the same
        return self.multicast_msg('diff_commit__attr', attr_diff, commit_ret)

