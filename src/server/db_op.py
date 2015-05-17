from copy import deepcopy
import gzip
import hashlib
import logging
import re

from model.graph import Attr_Diff
from model.graph import Topo_Diff
from model.model import Link, RZDoc, RZCommit
from neo4j_cypher import DB_Query, DB_result_set, DB_Raw_Query
import neo4j_schema
from neo4j_util import cfmt
from neo4j_util import generate_random_id__uuid, rzdoc__ns_label, \
    quote__singlequote, rzdoc__meta_ns_label, quote__backtick
import neo4j_util as db_util


log = logging.getLogger('rhizi')

class DB_op(object):
    """
    Transaction (tx) wrapped DB operation possibly composing multiple DB queries
    """
    def __init__(self):
        self.query_set = []
        self.result_set = []
        self.error_set = None
        self.tx_id = None  # int
        self.tx_commit_url = None  # cached from response to tx begin

    def __iter__(self):
        for dbq in self.query_set:
            yield dbq

    def __repr__(self):
        return '%s: tx-id: %s' % (self.__class__.__name__, str(self.tx_id))  # id may be null if Tx open failed

    def iter__r_set(self):
        """
        iterate over (DB_Query index, DB_Query, result | error)
        where result & error are mutually exclusive

        note: index is zero based

        TODO: handle partial iteration due to error_set being non-empty
        """
        r_set_len = len(self.result_set)

        #
        # q_idx: statement index
        # dbq: db query
        # row-set: query result
        #
        for q_idx, dbq in enumerate(self.query_set):
            r_set = None
            if q_idx < r_set_len:  # support partial result recovery
                r_set = DB_result_set(self.result_set[q_idx])
            yield (q_idx, dbq, r_set)

    def add_db_query(self, db_q):

        assert type(db_q) == DB_Query

        self.query_set.append(db_q)
        return len(self.query_set)

    def add_statement(self, q_str_or_array, query_params={}):
        """
        add a DB query language statement

        @return: statement index (zero based)
        """
        db_q = DB_Query(q_str_or_array, query_params)
        return self.add_db_query(db_q)

    @property
    def name(self):
        return self.__class__.__name__

    def process_result_set(self):
        """
        DB op can issue complex sets of queries all at once - this helper method
        assists in parsing response data from a single query.
        """
        ret = []
        for _q_idx, _dbq, r_set in self.iter__r_set():
            for row in r_set:
                for col in row:
                    ret.append(col)
        return ret

    def parse_tx_id(self, tx_commit_url):
        m = re.search('/(?P<id>\d+)/commit$', tx_commit_url)
        id_str = m.group('id')
        self.tx_id = int(id_str)

class DBO_add_node_set(DB_op):

    def __init__(self, node_map):
        """
        DB op: add node set

        @param node_map: node-type to node-set map
        @return: set of new node DB ids
        """
        super(DBO_add_node_set, self).__init__()
        for q, q_param_set in db_util.gen_query_create_from_node_map(node_map):
            self.add_statement(q, q_param_set)

    def process_result_set(self):
        n_id_set = []
        for _, _, r_set in self.iter__r_set():
            for row in r_set:
                for ret_dict in row:
                    n_id_set.append(ret_dict['id'])

        return n_id_set

class DBO_add_link_set(DB_op):

    def __init__(self, link_map):
        """
        @param link_map: is a link-type to link-set map - see model.link
        @return: set of new link DB ids
        """
        super(DBO_add_link_set, self).__init__()
        for q, q_param_set in db_util.gen_query_create_from_link_map(link_map):
            self.add_statement(q, q_param_set)

    def process_result_set(self):
        l_id_set = []
        for _, _, r_set in self.iter__r_set():
            for row in r_set:
                for ret_dict in row:
                    l_id_set.append(ret_dict['id'])

        return l_id_set

class DB_composed_op(DB_op):
    """
    A DB_op composed of sup-operations with the intention of being able to 
    partially succeed in sub-op execution. This op class will reject addition 
    of direct query statements.
    
    Note: this class may be removed in future releases. 
    """
    def __init__(self):
        super(DB_composed_op, self).__init__()
        self.sub_op_set = []

    def __assert_false_statement_access(self):
        assert False, "composed_op may not contain statements, only sub-ops"

    def __getattribute__(self, attr):
        """
        intercept 'query_set' attr get
        """
        if attr == 'query_set':
            self.__assert_false_statement_access()

        return object.__getattribute__(self, attr)

    def __iter__(self):
        for s_op in self.sub_op_set:
            for dbq in s_op:
                yield dbq

    def add_statement(self, query, query_params={}):
        self.__assert_false_statement_access()

    def add_sub_op(self, op):
        self.sub_op_set.append(op)

    def iter__sub_op(self):
        for s_op in self.sub_op_set:
            yield s_op

    def post_sub_op_exec_hook(self, prv_sub_op, prv_sub_op_ret):
        """
        Called after each successful sub-op execution. Throwing an exception here
        will prevent the execution of the subsequent sub_op's.
        """
        pass

    def process_result_set(self):
        ret = []
        for s_op in self.sub_op_set:
            s_result_set = s_op.process_result_set()
            ret.append(s_result_set)
        return ret

class DBO_block_chain__commit(DB_op):
    """
    Rhizi version control
    """

    @staticmethod
    def calc_blob_hash(blob=''):
        """
        Calculate blog hash value
        """
        sha1 = hashlib.sha1()
        sha1.update(blob)
        ret = sha1.hexdigest()
        return ret

    def __init__(self, commit_obj=None, ctx=None, meta=None):
        """
        @param commit_obj: serializable blob

        @return: old_head, new_head, new_head.hash_value
        """
        super(DBO_block_chain__commit, self).__init__()

        blob = RZCommit.blob_from_diff_obj(commit_obj)
        hash_value = self.calc_blob_hash(blob)

        l_id = generate_random_id__uuid()

        q_arr = ['match (old_head:%s:%s)' % (neo4j_schema.META_LABEL__VC_HEAD,
                                             neo4j_schema.META_LABEL__VC_COMMIT),
                 'create (new_head:%s:%s {commit_attr})' % (neo4j_schema.META_LABEL__VC_HEAD,
                                                            neo4j_schema.META_LABEL__VC_COMMIT),
                 'create (new_head)-[r:%s {link_attr}]->(old_head)' % (neo4j_schema.META_LABEL__VC_PARENT),
                 'remove old_head:%s' % (neo4j_schema.META_LABEL__VC_HEAD),
                 'set new_head.ts_created=timestamp()',
                 'return {head_parent_commit: old_head, head_commit: new_head, ts_created: new_head.ts_created}'
                 ]

        q_param_set = {'commit_attr': {'blob': blob,
                                       'hash': hash_value,
                                       'id': hash_value},
                       'link_attr': {'id': l_id},
                       }

        self.add_statement(q_arr, q_param_set)

        # cache values necessary to generate op result
        self.commit_obj = commit_obj
        self.n_id = hash_value
        self.l_id = l_id

        # create commit-[:__Authored-by]->__User link if possible
        if None != ctx and None != ctx.user_name:
            self.add_statement(self._add_statement__authored_by(ctx.user_name))

        if None != meta and 'sentence' in meta and meta['sentence'] != '':
            self.add_statement(self._add_statement__result_of_sentence(ctx.user_name, meta['sentence']))

    def _add_statement__authored_by(self, user_name):
        return ['merge (n:%s {user_name: \'%s\'})' % (neo4j_schema.META_LABEL__USER, user_name),
                'with n',
                'match (m:%s)' % (neo4j_schema.META_LABEL__VC_HEAD),  # FIXME: specify commit-label index
                'create (m)-[r:`%s`]->(n)' % (neo4j_schema.META_LABEL__VC_COMMIT_AUTHOR),
                ]

    def _add_statement__result_of_sentence(self, user_name, sentence):
        return ['match (head:%s:%s)' % (neo4j_schema.META_LABEL__VC_HEAD,
                                        neo4j_schema.META_LABEL__VC_COMMIT),
                'create (head)-[r:%s]->(result_of:%s {sentence: \'%s\'} )' % (
                neo4j_schema.META_LABEL__VC_COMMIT_RESULT_OF,
                neo4j_schema.META_LABEL__VC_OPERATION,
                sentence,
                )]

    def process_result_set(self):
        """
        @return: a Topo_Diff object consisting of the commit node and parent link
        """
        ret = Topo_Diff()

        hash_parent = None
        hash_child = None
        ts_created = None
        for _, _, r_set in self.iter__r_set():
            for row in r_set:
                for ret_dict in row:

                    assert None == hash_parent  # assert hash values set once only
                    assert None == hash_child
                    assert None == ts_created

                    hash_parent = ret_dict['head_parent_commit']['hash']
                    hash_child = ret_dict['head_commit']['hash']
                    ts_created = ret_dict['ts_created']

        ret.node_set_add = [{'id': self.n_id,
                             '__label_set': ['__Commit']}
                           ]
        l = Link.Link_Ptr(src_id=hash_parent, dst_id=hash_child)
        l['id'] = self.l_id
        l['__type'] = '__Parent'
        ret.link_set_add = [l]
        ret.meta['ts_created'] = ts_created
        return ret

class DBO_block_chain__init(DB_op):

    def __init__(self, rzdoc):
        """
        Rhizi version control - initialize meta namespace block chain
        """
        super(DBO_block_chain__init, self).__init__()

        #
        # setup meta rzdoc NS
        #
        meta_ns_label_q = quote__backtick(rzdoc__meta_ns_label(rzdoc))
        q_arr = ['create (n:%s:%s:%s {commit_attr})' % (meta_ns_label_q,
                                                        neo4j_schema.META_LABEL__VC_HEAD,
                                                        neo4j_schema.META_LABEL__VC_COMMIT,
                                                        ),
                 'set n.ts_created=timestamp()', ]

        hash_value = neo4j_schema.META_LABEL__VC_EMPTY_RZDOC_HASH
        param_set = {'commit_attr': {
                                       'blob': '',
                                       'hash': hash_value,
                                       'id': hash_value,
                                       'name': 'root-commit'},
                       }

        db_q = DB_Query(q_arr, param_set)
        self.add_db_query(db_q)

class DBO_block_chain__list(DB_op):
    """
    Return block chain hash list
    
    @return: hash list where last list item corresponds to earliest commit
    """

    def __init__(self, length_lim=None):
        """
        @param blob_obj: serializable blob
        """
        super(DBO_block_chain__list, self).__init__()

        # FIXME: use cleaner query:
        # match p=(n:HEAD)-[r:Parent*]->(m) return extract(n in nodes(p) | n.hash);
        q_arr = ['match (n:HEAD)-[r:Parent*]->(m)',
                 'return [n.hash] + collect(m.hash)'
                 ]

        if None != length_lim:
            # inject maxHops limit if available
            q_arr[0] = "match (n:HEAD)-[r:Parent*..%d]->m" % (length_lim),

        self.add_statement(q_arr)

    def process_result_set(self):
        # optimize for single statement
        for _, _, r_set in self.iter__r_set():
            for row in r_set:
                for col in row:
                    return col

class DBO_raw_query_set(DB_op):
    """
    Freeform set of DB query statements

    [!] use of this class is discouraged and should be done
        only when no other DB_op is able to handle the task
        at hand
    """
    def __init__(self, q_arr=None, q_params={}):
        super(DBO_raw_query_set, self).__init__()

        if q_arr is not None:
            self.add_statement(q_arr, q_params)

    def add_statement(self, q_arr, query_params={}):
        """
        super.add_statement() override: use raw queries
        """
        db_q = DB_Raw_Query(q_arr, query_params)
        self.query_set.append(db_q)
        return len(self.query_set)

    def add_db_query(self, db_q):
        assert False, 'DBO_raw_query_set only supports raw queries - use add_statement()'

class DBO_diff_commit__topo(DB_composed_op):

    """
    commit a Topo_Diff

    @return: a Topo_Diff of the actual committed changes
    """
    def __init__(self, topo_diff):
        super(DBO_diff_commit__topo, self).__init__()

        n_add_map = db_util.meta_attr_list_to_meta_attr_map(topo_diff.node_set_add)
        l_add_map = db_util.meta_attr_list_to_meta_attr_map(topo_diff.link_set_add, meta_attr='__type')
        l_rm_set = topo_diff.link_id_set_rm
        n_rm_set = topo_diff.node_id_set_rm

        self.n_add_map = len(n_add_map) > 0
        self.l_add_map = len(l_add_map) > 0
        self.l_rm_set = len(l_rm_set) > 0
        self.n_rm_set = len(n_rm_set) > 0

        #
        # [!] order critical
        #
        if len(n_add_map) > 0:
            op = DBO_add_node_set(n_add_map)
            self.add_sub_op(op)

        if len(l_add_map) > 0:
            op = DBO_add_link_set(l_add_map)
            self.add_sub_op(op)

        if len(l_rm_set) > 0:
            op = DBO_rm_link_set(l_rm_set)
            self.add_sub_op(op)

        if len(n_rm_set) > 0:
            op = DBO_rm_node_set(n_rm_set)
            self.add_sub_op(op)

    def process_result_set(self):
        ret_nid_set_add = []
        ret_lid_set_add = []
        ret_nid_set_rm = []
        ret_lid_set_rm = []
        it = self.iter__sub_op()

        if self.n_add_map:
            for _, _, r_set in it.next().iter__r_set():  # iterate over result sets
                for row in r_set:
                    for ret_dict in row:
                        n_id = ret_dict['id']  # see query return statement
                        ret_nid_set_add.append(n_id)

        if self.l_add_map:
            for _, _, r_set in it.next().iter__r_set():  # iterate over result sets
                for row in r_set:
                    for ret_dict in row:
                        l_id = ret_dict['id']  # see query return statement
                        ret_lid_set_add.append(l_id)

        if self.l_rm_set:
            for _, _, row_set in it.next().iter__r_set():
                for l_id in row_set:
                    ret_lid_set_rm.extend(l_id)

        if self.n_rm_set:
            for _, _, row_set in it.next().iter__r_set():
                for n_id in row_set:
                    ret_nid_set_rm.extend(n_id)

        ret = Topo_Diff.Commit_Result_Type(node_id_set_add=ret_nid_set_add,
                                           link_id_set_add=ret_lid_set_add,
                                           node_id_set_rm=ret_nid_set_rm,
                                           link_id_set_rm=ret_lid_set_rm)
        return ret


class DBO_diff_commit__attr(DB_op):
    """
    commit a Attr_Diff, return an Attr_Diff

    @return: an Attr_Diff upon success - it is important to note that written-
             to attributes do not imply necessarily that the attribute has
             actually changed, only that it has been 'touched'
    """
    def __init__(self, attr_diff):
        super(DBO_diff_commit__attr, self).__init__()

        self.op_return_value__attr_diff = deepcopy(attr_diff)  # cache copy as return value on success

        for id_attr, n_attr_diff in attr_diff.type__node.items():
            # TODO parameterize multiple attr removal
            attr_set_rm = n_attr_diff['__attr_remove']
            attr_set_wrt = n_attr_diff['__attr_write']

            assert len(attr_set_rm) > 0 or len(attr_set_wrt) > 0

            q_arr = ["match (n {id: {match_attr_set}.id})",  # [!] with match (n {match_attr_set}) neo4j returns: 'Parameter maps cannot be used in MATCH patterns (use a literal map instead'
                     "return n.id, n"]
            q_param_set = {'match_attr_set': {'id': id_attr}}

            if len(attr_set_rm) > 0:
                stmt_attr_rm = "remove " + ', '.join(['n.' + attr for attr in attr_set_rm])
                q_arr.insert(1, stmt_attr_rm)

            if len(attr_set_wrt) > 0:
                stmt_attr_set = "set n += {attr_set}"
                q_arr.insert(1, stmt_attr_set)
                q_param_set['attr_set'] = attr_set_wrt

            self.add_statement(q_arr, q_param_set)

        for id_attr, l_attr_diff in attr_diff.type__link.items():
            attr_set_rm = l_attr_diff['__attr_remove']
            attr_set_wrt = l_attr_diff['__attr_write']

            assert len(attr_set_rm) > 0 or len(attr_set_wrt) > 0

            # Labels on relationships are different, we use a label for the name property
            if 'name' in attr_set_wrt:
                self.add_link_rename_statements(id_attr, attr_set_wrt['name'])
                del attr_set_wrt['name']  # exclude name changes from subsequent attr rm/set processing

            if len(attr_set_wrt) == 0 and len(attr_set_rm) == 0:
                continue

            q_arr = ["match ()-[l {id: {id}}]-()",
                     "return l.id, l"]  # currently unused
            q_param_set = {'id': id_attr}

            if len(attr_set_rm) > 0:
                stmt_attr_rm = "remove " + ', '.join(['l.' + attr for attr in attr_set_rm])
                q_arr.insert(1, stmt_attr_rm)

            if len(attr_set_wrt) > 0:
                stmt_attr_set = "set l += {attr_set}"
                q_arr.insert(1, stmt_attr_set)
                q_param_set['attr_set'] = attr_set_wrt

            self.add_statement(q_arr, q_param_set)

    def add_link_rename_statements(self, id_attr, new_label):
        # TODO - where do we sanitize the label name? any better way of doing this?
        # XXX - the return here is a bit verbose? maybe better built on python side?
        # NONGOALS: doing this on the client.

        # Should assert the following returns 1
        # match n-[l:new_label]->m return count(l)
        # Not doing so to avoid roundtrip - the following doesn't require knowing
        # the replaced label.

        q_create_new = ["match (n)-[l_old {id: {id}}]->(m)",
                        "create (n)-[l_new:%s]->(m) set l_new=l_old" % db_util.quote__backtick(new_label),
                        "return l_new.id, {id: l_new.id, name: type(l_new)}",  # currently unused
                        ]
        q_delete_old = ["match (n)-[l_old {id: {id}}]->(m)",
                        "where type(l_old)<>'%s' delete l_old" % new_label,
                        ]
        q_param_set = {'id': id_attr}
        self.add_statement(q_create_new, q_param_set)
        self.add_statement(q_delete_old, q_param_set)

    def process_result_set(self):
        # currently we have not straightforward way to discern which attributes were
        # actually written from the neo4j return value, so we simply echo the attr_diff
        # back to the client

        # ret = {}
        # for _, _, r_set in self.iter__r_set():
        #     for row in r_set:
        #         n_id, n = [v for v in row]  # we expect a [n_id, n] array
        #         ret[n_id] = n

        return self.op_return_value__attr_diff

class DBO_load_node_set_by_DB_id(DB_op):
    def __init__(self, id_set):
        """
        load a set of nodes whose DB id is in id_set

        @param id_set: DB node id set
        @return: loaded node set or an empty set if no match was found
        """
        super(DBO_load_node_set_by_DB_id, self).__init__()
        q_arr = ['start n=node({id_set})',
                 'return n'
                 ]
        self.add_statement(q_arr, { 'id_set': id_set})

class DBO_match_node_id_set(DB_op):

    def __init__(self, filter_label=None, filter_attr_map={}):
        """
        match a set of nodes by type / attr_map

        @param filter_label: node type filter
        @param filter_attr_map: is a filter_key to filter_value_set map of
               possible attributes to match against, eg.:
               { 'id':[0,1], 'color: ['red','blue'] }
        @return: a set of node DB id's
        """
        super(DBO_match_node_id_set, self).__init__()

        q = "match (n{filter_label}) {where_clause} return id(n)"
        q = cfmt(q, filter_label="" if not filter_label else ":" + filter_label)
        q = cfmt(q, where_clause=db_util.gen_clause_where_from_filter_attr_map(filter_attr_map))

        q_params = filter_attr_map

        self.add_statement(q, q_params)

class DBO_match_node_set_by_id_attribute(DBO_match_node_id_set):

    def __init__(self, id_set):
        """
        convenience op: load a set of nodes by their 'id' attribute != DB node id
        """
        assert isinstance(id_set, list)

        super(DBO_match_node_set_by_id_attribute, self).__init__(filter_attr_map={'id': id_set})

class DBO_nop(DB_op):

    def __init__(self):
        """
        Do nothing op used to test DB availability
        """
        super(DBO_nop, self).__init__()

class DBO_load_link_set(DB_op):

    def __init__(self, link_ptr_set):
        """
        match a set of sets of links by source/target node id attributes

        This class should be instantiated through a static factory function

        @param link_ptr_set link pointer set
        @return: a set of loaded links
        """
        super(DBO_load_link_set, self).__init__()

        for l_ptr in link_ptr_set:
            if not l_ptr.src_id:
                q_arr = ['match ()-[r]->({id: {dst_id}})',
                         'return r'
                        ]
                q_params = {'dst_id': l_ptr.dst_id}
            elif not l_ptr.dst_id:
                q_arr = ['match ({id: {src_id}})-[r]->()',
                         'return r'
                         ]
                q_params = {'src_id': l_ptr.src_id}
            else:
                q_arr = ['match ({id: {src_id}})-[r]->({id: {dst_id}})',
                         'return r'
                         ]
                q_params = {'src_id': l_ptr.src_id, 'dst_id': l_ptr.dst_id}

            self.add_statement(q_arr, q_params)

    @staticmethod
    def init_from_link_ptr(l_ptr):
        return DBO_load_link_set([l_ptr])

    @staticmethod
    def init_from_link_ptr_set(l_ptr_set):
        return DBO_load_link_set(l_ptr_set)

class DBO_match_link_id_set(DB_op):

    def __init__(self, filter_label=None, filter_attr_map={}):
        """
        load an id-set of links

        @param filter_label: link type filter
        @param filter_attr_map: is a filter_key to filter_value_set map of
               attributes to match link properties against
        @return: a set of loaded link ids
        """
        super(DBO_match_link_id_set, self).__init__()

        q_arr = ['match ()-[r{filter_label} {filter_attr}]->()',
                 'return id(r)'
        ]
        q = ' '.join(q_arr)
        q = cfmt(q, filter_label="" if not filter_label else ":" + filter_label)
        q = cfmt(q, filter_attr=db_util.gen_clause_attr_filter_from_filter_attr_map(filter_attr_map))
        q_params = {k: v[0] for (k, v) in filter_attr_map.items()}  # pass on only first value from each value set

        self.add_statement(q, q_params)

class DBO_rm_node_set(DB_op):

    def __init__(self, id_set, rm_links=False):
        """
        remove node set
        """
        assert len(id_set) > 0, __name__ + ': empty id set'

        super(DBO_rm_node_set, self).__init__()

        if rm_links:
            q_arr = ['match (n)',
                     'with n, n.id as n_id',
                     'where n_id in {id_set}',
                     'optional match (n)-[r]-()',
                     'with n, n_id, r, r.id as r_id',
                     'delete n,r',
                     'return n_id, collect(r_id)'
             ]
        else:
            q_arr = ['match (n)',
                     'with n, n.id as n_id',
                     'where n_id in {id_set}',
                     'delete n',
                     'return n_id'
             ]

        q_params = {'id_set': id_set}
        self.add_statement(q_arr, q_params)

class DBO_rm_link_set(DB_op):

    def __init__(self, id_set):
        """
        remove link set

        [!] when removing as a result of node removal, use DBO_rm_node_set 
        along with rm_links=True
        """
        assert len(id_set) > 0, __name__ + ': empty id set'

        super(DBO_rm_link_set, self).__init__()

        q_arr = ['match ()-[r]->()',
                 'with r, r.id as r_id',
                 'where r_id in {id_set}',
                 'delete r',
                 'return r_id'
         ]

        q_params = {'id_set': id_set}
        self.add_statement(q_arr, q_params)

class DBO_rzdb__fetch_DB_metablock(DB_op):

    def __init__(self):
        """
        Fetch DB metadata

        @retrun metablock or None if none was found
        """
        super(DBO_rzdb__fetch_DB_metablock, self).__init__()

        q_arr = ['match (n:%s)' % (neo4j_schema.META_LABEL__RZDB_META),
                 'return n'
                 ]
        self.add_statement(q_arr)

    def process_result_set(self):
        ret = super(DBO_rzdb__fetch_DB_metablock, self).process_result_set()
        if len(ret) > 1:  # assert DB contains single metablock
            raise Exception('found more than one DB metablocks, DB may be corrupt')
        if 0 == len(ret):
            return None
        return ret.pop()

class DBO_rzdb__init_DB(DB_composed_op):

    class _init_DB_subop(DB_op):

        def __init__(self):
            super(DBO_rzdb__init_DB. _init_DB_subop, self).__init__()

            # init DB metadata node
            q_arr = ['create (n:%s {db_attr})' % (neo4j_schema.META_LABEL__RZDB_META)]
            q_params = {'db_attr': {'schema_version': neo4j_schema.NEO4J_SCHEMA_VERSION}}
            self.add_statement(q_arr, q_params)

    def __init__(self, rzdoc__mainpage_name):
        """
        Fetch DB metadata
        """
        super(DBO_rzdb__init_DB, self).__init__()

        # probe for an existing metablock, fail if found via post_sub_op_exec_hook()
        self.add_sub_op(DBO_rzdb__fetch_DB_metablock())

        # init DB metadata node
        self.add_sub_op(DBO_rzdb__init_DB._init_DB_subop())

        # create mainpage
        mainpage_rzdoc = RZDoc(rzdoc__mainpage_name)
        mainpage_rzdoc.id = 'a000a000'
        self.add_sub_op(DBO_rzdoc__create(mainpage_rzdoc))
        self.add_sub_op(DBO_block_chain__init(mainpage_rzdoc))

    def post_sub_op_exec_hook(self, prv_sub_op, prv_sub_op_ret):

        if isinstance(prv_sub_op, DBO_rzdb__fetch_DB_metablock) and prv_sub_op_ret is not None:
            raise Exception('DB contains metadata, aborting initialization of pre-initialized DB')

class DBO_rzdoc__commit_log(DB_op):

    def __init__(self, limit):
        """
        return last @limit commits including the operations that caused them
        """
        super(DBO_rzdoc__commit_log, self).__init__()
        self.limit = limit

        q_arr = ['match (n:%s)' % (
                    neo4j_schema.META_LABEL__VC_HEAD,
                 ),
                 'match (n)-[:%s*0..%s]->(c)' % (
                    neo4j_schema.META_LABEL__VC_PARENT,
                    limit - 1,
                 ),
                 'optional match (c)-[:%s]->(o:%s)' % (
                    neo4j_schema.META_LABEL__VC_COMMIT_RESULT_OF,
                    neo4j_schema.META_LABEL__VC_OPERATION,
                 ),
                 'optional match (c)-[:`%s`]->(u:%s)' % (
                    neo4j_schema.META_LABEL__VC_COMMIT_AUTHOR,
                    neo4j_schema.META_LABEL__USER,
                 ),
                 'return collect([c, o, u])']  # since o is optional we need to pair them

        db_q = DB_Query(q_arr)
        self.add_db_query(db_q)

    def process_result_set(self):
        ret = []
        # break out the blobs, return them - binary all the way home
        for _, _, r_set in self.iter__r_set():
            for row in r_set:
                pairs = row.items()[0]  # see query return statement
                for commit, operation, user in pairs:
                    if commit['blob'] == '':
                        # root commit, done
                        break
                    # TODO: get author
                    diff = RZCommit.diff_obj_from_blob(commit['blob'])
                    diff['meta'] = dict(ts_created=commit['ts_created'],
                                        author='Anonymous' if user is None else user['user_name'],
                                        commit=commit['hash'],
                                        )
                    if None is not operation and 'sentence' in operation:
                        diff['meta']['sentence'] = operation['sentence']
                    ret.append(diff)
        return ret

class DBO_rzdoc__clone(DB_op):

    def __init__(self, limit=16384):
        """
        clone rhizi

        @return: a Topo_Diff with the appropriate node_set_add, link_set_add
        fields filled
        """
        super(DBO_rzdoc__clone, self).__init__()

        self.limit = limit
        self.skip = 0

        q_arr = ['match (n)',
                 'with n',
                 'order by n.id',
                 'skip %d' % (self.skip),
                 'limit %d' % (self.limit),
                 'optional match (n)-[r]->(m)',
                 'return n,labels(n),collect([r, type(r), m.id])']

        db_q = DB_Query(q_arr)
        self.add_db_query(db_q)

    def process_result_set(self):
        ret_n_set = []
        ret_l_set = []
        for _, _, r_set in self.iter__r_set():
            for row in r_set:
                n, n_lbl_set, l_set = row.items()  # see query return statement

                # reconstruct nodes
                assert None != n.get('id'), "db contains nodes with no id"

                n['__label_set'] = self.process_q_ret__n_label_set(n_lbl_set)

                ret_n_set.append(n)

                # reconstruct links from link tuples
                for l_tuple in l_set:
                    assert 3 == len(l_tuple)  # see query return statement

                    if None == l_tuple[0]:  # check if link dst is None
                        # as link matching is optional, collect may yield empty sets
                        continue

                    ret_l, ret_l_type, ret_l_dst_id = l_tuple
                    l = Link.Link_Ptr(src_id=n['id'], dst_id=ret_l_dst_id)
                    l['id'] = ret_l['id']
                    l['__type'] = self.process_q_ret__l_type(ret_l_type)

                    ret_l_set.append(l)

        if len(ret_n_set) >= self.limit:  # TODO: generalize logic, mv to DB_Driver
            log.warning('DB op result set larger than query limit: size: %d, limit: %d' % (len(ret_n_set), self.limit))

        topo_diff = Topo_Diff(node_set_add=ret_n_set,
                              link_set_add=ret_l_set)
        return topo_diff

    def process_q_ret__n_label_set(self, label_set):
        return label_set

    def process_q_ret__l_type(self, l_type):
        return [l_type]  # return as list

class DBO_rzdoc__create(DB_op):

    def __init__(self, rzdoc):
        """
        create a new rhizi doc
        """
        super(DBO_rzdoc__create, self).__init__()

        #
        # setup rzdoc node
        #
        q_arr = ['create (n:%s {rzdoc_attr})' % (neo4j_schema.META_LABEL__RZDOC_TYPE),
                 'return n.id, n.name']

        param_set = {'rzdoc_attr': {'id': rzdoc.id,
                                    'name': rzdoc.name}}

        db_q = DB_Query(q_arr, param_set)
        self.add_db_query(db_q)

class DBO_rzdoc__delete(DB_op):

    def __init__(self, rzdoc):
        """
        delete a rhizi doc
        """
        super(DBO_rzdoc__delete, self).__init__()

        rzdoc_label_q = quote__backtick(rzdoc__ns_label(rzdoc))
        rzdoc_id_q = quote__singlequote(rzdoc.id)

        # delete doc nodes & links
        q_arr = ['match (n:%s)' % (rzdoc_label_q),
                 'optional match (n:%s)-[r]-()' % (rzdoc_label_q),
                 'delete r,n']
        db_q = DB_Query(q_arr)
        self.add_db_query(db_q)

        # delete doc meta node
        q_arr = ['match (n:%s {id: %s})' % (neo4j_schema.META_LABEL__RZDOC_TYPE,
                                           rzdoc_id_q),
                 'optional match (n)-[r]-()',
                 'delete r,n']
        db_q = DB_Query(q_arr)
        self.add_db_query(db_q)

class DBO_rzdoc__list(DB_op):

    def __init__(self):
        """
        list available rhizi docs (common to all users)
        """
        super(DBO_rzdoc__list, self).__init__()
        q_arr = ['match (n:%s)' % (neo4j_schema.META_LABEL__RZDOC_TYPE),
                 'return n']
        db_q = DB_Query(q_arr)
        self.add_db_query(db_q)

class DBO_rzdoc__lookup_by_name(DB_op):

    def __init__(self, rzdoc_name):
        """
        @return: [rzdoc] or [] if no doc with the given name was found
        """
        super(DBO_rzdoc__lookup_by_name, self).__init__()

        q_arr = ['match (n:%s)' % (neo4j_schema.META_LABEL__RZDOC_TYPE),
                 'where n.name =~ {name}',
                 'return n']

        param_set = {'name': '(?i)' + rzdoc_name}
        db_q = DB_Query(q_arr, param_set)
        self.add_db_query(db_q)

    def process_result_set(self):
        rzdoc_dict_set = DB_op.process_result_set(self)
        if not rzdoc_dict_set: return None

        rzdoc_dict = rzdoc_dict_set.pop()
        rzdoc = RZDoc(rzdoc_name=rzdoc_dict['name'])
        rzdoc.id = rzdoc_dict['id']
        return rzdoc

class DBO_rzdoc__rename(DB_op):

    def __init__(self, rzdoc_cur_name, rzdoc_new_name):
        """
        @return: [rzdoc] or [] if no doc with the given name was found
        """
        super(DBO_rzdoc__rename, self).__init__()

        q_arr = ['match (n:%s {name: {cur_name}})' % (neo4j_schema.META_LABEL__RZDOC_TYPE),
                 'set n.name = {new_name}',
                 'return n']

        param_set = {'cur_name': rzdoc_cur_name, 'new_name': rzdoc_new_name}
        db_q = DB_Query(q_arr, param_set)
        self.add_db_query(db_q)

    def process_result_set(self):
        rzdoc_dict_set = DB_op.process_result_set(self)
        if not rzdoc_dict_set: return None

        rzdoc_dict = rzdoc_dict_set.pop()
        rzdoc = RZDoc(rzdoc_name=rzdoc_dict['name'])
        rzdoc.id = rzdoc_dict['id']
        return rzdoc


