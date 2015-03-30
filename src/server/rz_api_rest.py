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
class Req_Context():
    """
    Request context:
       - user_name
       - rzdoc
    """

    def __init__(self):
        self.user_name = None
        self.rzdoc = None

    """
    build a common rquest context to pass along with a kernel diff commit:
       - set user_name
    """

    ret = Req_Context()
    if session.has_key('username'):
        ret.user_name = session['username']

    ret['rzdoc_id'] = rzdoc_id
    return ret


    def sanitize_input(req):





    


@common_rest_req_exception_handler
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

    rzdoc_name, topo_diff = sanitize_input(request)

    ctx = __context__common(rzdoc_name)
    kernel = flask.current_app.kernel
    _, commit_ret = kernel.diff_commit__topo(topo_diff, ctx)
    return common_resp_handle__success(data=commit_ret)

@common_rest_req_exception_handler
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

    rzdoc_name, attr_diff = sanitize_input(request)
    validate_obj__attr_diff(attr_diff)
    ctx = __context__common(rzdoc_name)
    kernel = flask.current_app.kernel
    _, commit_ret = kernel.diff_commit__attr(attr_diff, ctx)
    return common_resp_handle__success(data=commit_ret)

def diff_commit__vis():
    pass

@common_rest_req_exception_handler
def rzdoc_clone():

    def sanitize_input(req):
        rzdoc_name = req.get_json().get('rzdoc_name')
        return rzdoc_name

    rzdoc_name = sanitize_input(request)
    if None == rzdoc_name:  # load welcome doc by default
        rzdoc_name = current_app.rz_config.rzdoc__mainpage_name

    kernel = flask.current_app.kernel
    ctx = __context__common(rzdoc_name)
    topo_diff = kernel.rzdoc__clone(ctx.rzdoc, ctx)
    topo_diff_json = topo_diff.to_json_dict()  # serialize Topo_Diff before including in response
    return common_resp_handle__success(data=topo_diff_json)

@common_rest_req_exception_handler
def rzdoc__create(rzdoc_name):
    """
    create RZ doc
    """
    s_rzdoc_name = sanitize_input__rzdoc_name(rzdoc_name)
    kernel = flask.current_app.kernel
    ctx = __context__common(rzdoc_name=None)  # avoid rzdoc cache lookup exception
    kernel.rzdoc__create(s_rzdoc_name, ctx)
    return make_response__json(status=HTTP_STATUS__201_CREATED)

