import os
import re


class Config(object):
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
        cfg['config_dir'] = '.'
        cfg['development_mode'] = False

        cfg['root_path'] = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        cfg['template_d_path'] = os.path.join(cfg['root_path'], 'fragment.d', 'template.d')

        cfg['user_db_path'] = './user_db.db'

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
        #   - acl__singup__email_domain: restrict signup requests by email domain.
        #                                depends on 'access_control==True', default: no restriction applied
        cfg['access_control'] = True
        cfg['acl__singup__email_domain'] = None
        cfg['signup_enabled'] = True

        # Neo4j connection
        cfg['neo4j_url'] = 'http://127.0.0.1:7474'

        # Logging
        cfg['log_path'] = 'rhizi-server.log'

        # Rhizi
        cfg['rzdoc__mainpage_name'] = 'Welcome Rhizi'
        cfg['rzdoc__name__max_length'] = 256

        ret = Config()
        ret.__dict__ = cfg  # allows setting of @property attributes
        return ret

    @staticmethod
    def init_from_file(file_path):

        if False == os.path.exists(file_path):
            raise Exception('config file not found: ' + file_path)

        cfg = Config.generate_default()
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

                type_f = type(getattr(cfg, k))
                if bool == type_f:
                    v = v in ("True", "true")  # workaround bool('false') = True
                elif types.NoneType != type_f:
                    v = type_f(v)

                # FIXME: handle type cast for keys which default to None (always str)

                # [!] we can't use k.lower() as we are loading Flask configuration
                # keys which are expected to be capitalized
                setattr(cfg, k, v)

        # adjust paths
        if False == os.path.isabs(cfg.root_path):
            cfg.root_path = os.path.abspath(cfg.root_path)

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
