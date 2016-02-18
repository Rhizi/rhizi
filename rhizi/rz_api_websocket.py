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
import traceback
from datetime import datetime

from .model.graph import Attr_Diff, Topo_Diff
from .rz_kernel import RZDoc_Exception__not_found


log = logging.getLogger('rhizi')


namespace = '/graph'


class SocketIOHandlerBase(object):
    """
    automagically turn any method starting with on_ on the inheriting class
    into a socketio decorated callback.
    """
    def __init__(self, sio, namespace):
        self.namespace = namespace
        self.sio = sio
        for f_name in dir(self):
            if not f_name.startswith('on_'):
                continue
            f = getattr(self, f_name)
            if not callable(f):
                continue
            event = f_name[3:]
            print("registring {}".format(event))
            sio.on(event=event, handler=f, namespace=self.namespace)

    def broadcast_event_not_me(self, sid, event_name, *args):
        self.sio.emit(event_name, args, skip_sid=sid, namespace=self.namespace)

    def emit_many(self, event, data, sids):
        # [?] use a room? i.e. a single sio.emit(room=the_room)
        errors = []
        for sid in sids:
            err = 0
            try:
                self.sio.emit(event=event, data=data, room=sid, namespace=self.namespace)
            except Exception as e:
                err = 1
            errors.append(err)
        return errors


class WebSocket_Graph_NS(SocketIOHandlerBase):
    """
    Rhizi '/graph' websocket namespace
    """
    def __init__(self, sio, kernel):
        super(WebSocket_Graph_NS, self).__init__(sio=sio, namespace='/graph')
        self.kernel = kernel

    def broadcast_to_rzdoc_readers(self, event, data, rzdoc):
        """
        Cast update messege to subscribed readers
        """

        c_assoc_set = self.kernel.rzdoc__client_set_from_rzdoc(rzdoc)

        log.debug('ws: rzdoc cast: msg: \'%s\': rzdoc: %s, cast-size ~= %d' % (event,
                                                                               rzdoc.name,
                                                                               len(c_assoc_set)))
        errors = self.emit_many(event=event, data=data, sids=[c.sid for c in c_assoc_set])


    def __context__common(self, json_dict):
        """
        build a common rquest context to pass along with a kernel diff commit
        """
        rzdoc_name = json_dict['rzdoc_name']
        return {'rzdoc_name': rzdoc_name}

    def _log_conn(self, sid, prefix_msg):
        log.info('ws: %s: %s' % (sid, prefix_msg))

    def _on_rzdoc_subscribe_common(self, sid, data_dict, is_subscribe=None):
        rzdoc_name_raw = data_dict['rzdoc_name']

        # FIXME: non-flask dep. sanitization
        # rzdoc_name = sanitize_input__rzdoc_name(rzdoc_name_raw)
        rzdoc_name = rzdoc_name_raw

        kernel = self.kernel
        msg_name = 'rzdoc_subscribe' if is_subscribe else 'rzdoc_unsubscribe'
        ret = True
        try:
            if is_subscribe:
                kernel.rzdoc__client_subscribe(sid=sid,
                                               rzdoc_name=rzdoc_name)
            else:
                kernel.rzdoc__client_unsubscribe(sid=sid,
                                                 rzdoc_name=rzdoc_name)
        except RZDoc_Exception__not_found:
            ret = False
        return ret

    def multicast_msg(self, sid, msg_name, *args):
        self.broadcast_event_not_me(sid, msg_name, *args)

    def on_diff_commit__topo(self, sid, json_data):

        # FIXME: sanitize input
        json_dict = json.loads(json_data)
        topo_diff = Topo_Diff.from_json_dict(json_dict['topo_diff'])
        log.info('ws: rx: topo diff: ' + str(topo_diff))

        ctx = self.__context__common(json_dict)
        kernel = self.kernel
        topo_diff, commit_ret = kernel.unwrapped.diff_commit__topo(topo_diff, ctx)

        # handle serialization
        topo_diff_dict = topo_diff.to_json_dict()

        assert Topo_Diff.Commit_Result_Type == type(commit_ret)

        # TODO: broadcast only to !me && doc-touched-by-topo-diff
        return self.multicast_msg(sid, 'diff_commit__topo', topo_diff_dict, commit_ret)

    def on_diff_commit__attr(self, sid, json_data):

        # FIXME: sanitize input
        json_dict = json.loads(json_data)
        attr_diff = Attr_Diff.from_json_dict(json_dict['attr_diff'])
        log.info('ws: rx: attr diff: ' + str(attr_diff))

        ctx = self.__context__common(json_dict)
        kernel = self.kernel
        attr_diff, commit_ret = kernel.unwrapped.diff_commit__attr(attr_diff, ctx)

        # [!] note: here we actually send the attr_diff twice, but in the future
        # commit_ret may not be the same
        # TODO: broadcast only to !me && doc-touched-by-attr-diff
        return self.multicast_msg(sid, 'diff_commit__attr', attr_diff, commit_ret)

    def on_rzdoc_subscribe(self, sid, data_dict):
        ret = self._on_rzdoc_subscribe_common(sid, data_dict, is_subscribe=True)
        self.kernel.dump_clients()
        return ret

    def on_rzdoc_unsubscribe(self, sid, data_dict):
        ret = self._on_rzdoc_subscribe_common(sid, data_dict, is_subscribe=False)
        self.kernel.dump_clients()
        return ret

    def on_connect(self, sid, environ):
        self._log_conn(sid, 'conn open')

    def on_disconnect(self, sid):
        self._log_conn(sid, 'conn closed')

    def on_test_chat(self, sid, msg):
        log.info('ws: {}: {}'.format(sid, msg))
        self.sio.emit('test_chat', {'timestamp': str(datetime.now())},
                      namespace=self.namespace)
