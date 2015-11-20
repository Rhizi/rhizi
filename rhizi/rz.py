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


import sys
import os
import time

from .rz_start import init_config, init_webapp
from .rz_user_db import Fake_User_DB
from .rz_kernel import RZ_Kernel
from . import db_controller as dbc


class RZ(object):
    def __init__(self, config_dir):
        cfg = init_config(config_dir)
        kernel = RZ_Kernel()
        db_ctl = dbc.DB_Controller(cfg.db_base_url)
        kernel.db_ctl = db_ctl
        user_db = Fake_User_DB()
        webapp = init_webapp(cfg, kernel)
        webapp.user_db = user_db
        kernel.db_op_factory = webapp  # assist kernel with DB initialization
        kernel.start()
        time.sleep(0.1)
        self.kernel = kernel
