#!/usr/bin/python

import logging
import json
import util
import os
import neo4j_util
import argparse
import db_controller as dbc
import rhizi_api

class Config(object):
    """
    rhizi-server configuration
    """

    @staticmethod
    def init_from_file(file_path):
        ret = Config()

        if False == os.path.exists(file_path):
            raise Exception('config file not found: ' + file_path)

        with open(file_path, 'r') as f:
            cfg = json.loads(f.read())

            #
            # TODO: config option documentation
            #
            ret.neo4j_url = cfg['neo4j_url']
            ret.listen_address = cfg['listen_address']
            ret.listen_port = cfg['listen_port']

        return ret

    @property
    def db_base_url(self):
        return self.neo4j_url

    @property
    def tx_api_path(self):
        return '/db/data/transaction'

def init_logging():

    log = logging.getLogger('rhizi')
    log.setLevel(logging.DEBUG)
    log_handler_c = logging.StreamHandler()
    log_handler_f = logging.FileHandler('/tmp/rhizi-server.log')

    log.addHandler(log_handler_c)
    log.addHandler(log_handler_f)

class RhiziServer(object):
    pass

def init_rest_api(flask_webapp):
    """
    map REST API calls
    """
    rest_entry_set = [
                      rest_entry('/add/node-set' , rhizi_api.add_node_set),
                      rest_entry('/graph/clone', rhizi_api.rz_clone),
                      rest_entry('/graph/diff-commit-set', rhizi_api.diff_commit_set),
                      rest_entry('/graph/diff-commit-topo', rhizi_api.diff_commit_topo),
                      rest_entry('/graph/diff-commit-attr', rhizi_api.diff_commit_attr),
                      rest_entry('/graph/diff-commit-vis', rhizi_api.diff_commit_vis),
                      rest_entry('/index', rhizi_api.index),
                      rest_entry('/load/node-set-by-id', rhizi_api.load_node_set_by_id_attr),
                      rest_entry('/load/link-set/by_link_ptr_set', rhizi_api.load_link_set_by_link_ptr_set),
                      rest_entry('/login', rhizi_api.login, {'methods': ['GET', 'POST']}),
                      rest_entry('/logout', rhizi_api.logout),
                      rest_entry('/match/node-set', rhizi_api.match_node_set_by_attr_filter_map),
                      rest_entry('/monitor/server-info', rhizi_api.monitor__server_info),
                  ]

    for re in rest_entry_set:
        rest_path, f, flask_args = re
        route_decorator = flask_webapp.route(rest_path, **flask_args)
        flask_webapp.f = route_decorator(f)

        if '/login' != rest_path:

if __name__ == "__main__":

    p = argparse.ArgumentParser(description='rhizi-server')
    p.add_argument('--config-dir', help='path to Rhizi config dir', default='res/etc')
    args = p.parse_args()

    cfg_dir = args.config_dir

    init_logging()

    cfg = Config.init_from_file(os.path.join(cfg_dir, 'rhizi-server.conf'))
    db_ctl = dbc.DB_Controller(cfg)

    rhizi_api.db_ctl = db_ctl
    rhizi_api.webapp.run(host=cfg.listen_address, port=cfg.listen_port)
