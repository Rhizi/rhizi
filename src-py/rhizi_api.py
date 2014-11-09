"""
Rhizi web API
"""
import os
import db_controller as dbc
import json
import logging
from flask import jsonify

from flask import Flask
from flask import request
from flask import make_response

log = logging.getLogger('rhizi')

class FlaskExt(Flask):
    """
    Flask server customization
    """

    def make_default_options_response(self):
        # sup = super(Flask, self)
        ret = Flask.make_default_options_response(self)
        ret.headers['Access-Control-Allow-Origin'] = '*'
        ret.headers['Access-Control-Allow-Headers'] = "Origin, Content-Type, Accept, Authorization"
        return ret

webapp = FlaskExt(__name__)
webapp.debug = True

# injected: DB controller
db_ctl = None

def __sanitize_input(*args, **kw_args):
    pass

def __response_wrap(data=None, error=None):
    """
    wrap response data/errors as dict - this should always be used when returning
    data to allow easy return of list objects, assist in error case distinction, etc. 
    """
    return dict(data=data, error=error)

def __common_resp_handle(data=None, error=None):
    """
    provide common response handling
    """
    ret_data = __response_wrap(data, error)
    resp = jsonify(ret_data)

    resp.headers['Access-Control-Allow-Origin'] = '*'

    # more response processing

    return resp

def __common_exec(op, on_success=__common_resp_handle):
    try:
        op_ret = db_ctl.exec_op(op)
        return on_success(op_ret)
    except Exception as e:
        log.error(e.message)
        log.error(traceback.print_exc())
        return __common_resp_handle('error occurred')

@webapp.route("/load/node-set-by-id", methods=['POST'])
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

@webapp.route("/match/node-set", methods=['POST'])
def match_node_set_by_attr_filter_map(attr_filter_map):
    """
    @param attr_filter_map
    
    @return: a set of node DB id's
    """
    op = dbc.DBO_match_node_id_set(attr_filter_map)
    return __common_exec(op)

@webapp.route("/load/link-set/by_link_ptr_set", methods=['POST'])
def load_link_set_by_link_ptr_set():

    def deserialize_param_set(param_json):
        l_ptr_set_raw = param_json['link_ptr_set']

        __sanitize_input(l_ptr_set_raw)

        l_ptr_set = []
        for lptr_dict in l_ptr_set_raw:
            src_id = lptr_dict.get('src_id')
            dst_id = lptr_dict.get('dst_id')
            l_ptr_set += [Link.Link_Ptr(src_id=src_id, dst_id=dst_id) ]

        return l_ptr_set

    l_ptr_set = deserialize_param_set(request.get_json())

    op = dbc.DBO_load_link_set.init_from_link_ptr_set(l_ptr_set)
    return __common_exec(op)

@webapp.route("/graph/clone", methods=['POST'])
def rz_clone():
    op = dbc.DBO_rz_clone()
    return __common_exec(op)

@webapp.route("/graph/diff-commit-set", methods=['POST'])
def diff_commit_set():
    """
    commit a diff set
    """
    def sanitize_input(req):
        diff_set_dict = request.get_json()['diff_set']
        topo_diff_dict = diff_set_dict['__diff_set_topo'][0]
        topo_diff = Topo_Diff.from_dict(topo_diff_dict)
        return topo_diff;

    topo_diff = sanitize_input(request)
    op = dbc.DBO_topo_diff_commit(topo_diff)
    return __common_exec(op)

@webapp.route("/graph/diff-commit-topo", methods=['POST'])
def diff_commit_topo():
    """
    commit a graph topology diff
    """
    def sanitize_input(req):
        topo_diff_dict = request.get_json()['topo_diff']
        topo_diff = Topo_Diff.from_dict(topo_diff_dict)
        return topo_diff;

    topo_diff = sanitize_input(request)
    op = dbc.DBO_topo_diff_commit(topo_diff)
    return __common_exec(op)

@webapp.route("/graph/diff-commit-attr", methods=['POST'])
def diff_commit_attr():
    """
    commit a graph attribute diff
    """
    attr_diff = request.get_json()['attr_diff']
    __sanitize_input(attr_diff)

    op = dbc.DBO_attr_diff_commit(attr_diff)
    return __common_exec(op)

@webapp.route("/graph/diff-commit-vis", methods=['POST'])
def diff_commit_vis():
    pass

@webapp.route("/add/node-set", methods=['POST'])
def add_node_set():
    """
    @param node_map: node type to node map, eg. { 'Skill': { 'name': 'kung-fu' } }
    """
    node_map = request.get_json()['node_map']
    __sanitize_input(node_map)

    op = dbc.DBO_add_node_set(node_map)
    return __common_exec(op)

