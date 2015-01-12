#!/usr/bin/python

import cgitb
from flup.server.fcgi import WSGIServer
import os
import sys

from rz_kernel import RZ_Kernel
import rz_server


# sys.path.insert(0, '/srv/www/rhizi/rhizi.net/src-py')
# enable debugging
cgitb.enable()

if __name__ == '__main__':

    cfg = rz_server.init_config(cfg_dir='/etc/rhizi')
    log = rz_server.init_log(cfg)

    kernel = RZ_Kernel()
    webapp = rz_server.init_webapp(cfg, kernel)
    ws_srv = rz_server.init_ws_interface(cfg, kernel, webapp)

    log.info('launching webapp via flup.server.fcgi.WSGIServer')

    WSGIServer(ws_srv).run()
