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


#!/bin/env python

"""
Convert sage.csv to a loadable file. Here is our current 'file format':

json dictionary with two keys:
'nodes' is a list of dictionaries, each containing
'state': 'perm' (should not be required, try without it)
'id': must be unique
'name': display only (will be used as id if it is missing, true that?)
'type': for gannt should be 'deliverable'
'start': a date for 'deliverable' typed nodes
'end': a date for 'deliverable' typed nodes
'status': one of 'done', 'current', 'waiting' for 'deliverable' type

'links is a list of dictionaries with mandatory keys:
'name'
'source': id (string)
'target' id (string)
"""
import json
import csv
import random
from datetime import datetime, timedelta
from time import mktime

class MyEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, datetime):
            return int(mktime(obj.timetuple()))
        return json.JSONEncoder.default(self, obj)

def write_json(output_filename, nodes, links):
    seen_ids = set()
    assert(type(nodes) == list)
    assert(type(links) == list)
    for node in nodes:
        assert(type(node) == dict)
        assert('id' in node)
        assert(node['id'] not in seen_ids)
        seen_ids.add(node['id'])
        assert('name' in node)
    for link in links:
        assert(type(link) == dict)
        assert('name' in link)
        assert('source' in link)
        assert('target' in link)
    with open(output_filename, 'w+') as fd:

        json.dump({'nodes': nodes, 'links':links}, fd,
                  cls=MyEncoder)

def read_sage_csv():
    week = timedelta(days=7)
    day = timedelta(days=1)
    all_start = datetime(year=2018, month=1, day=1)
    lines = list(csv.reader(open('sage.csv')))
    assert(['id', 'name', 'dependent on'] == lines[0])
    del lines[0]
    nodes = [{'id': num, 'name': desc,
              'type': 'deliverable',
              'start': all_start + week * i,
              'end': all_start + week * i + day * (((i * 33) % 17) + 1),
              'status': random.choice(['unknown', 'done', 'current', 'waiting']),
              } for i, (num, desc, _) in enumerate(lines)]
    links = []
    for num, desc, deps in lines:
        deps = deps.split(',')
        if len(deps) == 0:
            continue
        for dep in deps:
            links.append({'source': num, 'target': dep, 'name': 'depends on'})
    return nodes, links

if __name__ == '__main__':
    nodes, links = read_sage_csv()
    write_json('sage.json', nodes, links)
