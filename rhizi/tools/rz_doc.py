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

import argparse  # TODO - use the newer / shorter argument parser. y?
from collections import namedtuple
import json
import os
import uuid

from ..model.graph import Topo_Diff
from ..rz_file import RZFile
from .. import rz


kernel = None


def clone(rzdoc_name):
    global kernel
    return kernel.rzdoc__clone(kernel.rzdoc__lookup_by_name(rzdoc_name))


def create(rzdoc_name, clone):
    """
    create a new document with @rzdoc_name with a single commit clone.

    Missing:
        this loses all the history.
        no user recorded for newly created doc
    """
    global kernel
    destination = kernel.rzdoc__create(rzdoc_name)
    ctx = namedtuple('Context', ['user_name', 'rzdoc'])(None, destination)
    kernel.diff_commit__topo(clone, ctx)


def names():
    global kernel
    return [v['name'] for v in kernel.rzdoc__list()]


def create_id():
    return uuid.uuid4().get_hex()[:8]


def merge_topos(topos, names):
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
            name = node['name'].lower()
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

    for topo, name in zip(topos, names):
        print("merging %s" % name)
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
    global kernel
    if sources == None:
        sources = names()
    docs = [kernel.rzdoc__lookup_by_name(name) for name in sources]
    topos = [kernel.rzdoc__clone(doc) for doc in docs]
    create(destination_name, merge_topos(topos, sources))


def remove(rzdoc_name):
    global kernel
    kernel.rzdoc__delete(kernel.rzdoc__lookup_by_name(rzdoc_name))


def rename(cur_name, new_name):
    global kernel
    kernel.rzdoc__rename(cur_name, new_name)


def noeol(line):
    if len(line) == 0:
        return line
    return line[:-1] if line[-1] == '\n' else line


def dump(document_names):
    global kernel
    if document_names is None:
        # dump everything
        document_names = [d['name'].encode('utf-8') for d in kernel.rzdoc__search('')]
        print("dumping {}".format(document_names))
    print(RZFile(kernel).dump(document_names))


def main():
    global kernel
    p = argparse.ArgumentParser(description="rhizi command line interface")
    p.add_argument('--config-dir', help='path to Rhizi config dir', default=None)
    p.add_argument('--list-names', default=False, action='store_true')
    p.add_argument('--list-table', default=False, action='store_true')
    p.add_argument('--delete', help='doc name to delete')
    p.add_argument('--merge-target', help='name of resulting rzdoc')
    p.add_argument('--merge', help='comma separated names of docs to merge')
    p.add_argument('--merge-file', help='filename with line per doc name')
    p.add_argument('--clone', help='dump contents of doc as clone json')
    p.add_argument('--dump-single', help='dump a single document as json with all the associated data, including commit history')
    p.add_argument('--create', help='create a single doc from a dumped clone json')
    p.add_argument('--create-name', help='name of document to create')
    p.add_argument('--rename-from', help='rename current name')
    p.add_argument('--rename-to', help='rename new name')
    p.add_argument('--dump-all', action='store_true', default=False, help='dump all documents')
    p.add_argument('--load', help='load a previous dump (both single and all produce the same format)')
    args = p.parse_args()

    if args.config_dir is None:
        for d in ['res/etc', '/etc/rhizi']:
            if os.path.exists(d):
                args.config_dir = d
                break
    RZ = rz.RZ(args.config_dir)
    kernel = RZ.kernel
    if args.list_table:
        print('\n'.join('%30s %30s' % (d['name'].encode('utf-8').ljust(30),
                                       d['id'].encode('utf-8').ljust(30)) for d in kernel.rzdoc__search('')))
        raise SystemExit
    if args.list_names:
        print('\n'.join(d['name'].encode('utf-8') for d in kernel.rzdoc__search('')))
        raise SystemExit
    if args.delete:
        remove(args.delete)
    if args.rename_from and args.rename_to:
        rename(args.rename_from, args.rename_to)
    if args.clone:
        print(json.dumps(clone(args.clone).to_json_dict()))
    if args.create and args.create_name:
        with open(args.create) as fd:
            data = json.load(fd)
            create(args.create_name, Topo_Diff.from_json_dict(json.load(fd)))
    if args.merge_target:
        merge_sources = None
        if args.merge:
            merge_sources = args.merge.split(',')
        if args.merge_file:
            with open(args.merge_file) as fd:
                merge_sources = [noeol(line) for line in fd.readlines()]
        if merge_sources:
            merge(args.merge_target, merge_sources)
    if args.dump_single:
        dump([args.dump_single])
    if args.dump_all:
        dump(None)
    if args.load:
        load(args.load)
