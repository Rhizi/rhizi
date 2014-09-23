"""
Rhizi webapp
"""
import os
import json
import logging

from flask import Flask, request, url_for
import db_controller as dbc

cwd = os.getcwd()
app = Flask(__name__)
app.debug = True

class Config:
    """
    rhizi-server configuration
    """

    @staticmethod
    def init_from_file(file_path):
        ret = Config()

        with open(file_path, 'r') as f:
            cfg = json.loads(f.read())
            ret.db_base_url = cfg['neo4j_url']

        return ret

    @property
    def db_base_url(self):
        return self.neo4j_url

    @property
    def tx_api_path(self):
        return '/db/data/transaction'

@app.route("/add-node-set")
def foo():
    pass

def init_logging():
    global log

    log = logging.getLogger('rhizi')
    log.setLevel(logging.DEBUG)
    log_handler_c = logging.StreamHandler()
    log_handler_f = logging.FileHandler('/tmp/rhizi-backend.log')

    log.addHandler(log_handler_c)
    log.addHandler(log_handler_f)

def test_DB_controller_api():
    db_ctl = dbc.DB_Controller(cfg)

    n_map = { 'Skill': [{'name': 'kung fu' },
                        {'name': 'judo' }
                       ],
              'Person': [{'name': 'Bob' }, {'name': 'Alice' }]
            }

    db_ctl.exec_op(dbc.DBO_add_node_set(n_map))
    id_set = db_ctl.exec_op(dbc.DBO_load_node_id_set(filter_type='Skill'))

if __name__ == "__main__":
    cfg = Config.init_from_file('res/etc/rhizi-backend.conf')
    init_logging()
    
    test_DB_controller_api()
    # app.run(host='127.0.0.1', port=rhizi_backend_cfg['port'], ssl_context=ctx)
