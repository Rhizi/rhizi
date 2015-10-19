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


# -*- coding: utf-8 -*-

import logging
import os
import re
import types

from . import neo4j_schema


log = logging.getLogger('rhizi')

class RZ_Config(object):
    """
    rhizi-server configuration

    TODO: config option documentation

        listen_address
        listen_port
        log_level: upper/lower case log level as specified by the logging module
        neo4j_url
        root_path: root path from which the server will serve content
        user_db_path: absolute path to a Berkeley DB file used to store user accounts & password hash values
        template.d_path: absolute path to the jinja HTML template dir
    """

    @staticmethod
    def generate_default():
        cfg = {}

        #
        # [!] All resource paths are converted to absolute values after
        #     reading the actual configuration
        #

        cfg['config_dir'] = '.'
        cfg['development_mode'] = False

        #
        # - root_path: path to server root - relative paths are converted to absolute
        #                                    default: current working dir
        # - user_db_path: user_db path - relative paths are converted to absolute
        # - template_d_path: root_path relative location of template dir
        #
        cfg['root_path'] = '.'
        cfg['user_db_path'] = './user_db.db'
        cfg['fragment_d_path'] = '/static/fragment.d'
        cfg['template_d_path'] = '/static/fragment.d/template.d'

        # client configuration
        cfg['optimized_main'] = False

        # log
        cfg['log_level'] = 'INFO'
        cfg['log_path'] = '.'

        # Mail settings
        cfg['mta_host'] = '127.0.0.1'
        cfg['mta_port'] = 25
        cfg['mail_default_sender'] = 'rhizi@localhost'
        cfg['feedback_recipient'] = ''

        # Neo4j
        #    - user/pw: used when neo4j access control is enabled
        cfg['neo4j_url'] = 'http://127.0.0.1:7474'
        cfg['neo4j_user'] = None
        cfg['neo4j_pw'] = None

        # Network settings
        #    - reverse_proxy_host: proxy host name as seen by clients
        #
        cfg['listen_address'] = '127.0.0.1'
        cfg['listen_port'] = 8080
        cfg['reverse_proxy_host'] = None
        cfg['reverse_proxy_port'] = None

        # User feedback settings
        cfg['feedback_recipient'] = 'feedback@rhizi.local'

        # Flask
        cfg['static_url_path'] = '/static'

        # Flask keys
        cfg['SECRET_KEY'] = ''

        # Security
        #   - acl_wl__email_domain_set: comma separated email domain whitelist matched during signup.
        #                               depends on 'access_control==True', default: no restriction applied
        #   - acl_wl__email_address_file_path: path to email address whitelist file containing an email per line
        #                                      once read, the attribute acl_wl__email_address_set should be available
        #
        cfg['access_control'] = True
        cfg['acl_wl__email_domain_set'] = None
        cfg['acl_wl__email_address_file_path'] = None
        cfg['signup_enabled'] = True

        # Neo4j connection
        cfg['neo4j_url'] = 'http://127.0.0.1:7474'

        # Logging
        cfg['log_path'] = 'rhizi-server.log'

        # Rhizi
        cfg['rzdoc__mainpage_name'] = neo4j_schema.RZDOC__DEFAULT_MAINPAGE_NAME
        cfg['rzdoc__name__max_length'] = neo4j_schema.RZDOC__NAME__MAX_LENGTH

        ret = RZ_Config()
        ret.__dict__ = cfg  # allows setting of @property attributes

        # set default attribute cache values
        ret.acl_wl__email_address_set_cached = None  # [!] may caching of None value - see property access function

        return ret

    @staticmethod
    def init_from_file(file_path):

        if False == os.path.exists(file_path):
            raise Exception('config file not found: ' + file_path)

        cfg = RZ_Config.generate_default()
        cfg.config_dir = os.path.abspath(os.path.dirname(file_path))  # bypass prop restriction

        with open(file_path, 'r') as f:
            for line in f:
                if re.match('(^#)|(\s+$)', line):
                    continue

                kv_arr = line.split('=')
                if len(kv_arr) != 2:
                    raise Exception('failed to parse config line: ' + line)

                k, v = map(str.strip, kv_arr)
                if k.isupper() and not hasattr(cfg, k):  # Flask config key, add & continue
                    setattr(cfg, k, v)
                    continue

                if not k.isupper() and not hasattr(cfg, k):  # not Flask config key & unknown
                    raise Exception('unrecognized config key: \'%s\'' % (k))

                if '' == v: v = None

                if v is None: continue

                f = getattr(cfg, k)
                type_f = type(f)
                if bool == type_f:
                    v = v in ("True", "true")  # workaround bool('false') = True
                elif f is not None:
                    v = type_f(v)

                # FIXME: handle type cast for keys which default to None (always str)

                # [!] we can't use k.lower() as we are loading Flask configuration
                # keys which are expected to be capitalized
                setattr(cfg, k, v)

        # use absolute paths for the following
        for path in ['root_path',
                     'user_db_path']:
            path_value = getattr(cfg, path)
            if False == os.path.isabs(path_value):
                setattr(cfg, path, os.path.abspath(path_value))

        # authentication keys - see issue #419
        # for auth_key in ['neo4j_user', 'neo4j_pw']:
        #     if None == cfg.get(auth_key): raise Exception('config: missing key: ' + auth_key)

        return cfg

    def __str__(self):
        kv_item_set = []
        for k, v in self.__dict__.items():
            if k == 'SECRET_KEY':  # exclude key from logs
                v = v[:3] + '...'
            kv_item_set.append('%s: %s' % (k, v))

        kv_item_set.sort()
        return '\n'.join(kv_item_set)

    @property
    def acl_wl__email_address_set(self):
        """
        lazy load on first access from configured file source

        [!] may cache None value
        """
        if self.acl_wl__email_address_set_cached is not None:
            return self.acl_wl__email_address_set_cached[0]
        else:  # first access, attempt to init from file
            if self.acl_wl__email_address_file_path is not None:
                wl_email_set = []
                with open(self.acl_wl__email_address_file_path) as email_address_file:
                    for line in email_address_file.readlines():
                        # TODO: check email format
                        email = line
                        wl_email_set.append(email)
                log.info('acl initialized: acl_wl__email_address, email-count: %d' % (len(wl_email_set)))
                self.acl_wl__email_address_set_cached = wl_email_set
            else:
                self.acl_wl__email_address_set_cached = [None]

    @property
    def db_base_url(self):
        return self.neo4j_url

    @property
    def tx_api_path(self):
        return '/db/data/transaction'

    @property
    def config_dir_path(self):
        return self.config_dir

    @property
    def secret_key(self):
        return self.SECRET_KEY
