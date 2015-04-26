"""
 Multiplexed-Neo4J instance configuration generator
"""
import argparse
from jinja2 import Environment, FileSystemLoader
import os
import random

def gen_neo4j_domain_config(target_dir, domain_name):
    """
    Generate domain-specific neo4j configuration file set
    """

    class Template_Task():
        def __init__(self, template_name, dst_path, kv_set):
            self.template_name = template_name
            self.dst_path = dst_path
            self.kv_set = kv_set

    port_seed = 10000 + random.randint(1000, 1990)
    conf_task_arr = [Template_Task('neo4j-server.properties.jinja',
                                   os.path.join(target_dir, 'neo4j-server.properties'),
                                   {'org_neo4j_server_webserver_https_port': port_seed,
                                    'org_neo4j_server_webserver_port': port_seed + 1}),
                     Template_Task('neo4j.properties.jinja',
                                   os.path.join(target_dir, 'neo4j.properties'),
                                   {'remote_shell_port': port_seed + 2}),
                     Template_Task('neo4j-service_deomain-init-script.jinja',
                                   '/etc/init.d/neo4j-service__%s' % (domain_name),
                                   {'domain_name': domain_name}),
                     ]

    for conf_task_obj in conf_task_arr:
        tmpl = env.get_template(conf_task_obj.template_name)

        with open(conf_task_obj.dst_path, 'w') as f_out:
            f_out.write(tmpl.render(**conf_task_obj.kv_set))
            print('neo4j-mux-tool: generated: %s' % (f_out.name))

    os.chmod('/etc/init.d/neo4j-service__%s' % (domain_name), 00755)

if __name__ == '__main__':
    global env

    p = argparse.ArgumentParser(description='rz-cli tool')
    p.add_argument('-d', '--domain', required=True, help='target domain name')
    args = p.parse_args()

    env = Environment(loader=FileSystemLoader('conf-template.d'))
    gen_neo4j_domain_config(target_dir=os.path.join('/etc/neo4j/instance-conf.d/%s/' % (args.domain)),
                     domain_name=args.domain)
