#!/usr/bin/python

import argparse # TODO - use the newer / shorter argument parser. y?
from collections import namedtuple
import json
import uuid

from neo4j_util import generate_random_id__uuid
from rz_server import init_config
from rz_kernel import RZ_Kernel
from model.graph import Topo_Diff
import db_controller as dbc

def clone(rzdoc_name):
    return kernel.rzdoc__clone(kernel.rzdoc__lookup_by_name(rzdoc_name))

def names():
    return [v['name'] for v in kernel.rzdoc__list()]

def create_id():
    return uuid.uuid4().get_hex()[:8]

def merge_topos(topos):
    """
    Merge a number of Topo_Diff's

    result node set is union of nodes
    conflicting nodes:
        same name nodes take the first (id wise)
        attributes: take the first
    result link set is merged (well defined: replace dropped id by chosen id in all links)
    """
    result = Topo_Diff()
    node_names = dict()
    node_ids = set()
    dropped_nodes = set()
    links_src_dst = set()

    def rename(links, from_id, to_id):
        for link in links:
            if link['__src_id'] == from_id:
                link['__src_id'] = to_id
            if link['__dst_id'] == from_id:
                link['__dst_id'] = to_id

    def merge(topo):
        links = topo.link_set_add
        nodes = topo.node_set_add
        new_nodes = []
        for node in nodes:
            name = node['name']
            if name in node_names:
                dropped_nodes.add(node['name'])
                rename(links, node['id'], node_names[name]['id'])
            else:
                node_names[name] = node
                new_nodes.append(node)
                node_ids.add(node['id'])
        new_links = []
        for link in links:
            k = (link['__src_id'], link['__dst_id'])
            if k not in links_src_dst:
                links_src_dst.add(k)
                new_links.append(link)
        if len(dropped_nodes) > 0:
            print("dropped duplicate nodes count: %s" % len(dropped_nodes))
        if len(new_links) != len(links):
            print("dropped duplicate links count: %s" % (len(links) - len(new_links)))
        print("adding %s nodes, %s links" % (len(new_nodes), len(new_links)))
        result.node_set_add.extend(new_nodes)
        result.link_set_add.extend(new_links)

    for topo in topos:
        merge(topo)
    # now realloc all ids since otherwise they are duplicates of originals
    renames = [(node['id'], create_id()) for node in result.node_set_add]
    def show(word):
        print("=" * 80)
        print(word)
        print(result.node_set_add)
        print(result.link_set_add)
    for src, dst in renames:
        rename(result.link_set_add, src, dst)
    for node, (_, new_id) in zip(result.node_set_add, renames):
        node['id'] = new_id
    return result

def merge(destination_name, sources=None):
    if sources == None:
        sources = names()
    docs = [kernel.rzdoc__lookup_by_name(name) for name in sources]
    topos = [kernel.rzdoc__clone(doc) for doc in docs]
    destination = kernel.rzdoc__create(destination_name)

    ctx = namedtuple('Context', ['user_name', 'rzdoc'])(None, destination)
    kernel.diff_commit__topo(merge_topos(topos), ctx)

def remove(rzdoc_name):
    kernel.rzdoc__delete(kernel.rzdoc__lookup_by_name(rzdoc_name))

if __name__ == '__main__':
    p = argparse.ArgumentParser(description="rhizi command line interface")
    p.add_argument('--config-dir', help='path to Rhizi config dir', default='res/etc')
    p.add_argument('--list-names', default=False, action='store_true')
    p.add_argument('--list-table', default=False, action='store_true')
    p.add_argument('--delete', help='doc name to delete')
    p.add_argument('--merge-target', help='name of resulting rzdoc')
    p.add_argument('--merge', help='comma separated names of docs to merge')
    p.add_argument('--merge-file', help='filename with line per doc name')
    p.add_argument('--clone', help='show contents of doc')
    args = p.parse_args()
    
    cfg = init_config(args.config_dir)
    kernel = RZ_Kernel()
    db_ctl = dbc.DB_Controller(cfg)
    kernel.db_ctl = db_ctl
    if args.list_table:
        print('\n'.join('%30s %30s' % (d['name'].ljust(30), d['id'].ljust(30)) for d in kernel.rzdoc__list()))
        raise SystemExit
    if args.list_names:
        print('\n'.join(d['name'] for d in kernel.rzdoc__list()))
        raise SystemExit
    if args.delete:
        remove(args.delete)
    if args.clone:
        print(json.dumps(clone(args.clone).to_json_dict()))
    if args.merge_target:
        merge_sources = None
        if args.merge:
            merge_sources = args.merge.split(',')
        if args.merge_file:
            with open(args.merge_file) as fd:
                merge_sources = [line.strip() for line in fd.readlines()]
        if merge_sources:
            merge(args.merge_target, merge_sources)
