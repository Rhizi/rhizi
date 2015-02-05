#!/usr/bin/python2.7

"""
Import CSV files into Rhizi Server via pythonic API.

Tricky, since this is the only API user. Try to use it exactly as the REST/WS
API would, just without actually creating a socket connection.
"""

import sys
import os
import argparse
import string
import csv

root = os.path.join(os.path.dirname(__file__), '..', '..')
sys.path.append(os.path.join(root, 'src', 'server'))

from rz_api_common import sanitize_input__topo_diff
from rz_kernel import RZ_Kernel
import db_controller as dbc
from rz_server import Config

from model.graph import Topo_Diff

def topo_diff_json(node_set_add=[], link_set_add=[]):
    topo_diff_dict = ({
         u'link_id_set_rm': [],
         u'link_set_add': link_set_add,
         u'drop_conjugator_links': True,
         u'node_set_add': node_set_add,
         u'node_id_set_rm': []
        })
    topo_diff = Topo_Diff.from_json_dict(topo_diff_dict)
    sanitize_input__topo_diff(topo_diff)
    return topo_diff;

cfg = Config.init_from_file(os.path.join(root, 'res', 'etc', 'rhizi-server.conf'))
kernel = RZ_Kernel()
kernel.db_ctl = dbc.DB_Controller(cfg) # yes, that. FIXME
ctx = {} # FIXME not logged it - fix later (also, don't do this here, put constructor in kernel)

def commit(topo_diff):
    _, commit_ret = kernel.diff_commit__topo(topo_diff, ctx)

# Rhizi constants - FIXME use API
PERSON_LABEL = 'Person'
INTEREST_LABEL = 'Interest'
LABEL_SET = '__label_set'

# CSV file columns
PERSONAL_EMAIL = 'Personal e-mail'
INTEREST = 'Interests'

id_count = 0
def next_id():
    global id_count
    id_count += 1
    return '%08d' % id_count

def node_dict(the_id, **args):
    """ FIXME use API """
    ret = dict(args)
    ret['id'] = the_id
    return ret

def link_dict(source_id, target_id, label, the_id):
    return ({
               u'__type': [label],
               u'__src_id': source_id,
               u'__dst_id': target_id,
               u'id': the_id
           })

class CSV(object):
    def __init__(self, filename):
        rows = list(csv.reader(open(filename), 'excel-tab'))
        headers = rows[0]
        self.parse_headers(headers)
        #import pdb; pdb.set_trace()
        self.rows = rows[1:]
        self.row_dicts = map(lambda fields: dict(zip(headers, fields)), self.rows)

    def run(self):
        self.nodes_dict = {}
        self.node_set_add = []
        self.link_set_add = []
        self.generate_nodes_and_links()
        #for node in node_set_add:
        #    print('committing %s' % repr(node))
        #    commit(topo_diff_json(node_set_add=[node]))
        commit(topo_diff_json(node_set_add=self.node_set_add))
        commit(topo_diff_json(link_set_add=self.link_set_add))

    def append_id_node(self, the_id, node):
        print(repr(node))
        self.nodes_dict[the_id] = node
        self.node_set_add.append(node)
        return the_id

    def _csv_row_to_node(self, d, dict_gen):
        the_id = next_id()
        print(repr(d))
        return the_id, node_dict(the_id=the_id, **dict_gen(d))

    def append_link(self, source_id, target_id, label):
        the_id = next_id()
        link = link_dict(source_id, target_id, label, the_id)
        self.link_set_add.append(link)
        print(repr(link))
        return the_id

class StudentCSV(CSV):

    def interests(self, d):
        return d[self.interestsField]

    def generate_nodes_and_links(self):
        for d in self.row_dicts:
            d[self.interestsField] = map(string.strip, d[self.interestsField].split(','))
            person_id = next_id()
            person_node = node_dict(the_id=person_id,
                                **{'name':' '.join([d[self.firstNameField], d[self.lastNameField]]),
                                LABEL_SET:[PERSON_LABEL]})
            self.append_id_node(person_id, person_node)
            for interest in self.interests(d):
                interest_id = next_id()
                interest_node = node_dict(the_id=interest_id,
                    **{'name':interest, LABEL_SET:[INTEREST_LABEL]})
                interest_id = self.append_id_node(interest_id, interest_node)
                self.append_link(person_id, interest_id, 'Is interested in')

    def parse_headers(self, headers):
        self.firstNameField = headers[0]
        self.lastNameField = headers[1]
        self.personalEmailField = headers[2]
        self.interestsField = headers[3]

assert(len(sys.argv) == 2)
clazz = StudentCSV
filename = sys.argv[-1]
clazz(filename).run()
