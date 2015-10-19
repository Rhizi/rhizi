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


"""
Rhizi websocket web API
"""

import json
import logging
from socketio.mixins import BroadcastMixin
from socketio.namespace import BaseNamespace
import traceback

from .model.graph import Attr_Diff, Topo_Diff
from .rz_kernel import RZDoc_Exception__not_found


log = logging.getLogger('rhizi')

class WebSocket_Graph_NS(BaseNamespace, BroadcastMixin):
    """
    Rhizi '/graph' websocket namespace
    """
    def __init__(self, *args, **kw):
        super(WebSocket_Graph_NS, self).__init__(*args, **kw)

    def __context__common(self, json_dict):
        """
        build a common rquest context to pass along with a kernel diff commit
        """
        rzdoc_name = json_dict['rzdoc_name']
        return {'rzdoc_name': rzdoc_name}

    def _log_conn(self, prefix_msg):
        rmt_addr, rmt_port = self.request.peer_sock_addr

        sid = self.environ['socketio'].sessid
        log.info('ws: %s: sid: %s, remote-socket: %s:%s' % (prefix_msg, sid, rmt_addr, rmt_port))

    def _on_rzdoc_subscribe_common(self, data_dict, is_subscribe=None):
        rzdoc_name_raw = data_dict['rzdoc_name']

        # FIXME: non-flask dep. sanitization
        # rzdoc_name = sanitize_input__rzdoc_name(rzdoc_name_raw)
        rzdoc_name = rzdoc_name_raw

        rmt_addr, rmt_port = self.request.peer_sock_addr
        remote_socket_addr = (rmt_addr, rmt_port)
        socket = self.socket

        kernel = self.request.kernel
        msg_name = 'rzdoc_subscribe' if is_subscribe else 'rzdoc_unsubscribe'
        try:
            if is_subscribe:
                kernel.rzdoc__reader_subscribe(remote_socket_addr=remote_socket_addr,
                                               rzdoc_name=rzdoc_name,
                                               socket=socket)
                self.emit_ack(msg_name)
            else:
                kernel.rzdoc__reader_unsubscribe(remote_socket_addr=remote_socket_addr,
                                                 rzdoc_name=rzdoc_name,
                                                 socket=socket)
                self.emit_ack(msg_name)
        except RZDoc_Exception__not_found:
            self.emit_nak(msg_name)

    def emit_ack(self, acked_msg_name):
        self.emit('emit_ack', acked_msg_name)

    def emit_nak(self, acked_msg_name):
        self.emit('nak', acked_msg_name)

    def multicast_msg(self, msg_name, *args):
        self.socket.server.log_multicast(msg_name)
        try:
            super(WebSocket_Graph_NS, self).broadcast_event_not_me(msg_name, *args)
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())

    def on_diff_commit__topo(self, json_data):

        # FIXME: sanitize input
        json_dict = json.loads(json_data)
        topo_diff = Topo_Diff.from_json_dict(json_dict['topo_diff'])
        log.info('ws: rx: topo diff: ' + str(topo_diff))

        ctx = self.__context__common(json_dict)
        kernel = self.request.kernel
        topo_diff, commit_ret = kernel.diff_commit__topo(topo_diff, ctx)

        # handle serialization
        topo_diff_dict = topo_diff.to_json_dict()

        assert Topo_Diff.Commit_Result_Type == type(commit_ret)

        return self.multicast_msg('diff_commit__topo', topo_diff_dict, commit_ret)

    def on_diff_commit__attr(self, json_data):

        # FIXME: sanitize input
        json_dict = json.loads(json_data)
        attr_diff = Attr_Diff.from_json_dict(json_dict['attr_diff'])
        log.info('ws: rx: attr diff: ' + str(attr_diff))

        ctx = self.__context__common(json_dict)
        kernel = self.request.kernel
        attr_diff, commit_ret = kernel.diff_commit__attr(attr_diff, ctx)

        # [!] note: here we actually send the attr_diff twice, but in the future
        # commit_ret may not be the same
        return self.multicast_msg('diff_commit__attr', attr_diff, commit_ret)

    def on_rzdoc_subscribe(self, data_dict):
        return self._on_rzdoc_subscribe_common(data_dict, is_subscribe=True)

    def on_rzdoc_unsubscribe(self, data_dict):
        return self._on_rzdoc_subscribe_common(data_dict, is_subscribe=False)

    def recv_connect(self):
        self._log_conn('conn open')
        super(WebSocket_Graph_NS, self).recv_connect()  # super called despite being empty

    def recv_disconnect(self):
        self._log_conn('conn close')
        super(WebSocket_Graph_NS, self).recv_disconnect()

