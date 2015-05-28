#    This file is part of rhizi, a collaborative knowledge graph editor.
#    Copyright (C) 2014-2015  Rhizi
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as published
#    by the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.


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
