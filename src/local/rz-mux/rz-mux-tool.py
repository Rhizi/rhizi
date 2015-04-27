"""
 Multiplexed-Rhizi instance configuration generator:
    - setup Neo4J domain instance
    - setup Rhizi domain instance
"""
import argparse
from jinja2 import Environment, FileSystemLoader
import os
import pwd
import random


class Template_Task():

    def __init__(self, template_path, dst_path, kv_set):
        self.jinja_tmpl = env.get_template(template_path)
        self.dst_path = dst_path
        self.kv_set = kv_set

    def do_exec(self):

        dst_dir = os.path.dirname(self.dst_path)
        if not os.path.exists(dst_dir):
            print('rz-mux-tool: warning: target dir missing, installing: %s, please adjust usr/grp' % (dst_dir))
            os.makedirs(dst_dir)

        with open(self.dst_path, 'w') as f_out:
            f_out.write(self.jinja_tmpl.render(**self.kv_set))

            print('rz-mux-tool: generated: %s' % (f_out.name))

def gen_dom_config__neo4j(domain_name):
    """
    Generate domain-specific neo4j configuration file set
    """

    neo4j_template_path_prefix = 'neo4j-conf-template.d'
    target_dir = os.path.join('etc/neo4j/instance-conf.d', args.domain)
    port_seed = 10000 + random.randint(1000, 9990)

    conf_task_set = [Template_Task(os.path.join(neo4j_template_path_prefix, 'neo4j-server.properties.jinja'),
                                   os.path.join(install_prefix, target_dir, 'neo4j-server.properties'),
                                   {'org_neo4j_server_webserver_https_port': port_seed,
                                    'org_neo4j_server_webserver_port': port_seed + 1}),
                     Template_Task(os.path.join(neo4j_template_path_prefix, 'neo4j.properties.jinja'),
                                   os.path.join(install_prefix, target_dir, 'neo4j.properties'),
                                   {'remote_shell_port': port_seed + 2}),
                     Template_Task(os.path.join(neo4j_template_path_prefix, 'neo4j-service_deomain-init-script.jinja'),
                                   os.path.join(install_prefix, 'etc/init.d/', 'neo4j-service__%s' % (domain_name)),
                                   {'domain_name': domain_name}),
                     ]

    for conf_task_obj in conf_task_set:
        conf_task_obj.do_exec()

def gen_dom_config__apache(domain_name):
    """
    Generate domain-specific neo4j configuration file set
    """
    apache_template_path_prefix = 'apache-conf-template.d'
    rhizi_top_domain_name = 'rhizi.net'
    domain_fqdn = '%s.%s' % (domain_name, rhizi_top_domain_name)

    conf_task_set = [Template_Task(os.path.join(apache_template_path_prefix, 'x.%s.conf' % (rhizi_top_domain_name)),
                                   os.path.join(install_prefix, 'etc/apache/sites-available', domain_fqdn),
                                   {'domain_name': domain_name}),
                     ]

    for conf_task_obj in conf_task_set:
        conf_task_obj.do_exec()

def gen_dom_config__rhizi(domain_name):
    pass

if __name__ == '__main__':
    global env
    global install_prefix

    p = argparse.ArgumentParser(description='rz-cli tool')
    p.add_argument('-d', '--domain', required=True, help='target domain name')
    p.add_argument('--install-prefix', default='/', help='install dir path prefix, default=\'/\'')
    p.add_argument('--template-dir', default='conf-template.d', help='path to template dir')  # default devied from installed pkg layout
    args = p.parse_args()

    install_prefix = args.install_prefix

    env = Environment(loader=FileSystemLoader(args.template_dir))
    gen_dom_config__neo4j(domain_name=args.domain)
    gen_dom_config__apache(domain_name=args.domain)
