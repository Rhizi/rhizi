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

    # more response processing

    return resp

@webapp.route("/load/node-single", methods=['POST'])
def load_node_single_by_id_attr():
    # pending decision regarding support for single object operations
    assert False

@webapp.route("/load/node-set", methods=['POST'])
def load_node_set_by_id_attr():
    """
    @param id_set: list of node ids to match id attribute against
    @return: a list containing a single node whose id attribute matches 'id' or
            an empty list if the requested node is not found
    @raise exception: on error
    """
    id_set = request.get_json()['id_set']
    __sanitize_input(id_set)

    return __load_node_set_by_id_attr_common(id_set)

def __load_node_set_by_id_attr_common(id_set):
    op = dbc.DBO_load_node_set_by_id_attribute(id_set)
    try:
        n_set = db_ctl.exec_op(op)
        return __common_resp_handle(data=n_set)
    except Exception as e:
        log.exception(e)
        return __common_resp_handle(error='unable to load node with ids: {0}'.format(id_set))

@webapp.route("/add/node-single", methods=['POST'])
def add_node():
    # pending decision regarding support for single object operations
    assert False

@webapp.route("/add/node-set", methods=['POST'])
def add_node_set():
    """
    @param node_map: node type to node map, eg. { 'Skill': { 'name': 'kung-fu' } }
    """
    node_map = request.get_json()['node_map']
    __sanitize_input(node_map)

    op = dbc.DBO_add_node_set(node_map)
    try:
        n_set = db_ctl.exec_op(op)
        return __common_resp_handle(n_set)
    except Exception as e:
        return __common_resp_handle('exception raised: add_node_set')

