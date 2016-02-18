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
from functools import wraps
import inspect
import logging

from flask import request
import socketio

from .model.graph import Topo_Diff
from .rz_api_rest import Req_Context
from .rz_api_websocket import WebSocket_Graph_NS
from .rz_req_handling import (make_response__http__empty,
    HTTP_STATUS__500_INTERNAL_SERVER_ERROR, HTTP_STATUS__200_OK,
    make_response__json, sock_addr_from_env_HTTP_headers,
    sock_addr_from_REMOTE_X_keys)


log = logging.getLogger('rhizi')


def init_ws_interface(cfg, kernel, flask_webapp):
    """
    Initialize websocket interface:
       - apply websocket route handlers

    @return: an initialized RZ_WebSocket_Server object
    """

    def decorator__ws_multicast(sio, f):
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

            diff = f_ret[1]

            data = _prep_for_serialization(diff)

            is_topo_diff = isinstance(f_ret[0], Topo_Diff)

            if is_topo_diff:
                rzdocs = [rzdoc_from_f_args_extractor(args)]
            else:
                node_ids = diff.node_ids()
                link_ids = diff.link_ids()
                rzdocs = kernel.rzdoc__rzdocs_from_ids(node_ids=node_ids, link_ids=link_ids)

            event = f.__name__
            websocket_graph_ns.broadcast_to_rzdocs_readers(event=event, data=data,
                                                           rzdocs=rzdocs)

            return f_ret

        return wrapped_function

    def rzdoc_from_f_args_extractor(f_args):  # extract rzdoc from req ctx
        if len(f_args) < 2 or not isinstance(f_args[1], Req_Context):
            return
        req_ctx = f_args[1]
        return req_ctx.rzdoc

    # connect socketio route
    sio = socketio.Server(namespace='/graph', async_mode='gevent')
    ret_flask_webapp = socketio.Middleware(sio, flask_webapp)

    class Unwrapped(object):
        diff_commit__topo = kernel.diff_commit__topo
        diff_commit__attr = kernel.diff_commit__attr
    kernel.unwrapped = Unwrapped

    kernel.diff_commit__topo = decorator__ws_multicast(sio,
                                                       kernel.diff_commit__topo)
    kernel.diff_commit__attr = decorator__ws_multicast(sio,
                                                       kernel.diff_commit__attr)

    ret_flask_webapp.kernel = kernel
    ret_flask_webapp.rz_websocket = websocket_graph_ns = WebSocket_Graph_NS(sio=sio, kernel=kernel)
    return ret_flask_webapp
