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

class Config__port_map(): pass

class Template_Task():

    def __init__(self, template_path, dst_path, kv_set):
        self.jinja_tmpl = env.get_template(template_path)
        self.dst_path = dst_path
        self.kv_set = kv_set

    def do_exec(self):

        with open(self.dst_path, 'w') as f_out:
            f_out.write(self.jinja_tmpl.render(**self.kv_set))

            print('rz-mux-tool: generated: %s' % (f_out.name))

def gen_dom_config__neo4j(domain_name, port_map):
    """
    Generate domain-specific neo4j configuration file set
    """

    neo4j_template_path_prefix = 'neo4j-conf-template.d'
    target_dir = os.path.join('etc/neo4j/mux-conf.d', args.domain)

    conf_task_set = [Template_Task(os.path.join(neo4j_template_path_prefix, 'neo4j-server.properties.jinja'),
                                   os.path.join(install_prefix, target_dir, 'neo4j-server.properties'),
                                   {'org_neo4j_server_webserver_https_port': port_map.neo4j_port__https,
                                    'org_neo4j_server_webserver_port': port_map.neo4j_port__http}),
                     Template_Task(os.path.join(neo4j_template_path_prefix, 'neo4j.properties.jinja'),
                                   os.path.join(install_prefix, target_dir, 'neo4j.properties'),
                                   {'remote_shell_port': port_map.neo4j_port__shell}),
                     Template_Task(os.path.join(neo4j_template_path_prefix, 'neo4j-service_deomain-init-script.jinja'),
                                   os.path.join(install_prefix, 'etc/init.d/', 'neo4j-service__%s' % (domain_name)),
                                   {'domain_name': domain_name}),
                     ]

    for conf_task_obj in conf_task_set:
        conf_task_obj.do_exec()

def gen_dom_config__apache(domain_name, port_map):
    """
    Generate domain-specific neo4j configuration file set
    """
    apache_template_path_prefix = 'apache-conf-template.d'
    rhizi_top_domain_name = 'rhizi.net'
    domain_fqdn = '%s.%s' % (domain_name, rhizi_top_domain_name)

    conf_task_set = [Template_Task(os.path.join(apache_template_path_prefix, 'x.%s.conf' % (rhizi_top_domain_name)),
                                   os.path.join(install_prefix, 'etc/apache2/sites-available', domain_fqdn + '.conf'),
                                   {'domain_name': domain_name,
                                    'rz_port__http': port_map.rz_port__http}),
                     ]

    for conf_task_obj in conf_task_set:
        conf_task_obj.do_exec()

def gen_dom_config__rhizi(domain_name, port_map):
    rz_template_path_prefix = 'rhizi-conf-template.d'
    rhizi_top_domain_name = 'rhizi.net'
    domain_fqdn = '%s.%s' % (domain_name, rhizi_top_domain_name)

    rz_server_secret = str(uuid.uuid4()).replace('-', '')
    root_path = os.path.join('/srv/www/rhizi/mux-root.d/', domain_name, 'webapp')
    user_db_path = os.path.join('/srv/www/rhizi/mux-root.d/', domain_name, 'auth', 'user_db.db')

    conf_task_set = [Template_Task(os.path.join(rz_template_path_prefix, 'rhizi-server.conf.jinja'),
                                   os.path.join(install_prefix, 'etc/rhizi/mux-conf.d', domain_name, 'rhizi-server.conf'),
                                   {'domain_name': domain_name,
                                    'neo4j_port__http': port_map.neo4j_port__http,
                                    'root_path': root_path,
                                    'rz_port__http': port_map.rz_port__http,
                                    'rz_server_secret': rz_server_secret,
                                    'user_db_path': user_db_path,
                                    }),
                     Template_Task(os.path.join(rz_template_path_prefix, 'rhizi.init.jinja'),
                                   os.path.join(install_prefix, 'etc/init.d/', 'rhizi__%s' % (domain_name)),
                                   {'domain_name': domain_name}),
                     Template_Task(os.path.join(rz_template_path_prefix, 'rhizi-cron-bkp.daily.sh.jinja'),
                                   os.path.join(install_prefix, '/etc/cron.daily/', 'rhizi__%s' % (domain_name)),
                                   {'domain_name': domain_name,
                                    'neo4j_port__shell': port_map.neo4j_port__shell}),
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
    args = p.parse_args()

    env = Environment(loader=FileSystemLoader(args.template_dir))
    install_prefix = args.install_prefix
    domain_name = args.domain

    #
    # generate optimistic-collision-avoiding instance port map
    #
    port_seed = 40000 + random.randint(1000, 9990)
    cfg_port_map = Config__port_map()
    setattr(cfg_port_map, 'neo4j_port__https', port_seed)  # REST API port
    setattr(cfg_port_map, 'neo4j_port__http', port_seed + 1)
    setattr(cfg_port_map, 'neo4j_port__shell', port_seed + 2)
    setattr(cfg_port_map, 'rz_port__http', 48000 + port_seed % 1000)

    gen_dom_config__neo4j(domain_name, cfg_port_map)
    gen_dom_config__rhizi(domain_name, cfg_port_map)
    gen_dom_config__apache(domain_name, cfg_port_map)
