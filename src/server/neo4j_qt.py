from neo4j_cypher import Query_Struct_Type, DB_Query
from neo4j_util import rzdoc__ns_label, rzdoc__meta_ns_label
from neo4j_cypher_parser import p_path, p_node
from db_op import DBO_rzdoc__clone, DB_op
import re
import neo4j_schema

class Query_Transformation(object):
    """
    DB_op / DB_Query transformation
    """

    def __call__(self, value):
        """
        Apply transformation to either a DB_op or a DB_Query
        """
        if isinstance(value, DB_Query):
            return self.apply_to_db_op(value)
        if isinstance(value, DB_op):
            return self.apply_to_db_op(value)

    def apply_to_db_op(self, op):
        for dbq in op: # apply to sub queries
            self.apply_to_single_query(dbq)
        return op

    def apply_to_single_query(self, dbq): pass # subclass hook

class QT_RZDOC_NS_Filter__common(Query_Transformation):
    """
    Add RZDoc name-space filter:
       - inject NS labels into node patterns
       - [!] ignore nodes which are part of path patterns to avoid overriding bound references
    """

    def __init__(self, ns_label):
        self.ns_label = ns_label

    def deco__process_q_ret__n_label_set(self, label_set):
        ret = [lbl for lbl in label_set if lbl != self.ns_label]
        return ret

    def apply_to_db_op(self, op):
        ret = Query_Transformation.apply_to_db_op(self, op)

        # override DBO_rzdoc__clone.process_q_ret__n_label_set hook
        if op.__class__ == DBO_rzdoc__clone:
            op.process_q_ret__n_label_set = self.deco__process_q_ret__n_label_set

        return ret

    def apply_to_single_query(self, dbq):
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
            n_exp_set = c.sub_exp_set_by_type(p_node, recurse=True)
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
