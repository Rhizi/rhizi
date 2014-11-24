#!/usr/bin/python

from flup.server.fcgi import WSGIServer
import rhizi_api
import os
import db_controller as dbc
from rhizi_server import Config

if __name__ == '__main__':
    cfg_dir = '/etc/rhizi'
    cfg = Config.init_from_file(os.path.join(cfg_dir, 'rhizi-server.conf'))

    db_ctl = dbc.DB_Controller(cfg)
    rhizi_api.db_ctl = db_ctl
    WSGIServer(rhizi_api.webapp).run()
