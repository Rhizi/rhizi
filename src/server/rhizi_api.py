"""
Rhizi web API
"""
import os
import db_controller as dbc
import json
import logging
import traceback
import crypt_util

import flask
from flask import jsonify
from flask import Flask
from flask import request
from flask import make_response
from flask import session
from flask import redirect
from flask import escape
from flask import url_for
from flask import render_template
from flask import send_from_directory

from rz_kernel import RZ_Kernel

from model.graph import Topo_Diff
from model.graph import Attr_Diff
from model.model import Link
from datetime import datetime

log = logging.getLogger('rhizi')

# injected: DB controller
db_ctl = None

def __sanitize_input(*args, **kw_args):
    pass

def sanitize_input__node(n):
    """
    provide a control point as to which node fields are persisted
    """
    assert None != n.get('id'), 'invalid input: node: missing id'

def sanitize_input__link(l):
    """
    provide a control point as to which link fields are persisted
    """

    # expected prop assertions
    assert None != l.get('id'), 'invalid input: link: missing id'
    assert None != l.get('__src_id'), 'invalid input: link: missing src id'
    assert None != l.get('__dst_id'), 'invalid input: link: missing dst id'

    # unexpected prop assertions
    assert None == l.get('__type'), 'client is sending us __type link property, it should not'
    assert None == l.get('name'), 'client is sending us name link property, it should not'

def sanitize_input__topo_diff(topo_diff):
    for n in topo_diff.node_set_add:
        sanitize_input__node(n)
    for l in topo_diff.link_set_add:
        sanitize_input__link(l)

def sanitize_input__attr_diff(attr_diff):
    pass  # TODO: impl

def _validate_obj__attr_diff(ad):
    # check for name attr changes, which are currently forbidden
    for n_id, node_attr_diff_set in ad['__type_node'].items():
        for attr_name in node_attr_diff_set['__attr_write'].keys():
            if 'id' == attr_name:
                raise Exception('validation error: Attr_Diff: forbidden attribute change: \'id\', n_id: ' + n_id)

def __response_wrap(data=None, error=None):
    """
    wrap response data/errors as dict - this should always be used when returning
    data to allow easy return of list objects, assist in error case distinction, etc. 
    """
    return dict(data=data, error=error)

def __common_resp_handle(data=None, error=None):
    """
    provide common response handling
    
    @data must be json serializable
    @error will be serialized with str()
    """
    error_str = str(error)  # convert any Exception objects to serializable form
    ret_data = __response_wrap(data, error_str)
    resp = jsonify(ret_data)  # this will create a Flask Response object

    resp.headers['Access-Control-Allow-Origin'] = '*'

    # more response processing

    return resp

def __common_exec(op, on_success=__common_resp_handle, on_error=__common_resp_handle):
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
    op = dbc.DBO_match_node_set_by_id_attribute(id_set=id_set)
    try:
        n_set = db_ctl.exec_op(op)
        return __common_resp_handle(data=n_set)
    except Exception as e:
        log.exception(e)
        return __common_resp_handle(error='unable to load node with ids: {0}'.format(id_set))

def match_node_set_by_attr_filter_map(attr_filter_map):
    """
    @param attr_filter_map
    
    @return: a set of node DB id's
    """
    op = dbc.DBO_match_node_id_set(attr_filter_map)
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

    op = dbc.DBO_load_link_set.init_from_link_ptr_set(l_ptr_set)
    return __common_exec(op)

def rz_clone():
    op = dbc.DBO_rz_clone()
    return __common_exec(op)

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
    op = dbc.DBO_topo_diff_commit(topo_diff)
    return __common_exec(op)

def diff_commit__topo():
    """
    REST API wrapper around diff_commit__topo():
       - extract topo_diff from request
       - handle success/error outcomes
    """
    def sanitize_input(req):
        topo_diff_dict = request.get_json()['topo_diff']
        topo_diff = Topo_Diff.from_json_dict(topo_diff_dict)

        sanitize_input__topo_diff(topo_diff)
        return topo_diff;

    try:
        topo_diff = sanitize_input(request)
    except Exception as e:
        return __common_resp_handle(error='malformed input')

    try:
        kernel = flask.current_app.kernel
        topo_diff = kernel.diff_commit__topo(db_ctl, topo_diff)
        topo_diff_json = topo_diff.to_json_dict()
        return __common_resp_handle(data=topo_diff_json)
    except Exception as e:
        log.error(e.message)
        log.error(traceback.print_exc())
        return __common_resp_handle(error=e)

def diff_commit__attr():
    """
    commit a graph attribute diff
    """
    def sanitize_input(req):
        attr_diff_dict = request.get_json()['attr_diff']
        attr_diff = Attr_Diff.from_json_dict(attr_diff_dict)

        sanitize_input__attr_diff(attr_diff)
        return attr_diff;

    def on_error(e):
        # handle DB ERRORS, eg. name attr change error
        return __common_resp_handle(error='error occurred')

    try:
        attr_diff = sanitize_input(request)
        _validate_obj__attr_diff(attr_diff)
    except Exception as e:
        return __common_resp_handle(error='malformed input')

    try:
        kernel = flask.current_app.kernel
        attr_diff = kernel.diff_commit__attr(db_ctl, attr_diff)
        return __common_resp_handle(data=attr_diff)
    except Exception as e:
        log.error(e.message)
        log.error(traceback.print_exc())
        return __common_resp_handle(error=e)

def diff_commit__vis():
    pass

def add_node_set():
    """
    @deprecated: use topo_attr_commit

    @param node_map: node type to node map, eg. { 'Skill': { 'name': 'kung-fu' } }
    """
    node_map = request.get_json()['node_map']
    __sanitize_input(node_map)

    op = dbc.DBO_add_node_set(node_map)
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

def index():
    session_username = session.get('username')
    username = escape(session_username if session_username != None else "Anonymous Stranger")
    return render_template('index.html', username=username)

def login():

    def sanitize_input(req):
        req_json = request.get_json()
        u = req_json['username']
        p = req_json['password']
        return u, p

    if request.method == 'POST':
        try:
            u, p = sanitize_input(request)
            crypt_util.validate_login(flask.current_app.rz_config, u, p)
        except Exception as e:
            # login failed
            log.warn('login: unauthorized: user: %s' % (u))
            return render_template('login.html', login_failed=True)

        # login successful
        session['username'] = u
        log.debug('login: success: user: %s' % (u))
        return redirect(url_for('index'))

    if request.method == 'GET':
        return render_template('login.html')

def logout():
    # remove the username from the session if it's there
    u = session.pop('username', None)
    log.debug('logout: success: user: %s' % (u))
    return redirect(url_for('login'))

