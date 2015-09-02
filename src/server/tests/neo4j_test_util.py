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


from random import choice
import string
import uuid

import sys
import inspect

from ..db_op import DB_op, DBO_raw_query_set
from .. import neo4j_cypher
from .. import neo4j_schema

class DBO_flush_db(DBO_raw_query_set):
    """
    complete DB flush: remove all nodes & links
    """
    def __init__(self):
        q_arr = ['match (n)',
                 'optional match (n)-[r]-()',
                 'delete n,r'
                ]
        super(DBO_flush_db, self).__init__(q_arr)

class DBO_random_data_generation(DB_op):

    def __init__(self, lim_n=128, lim_r=256, prob_link_create=0.3):
        """
        generate random DB data
        
        @return: tuple consisting of the random node,link labels generated
        """
        assert 2 <= lim_n

        super(DBO_random_data_generation, self).__init__()

        self.n_label = rand_label()
        self.r_label = rand_label()
        q_arr = ['with 0 as _',  # TODO clean: foreach triggers SyntaxException: otherwise
                 'foreach (rid in range(0,%d)' % (lim_n - 1),
                 '|',
                 'create (:%s {id: \'test-id_\' + toString(rid), n_attr_0:toInt(%d * rand())}))' % (self.n_label, lim_n)
                ]
        self.add_statement(q_arr)

        q_arr = ['match (s:%s),(d:%s)' % (self.n_label, self.n_label),
                 'with s,d',
                 'limit %d' % (lim_r - 1),
                 'where rand() < %.2f' % (prob_link_create),
                 'create (s)-[:%s {l_attr_0:toInt(%d * rand())}]->(d)' % (self.r_label, lim_r)]
        self.add_statement(q_arr)

    @property
    def node_set_label(self):
        return self.n_label

    @property
    def link_set_label(self):
        return self.r_label

def rand_label(prefix='T_', length=8):
    """
    return a prefixed random label, where the default prefix is 'T_'
    """
    char_set = string.ascii_lowercase + string.ascii_uppercase + string.digits
    ret = ''.join([choice(string.ascii_lowercase)] + [choice(char_set) for _ in range(length - 1)])
    ret = prefix + ret
    return ret

def rand_label__doc(length=8):
    return rand_label(prefix=neo4j_schema.META_LABEL__RZDOC_NS_PREFIX, length=length)
