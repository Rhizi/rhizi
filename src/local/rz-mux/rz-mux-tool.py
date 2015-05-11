"""
 Multiplexed-Rhizi instance configuration generator:
    - generate Apache instance configuration files
    - generate Neo4J instance,  instance configuration files
    - generate Rhizi instance configuration files

 This tool currently does not handle module confdir/rootdir creation, file mode/ownership creation,
 which are handled by the .sh accompanying shell script.
"""
import argparse
from jinja2 import Environment, FileSystemLoader
import os
import pwd
import random
import uuid

class Config(object): pass

class Template_Task():

    def __init__(self, template_path, dst_path, kv_set):
        self.jinja_tmpl = env.get_template(template_path)
        self.dst_path = dst_path
        self.kv_set = kv_set

    def do_exec(self):

        with open(self.dst_path, 'w') as f_out:
            f_out.write(self.jinja_tmpl.render(**self.kv_set))

            print('rz-mux-tool: generated: %s' % (f_out.name))

def gen_dom_config__neo4j(domain_fqdn, cfg):
    """
    Generate domain-specific neo4j configuration file set
    """

    neo4j_template_path_prefix = 'neo4j-conf-template.d'
    target_dir = os.path.join('etc/neo4j/mux-conf.d', args.domain)

    conf_task_set = [Template_Task(os.path.join(neo4j_template_path_prefix, 'neo4j-server.properties.jinja'),
                                   os.path.join(install_prefix, target_dir, 'neo4j-server.properties'),
                                   {'org_neo4j_server_webserver_https_port': cfg.neo4j_port__https,
                                    'org_neo4j_server_webserver_port': cfg.neo4j_port__http}),
                     Template_Task(os.path.join(neo4j_template_path_prefix, 'neo4j.properties.jinja'),
                                   os.path.join(install_prefix, target_dir, 'neo4j.properties'),
                                   {'remote_shell_port': cfg.neo4j_port__shell}),
                     Template_Task(os.path.join(neo4j_template_path_prefix, 'neo4j-service_deomain-init-script.jinja'),
                                   os.path.join(install_prefix, 'etc/init.d/', 'neo4j-service__%s' % (domain_fqdn)),
                                   {'domain_fqdn': domain_fqdn}),
                     ]

    for conf_task_obj in conf_task_set:
        conf_task_obj.do_exec()

def gen_dom_config__apache(domain_fqdn, cfg):
    """
    Generate domain-specific neo4j configuration file set
    """
    apache_template_path_prefix = 'apache-conf-template.d'
    rhizi_top_domain_fqdn = 'rhizi.net'

    conf_task_set = [Template_Task(os.path.join(apache_template_path_prefix, 'x.%s.conf' % (rhizi_top_domain_fqdn)),
                                   os.path.join(install_prefix, 'etc/apache2/sites-available', domain_fqdn + '.conf'),
                                   {'domain_fqdn': domain_fqdn,
                                    'rz_port__http': cfg.rz_port__http}),
                     ]

    for conf_task_obj in conf_task_set:
        conf_task_obj.do_exec()

def gen_dom_config__rhizi(domain_fqdn, cfg):
    rz_template_path_prefix = 'rhizi-conf-template.d'

    rz_server_secret = str(uuid.uuid4()).replace('-', '')
    root_path = os.path.join('/srv/www/rhizi/mux-root.d/', domain_fqdn, 'webapp')
    user_db_path = os.path.join('/srv/www/rhizi/mux-root.d/', domain_fqdn, 'auth', 'user_db.db')

    conf_task_set = [Template_Task(os.path.join(rz_template_path_prefix, 'rhizi-server.conf.jinja'),
                                   os.path.join(install_prefix, 'etc/rhizi/mux-conf.d', domain_fqdn, 'rhizi-server.conf'),
                                   {'access_control': cfg.access_control,
                                    'domain_fqdn': domain_fqdn,
                                    'neo4j_port__http': cfg.neo4j_port__http,
                                    'root_path': root_path,
                                    'rz_port__http': cfg.rz_port__http,
                                    'rz_server_secret': rz_server_secret,
                                    'user_db_path': user_db_path,
                                    }),
                     Template_Task(os.path.join(rz_template_path_prefix, 'rhizi.init.jinja'),
                                   os.path.join(install_prefix, 'etc/init.d/', 'rhizi__%s' % (domain_fqdn)),
                                   {'domain_fqdn': domain_fqdn}),
                     Template_Task(os.path.join(rz_template_path_prefix, 'rhizi-cron-bkp.daily.sh.jinja'),
                                   os.path.join(install_prefix, 'etc/cron.daily/', 'rhizi__%s' % (domain_fqdn)),
                                   {'domain_fqdn': domain_fqdn,
                                    'neo4j_port__shell': cfg.neo4j_port__shell}),
                     ]

    for conf_task_obj in conf_task_set:
        conf_task_obj.do_exec()

if __name__ == '__main__':
    global env
    global install_prefix

    p = argparse.ArgumentParser(description='rz-cli tool')
    p.add_argument('-d', '--domain', required=True, help='target domain name')
    p.add_argument('--install-prefix', default='/', help='install dir path prefix, default=\'/\'')
    p.add_argument('--template-dir', default='.', help='path to template dir')  # default devied from installed pkg layout
    p.add_argument('--rz_config__disable_access_control', action='store_const', const=True, default=False)
    args = p.parse_args()

    env = Environment(loader=FileSystemLoader(args.template_dir))
    install_prefix = args.install_prefix
    domain_fqdn = args.domain

    #
    # generate optimistic-collision-avoiding instance port map
    #
    port_seed = 1000 + random.randint(0, pow(2, 16) - 1000 - 10)
    cfg = Config()
    cfg.neo4j_port__https = port_seed + 0  # REST API port
    cfg.neo4j_port__http = port_seed + 1
    cfg.neo4j_port__shell = port_seed + 2
    cfg.rz_port__http = port_seed + 3
    cfg.access_control = False if args.rz_config__disable_access_control else True

    gen_dom_config__neo4j(domain_fqdn, cfg)
    gen_dom_config__rhizi(domain_fqdn, cfg)
    gen_dom_config__apache(domain_fqdn, cfg)
