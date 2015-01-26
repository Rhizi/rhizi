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
import flask
import logging
import traceback

from model.graph import Attr_Diff
from model.graph import Topo_Diff
from rz_api_common import sanitize_input__attr_diff
from rz_api_common import sanitize_input__topo_diff
from rz_api_common import validate_obj__attr_diff
from rz_req_handling import common_resp_handle


log = logging.getLogger('rhizi')

db_ctl = None  # injected: DB controller

def __context__common():
    """
    build a common rquest context to pass along with a kernel diff commit:
       - set user_name
    """

    ret = {}
    if session.has_key('username'):
        ret['user_name'] = session['username']

    return ret

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
        return common_resp_handle(error='malformed input')

    ctx = __context__common()
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
        attr_diff_dict = request.get_json()['attr_diff']
        attr_diff = Attr_Diff.from_json_dict(attr_diff_dict)

        sanitize_input__attr_diff(attr_diff)
        return attr_diff;

    def on_error(e):
        # handle DB ERRORS, eg. name attr change error
        return common_resp_handle(error='error occurred')

    try:
        attr_diff = sanitize_input(request)
        validate_obj__attr_diff(attr_diff)
    except Exception as e:
        return common_resp_handle(error='malformed input')

    ctx = __context__common()
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

