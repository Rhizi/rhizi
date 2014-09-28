"""
Rhizi web API
"""
import os
import db_controller as dbc
import json
from flask import jsonify

from flask import Flask
from flask import request

webapp = Flask(__name__)
webapp.debug = True

# injected: DB controller
db_ctl = None

def __response_wrap(data=None, error=None):
    """
    wrap response data/errors as dict - this should always be used when returning
    data to allow easy return of list objects, assist in error case distinction, etc. 
    """
    return dict(data=data, error=error)

@webapp.route("/load/node-single", methods=['POST'])
def load_node_by_id_attr():
    """
    @return: a list containing a single node whose id attribute matches 'id' or
            an empty list if the requested node is not found
    @raise exception: on error
    """
    node_id = request.form['id']
    op = dbc.DBO_load_node_set_by_id_attribute([node_id])
    try:
        n = db_ctl.exec_op(op)
        ret = __response_wrap(n)
        return jsonify(ret)
    except Exception as e:
        return jsonify('unable to load node with id: {0}'.format(node_id))

@webapp.route("/add/node-single")
def add_node(n):
    pass
