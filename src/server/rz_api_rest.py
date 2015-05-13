"""
Rhizi REST web API:
   - make use of rz_kernel for core logic execution
   - make use of rz_api_common for common API logic

"""
from flask import current_app
from flask import request
from flask import session
import flask
import logging

from db_op import DBO_match_node_set_by_id_attribute, \
    DBO_load_link_set, DBO_match_node_id_set, DBO_diff_commit__topo
from model.graph import Attr_Diff
from model.graph import Topo_Diff
from model.model import Link
from rz_api import rz_mainpage
from rz_api_common import sanitize_input__attr_diff, \
    __sanitize_input, sanitize_input__rzdoc_name
from rz_api_common import sanitize_input__topo_diff
from rz_api_common import validate_obj__attr_diff
from rz_kernel import RZDoc_Exception__already_exists
from rz_req_handling import common_resp_handle__success, make_response__json, \
    HTTP_STATUS__204_NO_CONTENT, HTTP_STATUS__201_CREATED, \
    common_resp_handle__client_error, \
    common_rest_req_exception_handler, common_resp_handle__server_error


log = logging.getLogger('rhizi')

class Req_Context():
    """
    Request context:
       - user_name
       - rzdoc
    """

    def __init__(self, user_name=None, rzdoc=None):
        self.user_name = user_name
        self.rzdoc = rzdoc

def __context__common(rzdoc_name=None):
    """
    Common request context builder passed along with kernel calls:
       - set user_name
       - set rzdoc if rzdoc_name argument was supplied

    @raise RZDoc_Exception__not_found: if rzdoc_name arg was passed and document was not found
    """

    ret = Req_Context()
    if session.has_key('username'):
        ret.user_name = session['username']

    if None != rzdoc_name:
        s_rzdoc_name = sanitize_input__rzdoc_name(rzdoc_name)
        ret.rzdoc = current_app.kernel.cache_lookup__rzdoc(s_rzdoc_name)
    return ret

def __load_node_set_by_id_attr_common(rzdoc_name, id_set):
    """
    @param f_k: optional attribute filter key
    @param f_vset: possible key values to match against
    """
    ctx = __context__common(rzdoc_name)
    kernel = flask.current_app.kernel
    _, commit_ret = kernel.load_node_set_by_id_attr(id_set, ctx)
    return common_resp_handle__success(data=commit_ret)

def diff_commit__set():
    """
    commit a diff set
    """
    def sanitize_input(req):
        diff_set_dict = req.get_json()['diff_set']
        topo_diff_dict = diff_set_dict['__diff_set_topo'][0]
        topo_diff = Topo_Diff.from_json_dict(topo_diff_dict)

        sanitize_input__topo_diff(topo_diff)
        return topo_diff;

    topo_diff = sanitize_input(request)

    op = DBO_diff_commit__topo(topo_diff)

    assert False

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

    assert False

@common_rest_req_exception_handler
def load_node_set_by_id_attr():
    """
    load node-set by ID attribute
    
    @param id_set: list of node ids to match id attribute against
    @return: a list of nodes whose id attribute matches 'id' or
            an empty list if the requested node is not found
    @raise exception: on error
    """

    def sanitize_input(req):
        req_json = request.get_json()
        rzdoc_name = req_json['rzdoc_name']
        id_set = req_json['id_set']
        return rzdoc_name, id_set

    rzdoc_name, id_set = sanitize_input(request)

    return __load_node_set_by_id_attr_common(rzdoc_name, id_set)

def match_node_set_by_attr_filter_map(attr_filter_map):
    """
    @param attr_filter_map
    
    @return: a set of node DB id's
    """
    op = DBO_match_node_id_set(attr_filter_map)

    assert False

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
    if topo_diff.is_empty():
        return common_resp_handle__client_error()

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

def rzdoc__via_rz_url(rzdoc_name=None):
    return rz_mainpage(rzdoc_name)

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
    commit_log = kernel.rzdoc__commit_log(ctx.rzdoc, limit=10)
    return common_resp_handle__success(data=[topo_diff_json, commit_log])

@common_rest_req_exception_handler
def rzdoc__create(rzdoc_name):
    """
    create RZ doc
    """
    s_rzdoc_name = sanitize_input__rzdoc_name(rzdoc_name)
    kernel = flask.current_app.kernel
    ctx = __context__common(rzdoc_name=None)  # avoid rzdoc cache lookup exception
    try:
        kernel.rzdoc__create(s_rzdoc_name, ctx)
    except RZDoc_Exception__already_exists as e:
        return common_resp_handle__server_error(error='rzdoc already exists')
    return make_response__json(status=HTTP_STATUS__201_CREATED)

@common_rest_req_exception_handler
def rzdoc__delete(rzdoc_name):
    kernel = flask.current_app.kernel
    ctx = __context__common(rzdoc_name)
    kernel.rzdoc__delete(ctx.rzdoc, ctx)
    return make_response__json(status=HTTP_STATUS__204_NO_CONTENT)

@common_rest_req_exception_handler
def rzdoc__list():
    kernel = flask.current_app.kernel
    ctx = __context__common(rzdoc_name=None)  # avoid rzdoc cache lookup exception
    rzdoc_set = kernel.rzdoc__list(ctx)
    ret = [rzdoc_dict['name'] for rzdoc_dict in rzdoc_set]
    return common_resp_handle__success(data=ret)
