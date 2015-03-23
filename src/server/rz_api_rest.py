"""
Rhizi REST web API:
   - make use of rz_kernel for core logic execution
   - make use of rz_api_common for common API logic

"""
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
from flask import current_app

import flask
import logging
import traceback

from model.graph import Attr_Diff
from model.graph import Topo_Diff
from rz_api_common import sanitize_input__attr_diff, map_rzdoc_name_to_rzdoc_id
from rz_api_common import sanitize_input__topo_diff
from rz_api_common import validate_obj__attr_diff
from rz_req_handling import common_resp_handle
from db_op import DBO_rz_clone
from neo4j_cypher import QT_Node_Filter__Doc_ID_Label


log = logging.getLogger('rhizi')

db_ctl = None  # injected: DB controller

def __context__common(rzdoc_id=None):
    """
    build a common rquest context to pass along with a kernel diff commit:
       - set user_name
    """

    ret = {}
    if session.has_key('username'):
        ret['user_name'] = session['username']

    ret['rzdoc_id'] = rzdoc_id
    return ret

def rz_clone():

    def sanitize_input(req):
        rzdoc_name = req.get_json().get('rzdoc_name')
        return rzdoc_name

    def on_success(topo_diff):
        # serialize Topo_Diff before including in response
        topo_diff_json = topo_diff.to_json_dict()
        return common_resp_handle(topo_diff_json)

    rzdoc_name = sanitize_input(request)
    if None == rzdoc_name: # load welcome doc by default
        rzdoc_name = current_app.rz_config.rzdoc_name__mainpage

    rzdoc_id = map_rzdoc_name_to_rzdoc_id(rzdoc_name)

    op = DBO_rz_clone()
    op = QT_Node_Filter__Doc_ID_Label(rzdoc_id)(op)
    return __common_exec(op, on_success=on_success)

def rzdoc__new():
    # TODO: add doc node, set doc label, associate user-doc
    
    def sanitize_input(req):
        return request.get_json().get('rzdoc_name')

    ctx = __context__common()
    rzdoc_name = sanitize_input(request)
    try:
        kernel = flask.current_app.kernel
        rzdoc = kernel.rzdoc__new(rzdoc_name, ctx)
        return common_resp_handle(data=rzdoc)
    except Exception as e:
        log.error(e.message)
        log.error(traceback.print_exc())
        return common_resp_handle(error=e)

def diff_commit__topo():
    """
    REST API wrapper around diff_commit__topo():
       - extract topo_diff from request
       - handle success/error outcomes
    """
    def sanitize_input(req):
        rzdoc_name = request.get_json().get('rzdoc_name')
        topo_diff_dict = request.get_json()['topo_diff']
        topo_diff = Topo_Diff.from_json_dict(topo_diff_dict)

        sanitize_input__topo_diff(topo_diff)
        return rzdoc_name, topo_diff

    try:
        rzdoc_name, topo_diff = sanitize_input(request)
    except Exception as e:
        return common_resp_handle(error='malformed input')

    rzdoc_id = map_rzdoc_name_to_rzdoc_id(rzdoc_name)
    ctx = __context__common(rzdoc_id=rzdoc_id)
    try:
        kernel = flask.current_app.kernel
        _, commit_ret = kernel.diff_commit__topo(topo_diff, ctx)
        return common_resp_handle(data=commit_ret)
    except Exception as e:
        log.error(e.message)
        log.error(traceback.print_exc())
        return common_resp_handle(error=e)

def diff_commit__attr():
    """
    commit a graph attribute diff
    """
    def sanitize_input(req):
        rzdoc_name = request.get_json().get('rzdoc_name')
        attr_diff_dict = request.get_json()['attr_diff']
        attr_diff = Attr_Diff.from_json_dict(attr_diff_dict)

        sanitize_input__attr_diff(attr_diff)
        
        return rzdoc_name, attr_diff;

    def on_error(e):
        # handle DB ERRORS, eg. name attr change error
        return common_resp_handle(error='error occurred')

    try:
        rzdoc_name, attr_diff = sanitize_input(request)
        validate_obj__attr_diff(attr_diff)
    except Exception as e:
        return common_resp_handle(error='malformed input')

    rzdoc_id = map_rzdoc_name_to_rzdoc_id(rzdoc_name)
    ctx = __context__common(rzdoc_id=rzdoc_id)
    try:
        kernel = flask.current_app.kernel
        _, commit_ret = kernel.diff_commit__attr(attr_diff, ctx)
        return common_resp_handle(data=commit_ret)
    except Exception as e:
        log.error(e.message)
        log.error(traceback.print_exc())
        return common_resp_handle(error=e)

def diff_commit__vis():
    pass

