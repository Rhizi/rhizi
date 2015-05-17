"""
Neo4j DB object
"""

from enum import Enum
import logging

from neo4j_cypher_parser import Cypher_Parser, e_clause__where, e_keyword, \
    e_value
import neo4j_cypher_parser
import neo4j_schema


log = logging.getLogger('rhizi')

class Query_Struct_Type(Enum):
    unknown = 1
    r = 2
    w = 3
    rw = 4

    def __add__(self, other):
        if self == other or self == Query_Struct_Type.rw:
            return self
        if self == Query_Struct_Type.unknown:
            return other
        if self == Query_Struct_Type.r and other != Query_Struct_Type.r:
            return Query_Struct_Type.rw
        if self == Query_Struct_Type.w and other != Query_Struct_Type.w:
            return Query_Struct_Type.rw

    def __str__(self):
        if self == Query_Struct_Type.unknown: return 'unknown'
        if self == Query_Struct_Type.r: return 'r'
        if self == Query_Struct_Type.w: return 'w'
        if self == Query_Struct_Type.rw: return 'rw'
        assert False

    def __eq__(self, other):  # allow comparing against r/w/rw strings
        mappings = {'r': Query_Struct_Type.r, 'w':Query_Struct_Type.w , 'rw':Query_Struct_Type.rw}
        if other in mappings.keys():
            other = mappings[other]
        if not isinstance(other, Query_Struct_Type): return False
        return super(Query_Struct_Type, self).__eq__(other)



class DB_Query(object):
    """
    DB query object
    """

    def __init__(self, q_arr, param_set={}):
        """
        @param q_str_or_array: cypher query to add - if passed as an array ' '.join(q_str_or_array)
        is used to convert it to string type
        """
        assert type(q_arr) is list

        # establish query type
        self.q_str = ' '.join(q_arr)  # FIXME: rm
        self.pt_root = Cypher_Parser().parse_expression(self.q_str)
        self.param_set = param_set

    def __str__(self):
        return self.pt_root.str__cypher_query()

    def __repr__(self):
        return 'q: %s, params: %s\n%s' % (self.pt_root.str__cypher_query(),
                                          self.param_set,
                                          self.pt_root.str__struct_tree())

    def __iter__(self):
        for keyword, clause_set in self.pt_root.index__kw_to_clause_set().items():
            yield keyword, clause_set

    def t__add_node_filter__meta_label(self):

        if Query_Struct_Type.w == self.query_struct_type:
            return

        meta_label_cond = '0 = length(filter(_lbl in labels(n) where _lbl in {meta_label_set}))'  # filter nodes with meta labels

        c_set__where = self.pt_root.clause_set_by_kw('where')

        if not c_set__where:
            c_set__match = self.pt_root.clause_set_by_kw('match')

            first_match_clause = c_set__match.pop()
            wc = first_match_clause.spawn_sibling__adjacent(e_clause__where)
            wc.spawn_child(e_keyword, 'where')
            wc.spawn_child(e_value).value = meta_label_cond
        else:  # where clause present
            assert len(c_set__where) == 1, 't__add_node_filter__meta_label: no support for multi-where clauses query transformation'
            wc = c_set__where[0]
            wc_cond = wc.condition_value
            wc.set_condition(meta_label_cond + ' and ' + wc_cond)

        self.param_set['meta_label_set'] = neo4j_schema.meta_label_set

    @property
    def query_struct_type(self):
        """
        calc query_structure_type: read|write|read-write
        """
        r = False
        w = False
        for kw, _clause_set in self.pt_root.index__kw_to_clause_set().items():
            if kw in neo4j_cypher_parser.tok_set__kw__write:
                w = True
            if kw == 'match':
                r = True

        if r and w: return Query_Struct_Type.rw
        if r and not w: return Query_Struct_Type.r
        if w and not r: return Query_Struct_Type.w
        return Query_Struct_Type.unknown

    def str__cypher_query(self):
        return self.pt_root.str__cypher_query()

class DB_Raw_Query(object):
    """
    Raw DB query object which does not undergo parsing
    """

    def __init__(self, q_arr, param_set={}):
        self.q_arr = q_arr
        self.param_set = param_set

    def __iter__(self):
        for keyword, clause_set in self.pt_root.index__kw_to_clause_set().items():
            yield keyword, clause_set

    def str__cypher_query(self):
        return ' '.join(self.q_arr)

class DB_row(object):
    def __init__(self, data):
        self.data = data

    def __iter__(self):
        for column_val in self.data:
            yield column_val

    def items(self):
        return [x for x in self]

    def __str__(self):
        return str(self.items())

    def __repr__(self):
        return repr(self.items())

class DB_result_set(object):
    def __init__(self, data):
        self.data = data

    def __iter__(self):
        for db_row_dict in self.data['data']:
            # example: dict: {u'row': [{u'title': u'foo'}]}
            assert None != db_row_dict['row']

            yield DB_row(db_row_dict['row'])

    def items(self):
        return [x for x in self]
