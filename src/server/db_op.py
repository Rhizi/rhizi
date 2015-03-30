from copy import deepcopy
from geventwebsocket.websocket import WebSocket
import gzip
import hashlib
import json
import re

import StringIO as sio
from model.graph import Attr_Diff
from model.graph import Topo_Diff
from model.model import Link
from neo4j_util import generate_random_id__uuid
from neo4j_util import cfmt
import neo4j_util as db_util
import logging
from neo4j_cypher import DB_Query, DB_result_set
import neo4j_cypher

log = logging.getLogger('rhizi')

class DB_op(object):
    """
    Transaction (tx) wrapped DB operation possibly composing multiple DB queries
    """
    def __init__(self):
        self.query_set = []
        self.result_set = []
        self.error_set = None
        self.tx_id = None # int
        self.tx_commit_url = None  # cached from response to tx begin

    def __iter__(self):
        for dbq in self.query_set:
            yield dbq

    def __repr__(self):
        return '%s: tx-id: %d' % (self.__class__.__name__, self.tx_id)

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

    def parse_multi_statement_response_data(self, data):
        pass

    def process_result_set(self):
        """
        DB op can issue complex sets of quries all at once - this helper method
        assists in parsing response data from a single query.
        """
        ret = []
        for _, _, r_set in self.iter__r_set():
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

    def add_statement(self, query, query_params={}):
        self.__assert_false_statement_access()

    def add_sub_op(self, op):
        self.sub_op_set.append(op)

    def __iter__(self):
        for s_op in self.sub_op_set:
            for dbq in s_op:
                yield dbq

    def iter__sub_op(self):
        for s_op in self.sub_op_set:
            yield s_op

    def __getattribute__(self, attr):
        """
        intercept 'query_set' attr get
        """
        if attr == 'query_set':
            self.__assert_false_statement_access()

        return object.__getattribute__(self, attr)

    def process_result_set(self):
        ret = []
        for s_op in self.sub_op_set:
            s_result_set = s_op.process_result_set()
            ret.append(s_result_set)
        return ret

class DBO_block_chain__commit(DB_op):
    """
    Label legend:
       - __HEAD: HEAD commit, unique
       - __Parent: parent commit relationship
       - __Commit: node type
       - __Authored-by: commit author
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

    def __init__(self, commit_obj=None, ctx=None):
        """
        @param blob_obj: serializable blob
        @return: old_head, new_head, new_head.hash_value
        """
        super(DBO_block_chain__commit, self).__init__()

        blob = self._convert_to_blob(commit_obj)
        hash_value = self.calc_blob_hash(blob)

        name_value = hash_value[:8] + '...' if commit_obj == None else str(commit_obj)
        l_id = generate_random_id__uuid()

        q_arr = ['match (old_head:__HEAD:__Commit)',
                 'create (new_head:__HEAD:__Commit {commit_attr})',
                 'create (new_head)-[r:__Parent {link_attr}]->(old_head)',
                 'remove old_head:__HEAD',
                 'set new_head.ts_created=timestamp()',
                 'return {head_parent_commit: old_head, head_commit: new_head}'
                 ]

        q_param_set = {'commit_attr': {
                                       'blob': blob,
                                       'hash': hash_value,
                                       'id': hash_value,
                                       'name': name_value},
                       'link_attr': {'id': l_id},
                       }

        self.add_statement(q_arr, q_param_set)

        # cache values necessary to generate op result
        self.commit_obj = commit_obj
        self.n_id = hash_value
        self.n_name_value = name_value
        self.l_id = l_id

        # create commit-[:__Authored-by]->__User link if possible
        if None == ctx or None == ctx.get('user_name'):
            return

        q_arr = ['merge (n:__USER {user_name: \'%s\'})' % ctx.get('user_name'),
                 'with n',
                 'match (m:__HEAD)',  # FIXME: specify commit-label index
                 'create (m)-[r:`__Authored-by`]->(n)',
                 ]
        self.add_statement(q_arr)

    def _convert_to_blob(self, obj):
        """
        @return: blob = json.dumps(obj)
        """
        obj_str = json.dumps(obj)
        # blob_gzip = self._gzip_compress_string(obj_str)

        return obj_str

    def _gzip_compress_string(self, input_string):
        out = sio.StringIO()
        with gzip.GzipFile(fileobj=out, mode='wb') as f:
            f.write(input_string)

        ret = out.getvalue()
        return ret

    def process_result_set(self):
        """
        @return: a Topo_Diff object consisting of the commit node and parent link
        """
        ret = Topo_Diff()

        hash_parent = None
        hash_child = None
        for _, _, r_set in self.iter__r_set():
            for row in r_set:
                for ret_dict in row:

                    assert None == hash_parent  # assert hash values set once only
                    assert None == hash_child

                    hash_parent = ret_dict['head_parent_commit']['hash']
                    hash_child = ret_dict['head_commit']['hash']

        ret.node_set_add = [{'id': self.n_id,
                             'name': self.n_name_value,
                             '__label_set': ['__Commit']}
                           ]
        l = Link.Link_Ptr(src_id=hash_parent, dst_id=hash_child)
        l['id'] = self.l_id
        l['__type'] = '__Parent'
        ret.link_set_add = [l]
        return ret

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

class DBO_cypher_query(DB_op):
    """
    freeform cypher query
    """
    def __init__(self, q, q_params={}):
        super(DBO_cypher_query, self).__init__()
        self.add_statement(q, q_params)

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

            q_arr = ["match (n {id: {match_attr_set}.id})", # [!] with match (n {match_attr_set}) neo4j returns: 'Parameter maps cannot be used in MATCH patterns (use a literal map instead'
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

class DBO_rz_clone(DB_op):

    def __init__(self, filter_label=None, limit=16384):
        """
        clone rhizi

        @return: a Topo_Diff with the appropriate node_set_add, link_set_add
        fields filled
        """
        super(DBO_rz_clone, self).__init__()

        self.limit = limit
        self.skip = 0

        q_arr = ['match (n)' if not filter_label else 'match (n:%s)' % (filter_label),
                 'with n',
                 'order by n.id',
                 'skip %d' % (self.skip),
                 'limit %d' % (self.limit),
                 'optional match (n)-[r]->(m)',
                 'return n,labels(n),collect([m.id, r, type(r)])']

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

                n['__label_set'] = n_lbl_set

                ret_n_set.append(n)

                # reconstruct links from link tuples
                for l_tuple in l_set:
                    assert 3 == len(l_tuple)  # see query return statement

                    if None == l_tuple[0]:  # check if link dst is None
                        # as link matching is optional, collect may yield empty sets
                        continue

                    l = Link.Link_Ptr(src_id=n['id'], dst_id=l_tuple[0])
                    l['id'] = l_tuple[1]['id']
                    l['__type'] = [l_tuple[2]]

                    ret_l_set.append(l)

        if len(ret_n_set) >= self.limit: # TODO: generalize logic, mv to DB_Driver
            log.warning('DB op result set larger than query limit: size: %d, limit: %d' % (len(ret_n_set), self.limit))

        topo_diff = Topo_Diff(node_set_add=ret_n_set,
                              link_set_add=ret_l_set)
        return topo_diff

class DBO_rzdoc__new(DB_op):

    def __init__(self, rzdoc):
        """
        create a new rhizi doc
        """
        super(DBO_rzdoc__new, self).__init__()

        q_arr = ['merge (n:%s {attr_dict})' % (neo4j_cypher.META_LABEL__RZ_DOC),
                 'return n']

        rzdoc_id = rzdoc.id
        rzdoc_name = rzdoc.name
        param_set = {'attr_dict': {'id': rzdoc_id, 'name': rzdoc_name}}

        db_q = DB_Query(q_arr, param_set)
        self.add_db_query(db_q)

class DBO_rzdoc__lookup_by_name(DB_op):

    def __init__(self, name):
        """
        create a new rhizi doc
        """
        super(DBO_rzdoc__new, self).__init__()

        q_arr = ['match (n:%s {name: {name}})' % (neo4j_cypher.META_LABEL__RZ_DOC),
                 'return n']

        param_set = {'name': name}
        db_q = DB_Query(q_arr, param_set)
        self.add_db_query(db_q)

