#!/usr/bin/python

from flup.server.fcgi import WSGIServer
import os
import sys
import cgitb
import rhizi_server

from rz_kernel import RZ_Kernel

# sys.path.insert(0, '/srv/www/rhizi/rhizi.net/src-py')

# enable debugging
cgitb.enable()

if __name__ == '__main__':
    cfg = rhizi_server.init_config(cfg_dir='/etc/rhizi')
    log = rhizi_server.init_log(cfg)

    kernel = RZ_Kernel()
    webapp = rhizi_server.init_webapp(cfg, kernel)
    rhizi_server.init_rest_interface(cfg, webapp)

    log.info('launching webapp via flup.server.fcgi.WSGIServer')

    WSGIServer(webapp).run()
