"""
Rhizi web API

@deprecated: destined to split into rz_api_rest & rz_api_websocket
"""
from datetime import datetime
from flask import Flask
from flask import escape
from flask import jsonify
from flask import make_response
from flask import redirect
from flask import render_template
from flask import request
from flask import send_from_directory
from flask import session
from flask import url_for
import flask
import json
import logging
import os
import traceback

import crypt_util
import db_controller as dbc
from db_op import DBO_add_node_set
from db_op import DBO_diff_commit__topo
from db_op import DBO_load_link_set
from db_op import DBO_match_node_id_set
from db_op import DBO_match_node_set_by_id_attribute
from db_op import DBO_rz_clone
from model.graph import Topo_Diff
from model.model import Link
from rz_api_common import __sanitize_input
from rz_api_common import sanitize_input__topo_diff
from rz_api_rest import common_resp_handle
from rz_kernel import RZ_Kernel
from rz_req_handling import make_response__json


log = logging.getLogger('rhizi')

db_ctl = None  # injected: DB controller

def __common_exec(op, on_success=common_resp_handle, on_error=common_resp_handle):
    """
    @param on_success: should return a Flask Response object
    @param on_error: should return a Flask Response object
    """
    try:
        op_ret = db_ctl.exec_op(op)
        return on_success(op_ret)
    except Exception as e:
        log.error(e.message)
        log.error(traceback.print_exc())
        return on_error(error='error occurred')

def load_node_set_by_id_attr():
    """
    load node-set by ID attribute
    
    @param id_set: list of node ids to match id attribute against
    @return: a list of nodes whose id attribute matches 'id' or
            an empty list if the requested node is not found
    @raise exception: on error
    """
    req_json = request.get_json()
    id_set = req_json['id_set']

    __sanitize_input(id_set)

    return __load_node_set_by_id_attr_common(id_set)

def __load_node_set_by_id_attr_common(id_set):
    """
    @param f_k: optional attribute filter key
    @param f_vset: possible key values to match against
    """
    op = DBO_match_node_set_by_id_attribute(id_set=id_set)
    try:
        n_set = db_ctl.exec_op(op)
        return common_resp_handle(data=n_set)
    except Exception as e:
        log.exception(e)
        return common_resp_handle(error='unable to load node with ids: {0}'.format(id_set))

def match_node_set_by_attr_filter_map(attr_filter_map):
    """
    @param attr_filter_map
    
    @return: a set of node DB id's
    """
    op = DBO_match_node_id_set(attr_filter_map)
    return __common_exec(op)

def load_link_set_by_link_ptr_set():

    def deserialize_param_set(param_json):
        l_ptr_set_raw = param_json['link_ptr_set']

        __sanitize_input(l_ptr_set_raw)

        l_ptr_set = []
        for lptr_dict in l_ptr_set_raw:
            src_id = lptr_dict.get('__src_id')
            dst_id = lptr_dict.get('__dst_id')
            l_ptr_set += [Link.Link_Ptr(src_id=src_id, dst_id=dst_id) ]

        return l_ptr_set

    l_ptr_set = deserialize_param_set(request.get_json())

    op = DBO_load_link_set.init_from_link_ptr_set(l_ptr_set)
    return __common_exec(op)

def rz_clone():

    def on_success(topo_diff):
        # serialize Topo_Diff before including in response
        topo_diff_json = topo_diff.to_json_dict()
        return common_resp_handle(topo_diff_json)

    op = DBO_rz_clone()
    return __common_exec(op, on_success=on_success)

def diff_commit__set():
    """
    commit a diff set
    """
    def sanitize_input(req):
        diff_set_dict = request.get_json()['diff_set']
        topo_diff_dict = diff_set_dict['__diff_set_topo'][0]
        topo_diff = Topo_Diff.from_json_dict(topo_diff_dict)

        sanitize_input__topo_diff(topo_diff)
        return topo_diff;

    topo_diff = sanitize_input(request)

    op = DBO_diff_commit__topo(topo_diff)
    return __common_exec(op)

def monitor__server_info():
    """
    server monitor stub
    """
    dt = datetime.now()
    return "<html><body>" + \
           "<h1>Rhizi Server v0.1</h1><p>" + \
           "date: " + dt.strftime("%Y-%m-%d") + "<br>" + \
           "time: " + dt.strftime("%H:%M:%S") + "<br>" + \
           "</p></body></html>"

def username_initials(username):
    """
    return two letter (always) initials of username.
    we do it here rather then on the client side to avoid rendering twice, once
    'annonymous' and later the real name, because of loading delays
    """
    words = username.split(' ')
    first_initial = words[0][0] if len(words) >= 1 and len(words[0]) >= 1 else ' '
    second_initial = (words[1][0] if len(words) >= 2 and len(words[1]) >= 1 else
        (words[0][1] if len(words) >= 1 and len(words[0]) > 1 else '_'))
    return (first_initial + second_initial).upper()

def index():
    session_username = session.get('username')
    username = escape(session_username if session_username != None else "Anonymous Stranger")
    profileinitials = username_initials(username)
    return render_template('index.html', username=username, profileinitials=profileinitials)

