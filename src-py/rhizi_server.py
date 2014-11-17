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
