"""
Neo4j DB object
"""

from enum import Enum
from neo4j_cypher_parser import Cypher_Parser, e_clause__where, e_keyword, \
    e_value, e_label_set, p_node, p_path, e_ident, p_rel
import re
import logging
import neo4j_cypher_parser
from decorator import __call__


log = logging.getLogger('rhizi')

class Query_Struct_Type(Enum):
    unkown = 1
    r = 2
    w = 3
    rw = 4

    def __add__(self, other):
        if self == other or self == Query_Struct_Type.rw:
            return self
        if self == Query_Struct_Type.unkown:
            return other
        if self == Query_Struct_Type.r and other != Query_Struct_Type.r:
            return Query_Struct_Type.rw
        if self == Query_Struct_Type.w and other != Query_Struct_Type.w:
            return Query_Struct_Type.rw

    def __str__(self):
        if self == Query_Struct_Type.unkown: return 'unkown'
        if self == Query_Struct_Type.r: return 'r'
        if self == Query_Struct_Type.w: return 'w'
        if self == Query_Struct_Type.rw: return 'rw'
        assert False

    def __eq__(self, other):  # allow comparing against r/w/rw strings
        if other in ['r', 'w', 'rw']:
            if self == Query_Struct_Type.r and other == 'r': return True
            if self == Query_Struct_Type.w and other == 'w': return True
            if self == Query_Struct_Type.rw and other == 'rw': return True
        if not isinstance(other, Query_Struct_Type): return False
        return super(Query_Struct_Type, self).__eq__(other)


class Query_Transformation(object):
    """
    A query transformation, which may be applied to either a DB_op or a DB_Query
    """

    def __call__(self, value):

        q_set = []

        if isinstance(value, DB_Query):
            q_set.append(value)
        else:  # assume iterable
            assert hasattr(value, '__iter__')

            for dbq in value:
                assert isinstance(dbq, DB_Query)

                q_set.append(dbq)

        for dbq in q_set:
            log.debug('%r' % (dbq))
            self.apply_to_single_query(dbq)
            log.debug('%r' % (dbq))

        return value

    def apply_to_single_query(self, dbq):
        pass

class QT_RZDOC_NS_Filter__common(Query_Transformation):
    """
    Add RZDoc name-space filter:
       - inject NS labels into node patterns
       - [!] ignore nodes which are part of path patterns to avoid overriding bound references

    
    """

    def __init__(self, ns_label):
        self.ns_label = ns_label

    def apply_to_single_query(self, dbq):

        rgx__doc_label = re.compile(r'%s[\w\d_]+' % (neo4j_schema.META_LABEL__RZDOC_NS_PREFIX))
        assert None == rgx__doc_label.match(self.ns_label), 'Illegal doc ID label: %s' % (self.ns_label)  # validate doc label

        q_type = dbq.query_struct_type
        clause_set = []

        if Query_Struct_Type.w == q_type:
            clause_set += dbq.pt_root.clause_set_by_kw('create')
        if Query_Struct_Type.r == q_type:
            clause_set += dbq.pt_root.clause_set_by_kw('match')
        if Query_Struct_Type.rw == q_type:
            clause_set += dbq.pt_root.clause_set_by_kw('create')
            clause_set += dbq.pt_root.clause_set_by_kw('match')

        for c in clause_set:
            n_exp_set = c.sub_exp_set_by_type(p_node , recurse=True)
            for n_exp in n_exp_set:

                if n_exp.parent.__class__ == p_path:
                    continue;

                lbl_set = n_exp.label_set
                if not lbl_set:  # add label set if necessary
                    lbl_set = n_exp.spawn_label_set()
                lbl_set.add_label(self.ns_label)

            # log.debug('db_q trans: in clause: %s, out clause: %s' % (cur_clause, new_clause))

class QT_RZDOC_NS_Filter(QT_RZDOC_NS_Filter__common):

    def __init__(self, rzdoc):
        ns_label = rzdoc__ns_label(rzdoc)
        super(QT_RZDOC_NS_Filter, self).__init__(ns_label)

class QT_RZDOC_Meta_NS_Filter(QT_RZDOC_NS_Filter__common):

    def __init__(self, rzdoc):
        ns_label = rzdoc__meta_ns_label(rzdoc)
        super(QT_RZDOC_Meta_NS_Filter, self).__init__(ns_label)

class QT_Node_Filter__meta_label_set(Query_Transformation):
    # TODO: impl
    # 'where 0 = length(filter(_lbl in labels(n) where _lbl =~ \'^__.*$\'))',  # filter nodes with meta labels
    pass

class DB_Query(object):

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

        self.param_set['meta_label_set'] = meta_label_set

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
        return Query_Struct_Type.unkown

    def str__cypher_query(self):
        return self.pt_root.str__cypher_query()

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
