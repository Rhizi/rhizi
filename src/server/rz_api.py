"""
Rhizi web API

@deprecated: destined to split into rz_api_rest & rz_api_websocket
"""
from flask import current_app
from flask import escape
from flask import render_template
from flask import request
from flask import session
import logging
import traceback

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

def index():

    # fetch rz_username for welcome message
    email_address = session.get('username')
    rz_username = "Anonymous Stranger"
    role_set = []
    if None != email_address:  # session cookie passed & contains uid (email_address)
        try:
            uid, u_account = current_app.user_db.lookup_user__by_email_address(email_address)
            role_set = u_account.role_set
            rz_username = escape(u_account.rz_username)
        except Exception as e:
            # may occur on user_db reset or malicious cookie != stale cookie,
            # for which the user would at least be known to the user_db
            log.exception(e)

    # establish rz_config template values
    client_POV_server_name = request.headers.get('X-Forwarded-Host')  # first probe for reverse proxy headers
    if None == client_POV_server_name:
        client_POV_server_name = request.headers.get('Host')  # otherwise use Host: header
    assert None != client_POV_server_name, 'failed to establish hostname, unable to construct rz_config'

    hostname = client_POV_server_name
    port = 80
    if ':' in client_POV_server_name:
        hostname = client_POV_server_name.split(':')[0]
        port = client_POV_server_name.split(':')[1]

    return render_template('index.html',
                           rz_username=rz_username,
                           rz_config__hostname=hostname,
                           rz_config__port=port,
                           rz_config__optimized_main='true' if current_app.rz_config.optimized_main else 'false',
                           rz_config__role_set=role_set)
