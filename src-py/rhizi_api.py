"""
Rhizi web API
"""
import os
import db_controller as dbc
import json
from flask import jsonify

from flask import Flask
from flask import request
from flask import make_response


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

def __sanitize_input():
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
def load_node_by_id_attr():
    """
    @return: a list containing a single node whose id attribute matches 'id' or
            an empty list if the requested node is not found
    @raise exception: on error
    """
    node_id = request.form['id']
    
    __sanitize_input(node_id)
    
    op = dbc.DBO_load_node_set_by_id_attribute([node_id])
    try:
        n = db_ctl.exec_op(op)
        ret = __response_wrap(data=n)
        return jsonify(ret)
    except Exception as e:
        return jsonify(__response_wrap(error='unable to load node with id: {0}'.format(node_id)))

@webapp.route("/add/node-single", methods=['POST'])
def add_node(n):
    pass

@webapp.route("/add/node-set", methods=['POST'])
def add_node_set(n_set):
    op = dbc.DBO_add_node_set()
    pass
