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


log = logging.getLogger('rhizi')

db_ctl = None  # injected: DB controller

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
    if error is None:
        error_str = ""
    else:
        error_str = str(error)  # convert any Exception objects to serializable form
    ret_data = __response_wrap(data, error_str)
    resp = jsonify(ret_data)  # this will create a Flask Response object

    resp.headers['Access-Control-Allow-Origin'] = '*'

    # more response processing

    return resp

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
        topo_diff = kernel.diff_commit__topo(topo_diff)
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
        validate_obj__attr_diff(attr_diff)
    except Exception as e:
        return __common_resp_handle(error='malformed input')

    try:
        kernel = flask.current_app.kernel
        attr_diff = kernel.diff_commit__attr(attr_diff)
        return __common_resp_handle(data=attr_diff)
    except Exception as e:
        log.error(e.message)
        log.error(traceback.print_exc())
        return __common_resp_handle(error=e)

def diff_commit__vis():
    pass

