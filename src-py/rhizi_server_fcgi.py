#!/usr/bin/python

from flup.server.fcgi import WSGIServer
import os
import sys
import cgitb
import rhizi_server

# sys.path.insert(0, '/srv/www/rhizi/rhizi.net/src-py')

# enable debugging
cgitb.enable()

if __name__ == '__main__':
    cfg_dir = '/etc/rhizi'

    cfg = rhizi_server.init_config(os.path.join(cfg_dir, 'rhizi-server.conf'))
    log = rhizi_server.init_log()

    webapp = rhizi_server.init_webapp(cfg)
    rhizi_server.init_rest_api(cfg, webapp)

    log.info('launching webapp via flup.server.fcgi.WSGIServer')

    WSGIServer(webapp).run()
