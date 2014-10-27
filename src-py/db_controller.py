#!/usr/bin/python

import os
import json
import re
import logging
import traceback

from model.graph import Attr_Diff
from model.graph import Topo_Diff

import urllib2

import neo4j_util as db_util
from neo4j_util import cfmt
from neo4j_util import DB_result_set
from neo4j_util import Neo4JException

log = logging.getLogger('rhizi')

class DB_op(object):
    """
    tx wrapped DB operation possibly composing multiple DB queries
    """

    def __init__(self):
        self.statement_set = []
        self.result_set = []
        self.error_set = None
        self.tx_id = None
        self.tx_commit_url = None  # cached from response to tx begin

    def parse_tx_id(self, tx_commit_url):
        m = re.search('/(?P<id>\d+)/commit$', tx_commit_url)
        id_str = m.group('id')
        self.tx_id = int(id_str)

    def add_statement(self, query, query_params={}):
        """
        add a DB query language statement
        @return: statement index (zero based)
        """
        s = db_util.statement_to_REST_form(query, query_params)
        self.statement_set.append(s)
        return len(self.statement_set)

    def __iter__(self):
        """
        iterate over (statement_index, statement, result, error) 
        where result & error are mutually exclusive
        
        note: statement_index is zero based
        
        TODO: handle partial iteration due to error_set being non-empty
        """
        i = 0
        r_set_len = len(self.result_set)
        for s in self.statement_set:
            r_set = None  # row-set
            if i < r_set_len:  # support partial result recovery
                r_set = DB_result_set(self.result_set[i])
            yield (i, s, r_set)
            i = i + 1

    def parse_multi_statement_response_data(self, data):
        pass

    def process_result_set(self):
        """
        DB op can issue complex sets of quries all at once - this helper method
        assists in parsing response data from a single query.
        """
        ret = []
        for _, _, r_set in self:
            for row in r_set:
                for col in row:
                    ret.append(col)
        return ret


class DB_composed_op(DB_op):
    def __init__(self):
        super(DB_composed_op, self).__init__()
        self.sub_op_set = []

    def __assert_false_statement_access(self):
        assert False, "composed_op may not contain statements, only sub-ops"

    def add_statement(self, query, query_params={}):
        self.__assert_false_statement_access()

    def add_sub_op(self, op):
        self.sub_op_set.append(op)

    def __getattribute__(self, attr):
        """
        intercept 'statement_set' attr get    
        """
        if attr == 'statement_set':
            self.__assert_false_statement_access()

        return object.__getattribute__(self, attr)

    def __iter__(self):
        """
        iterate over sub_op_set
        """
        for s_op in self.sub_op_set:
            yield s_op

    def process_result_set(self):
        ret = []
        for s_op in self:
            s_result_set = s_op.process_result_set()
            ret.append(s_result_set)
        return ret

class DBO_topo_diff_commit(DB_composed_op):
    """
    commit a Topo_Diff
    """
    def __init__(self, topo_diff):
        super(DBO_topo_diff_commit, self).__init__()

        # TODO rm link set
        # TODO rm node set
        assert 0 == len(topo_diff.node_set_rm), 'unsupported'
        assert 0 == len(topo_diff.link_set_rm), 'unsupported'

        n_add_map = db_util.meta_attr_list_to_meta_attr_map(topo_diff.node_set_add)
        l_add_map = db_util.meta_attr_list_to_meta_attr_map(topo_diff.link_set_add)

        #
        # [!] order critical
        #
        if len(n_add_map) > 0:
            op_n_add = DBO_add_node_set(n_add_map)
            self.add_sub_op(op_n_add)

        if len(l_add_map) > 0:
            op_l_add = DBO_add_link_set(l_add_map)
            self.add_sub_op(op_l_add)

class DBO_attr_diff_commit(DB_op):
    """
    commit a Attr_Diff
    """
    def __init__(self, attr_diff):
        super(DBO_attr_diff_commit, self).__init__()

        for id_attr, n_attr_diff in attr_diff.items():
            # TODO parameterize multiple attr removal
            r_attr_set = n_attr_diff['attr_remove']
            w_attr_set = n_attr_diff['attr_write']

            assert len(r_attr_set) > 0 or len(w_attr_set) > 0

            q_arr = ["match (n {id: {id}}) ",
                     "return n.id, n"]
            q_param_set = {'id': id_attr}

            if len(r_attr_set) > 0:
                stmt_attr_rm = "remove " + ', '.join(['n.' + attr for attr in r_attr_set])
                q_arr.insert(1, stmt_attr_rm)

            if len(w_attr_set) > 0:
                stmt_attr_set = "set n += {attr_set}"
                q_arr.insert(1, stmt_attr_set)
                q_param_set['attr_set'] = w_attr_set

            q = " ".join(q_arr)
            self.add_statement(q, q_param_set)

    def process_result_set(self):
        ret = {}
        for _, _, r_set in self:
            for row in r_set:
                n_id, n = [v for v in row] # we expect a [n_id, n] array
                ret[n_id] = n
        return ret

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
        id_set = []
        for _, _, row_set in self:
            for row in row_set:
                for clo in row:
                    id_set.append(clo)

        log.debug('node-set added: ids: ' + str(id_set))
        return id_set

class DBO_add_link_set(DB_op):
    def __init__(self, link_map):
        """
        @param link_map: is a link-type to link-set map - see model.link
        @return: set of new node DB ids
        """
        super(DBO_add_link_set, self).__init__()
        for q, q_params in db_util.gen_query_create_from_link_map(link_map):
            self.add_statement(q, q_params)

    def process_result_set(self):
        id_set = []
        for _, _, r_set in self:
            for row in r_set:
                for col_val in row:
                    id_set.append(col_val)

        log.debug('link-set added: ids: ' + str(id_set))
        return id_set

class DBO_load_node_set_by_DB_id(DB_op):
    def __init__(self, id_set):
        """
        load a set of nodes whose DB id is in id_set
        
        @return: loaded node set or an empty set if no match was found
        """
        super(DBO_load_node_set_by_DB_id, self).__init__()
        q = "start n=node({id_set}) return n"
        self.add_statement(q, { 'id_set': id_set})

class DBO_match_node_id_set(DB_op):

    def __init__(self, filter_type=None, filter_attr_map={}):
        """
        match a set of nodes by type / attr_map
        
        @param filter_type: node type filter
        @param filter_attr_map: is a filter_key to filter_value_set map of
               possible attributes to match against, eg.:
               { 'id':[0,1], 'color: ['red','blue'] } 
        @return: a set of node DB id's
        """
        super(DBO_match_node_id_set, self).__init__()

        q = "match (n{filter_type}) {where_clause} return id(n)"
        q = cfmt(q, filter_type="" if not filter_type else ":" + filter_type)
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

        @link_ptr_set link pointer set
        @return: a set of loaded links
        """
        super(DBO_load_link_set, self).__init__()
        
        for l_ptr in link_ptr_set:
            if not l_ptr.src_id:
                q = "match ()-[r]->({id: {dst_id}}) return r"
                q_params = {'dst_id': l_ptr.dst_id}
            elif not l_ptr.dst_id:
                q = "match ({id: {src_id}})-[r]->() return r"
                q_params = {'src_id': l_ptr.src_id}
            else:
                q = "match ({id: {src_id}})-[r]->({id: {dst_id}}) return r"
                q_params = {'src_id': l_ptr.src_id, 'dst_id': l_ptr.dst_id}

            self.add_statement(q, q_params)

    @staticmethod
    def init_from_link_ptr(l_ptr):
        return DBO_load_link_set([l_ptr])

    @staticmethod
    def init_from_link_ptr_set(l_ptr_set):
        return DBO_load_link_set(l_ptr_set)

class DBO_match_link_id_set(DB_op):
    def __init__(self, filter_type=None, filter_attr_map={}):
        """
        load an id-set of links
        
        @param filter_type: link type filter 
        @param filter_attr_map: is a filter_key to filter_value_set map of
               attributes to match link properties against
        @return: a set of loaded link ids
        """
        super(DBO_match_link_id_set, self).__init__()

        q = "match ()-[r{filter_type} {filter_attr}]->() return id(r)"
        q = cfmt(q, filter_type="" if not filter_type else ":" + filter_type)
        q = cfmt(q, filter_attr=db_util.gen_clause_attr_filter_from_filter_attr_map(filter_attr_map))
        q_params = {k: v[0] for (k, v) in filter_attr_map.items()}  # pass on only first value from each value set

        self.add_statement(q, q_params)

class DBO_rm_node_set(DB_op):
    def __init__(self, id_set, rm_links=False):
        super(DBO_rm_node_set, self).__init__()

        if rm_links:
            q_arr = ['match (n)',
                     'where n.id in ' + str(id_set),
                     'optional match (n)-[r]-()',
                     'delete n,r'
             ]
        else:
            q_arr = ['match (n)',
                     'where n.id in ' + str(id_set),
                     'delete n'
             ]

        q = ' '.join(q_arr)  # TODO: use id param upon neo4j support: q_params = {'id_set': id_set}
        self.add_statement(q)

class DB_Controller:
    """
    neo4j DB controller
    """
    def __init__(self, config, db_driver_class=None):
        self.config = config
        if not db_driver_class:
            self.db_driver = DB_Driver_REST(self.config.db_base_url)
        else:
            self.db_driver = db_driver_class()
        assert isinstance(self.db_driver, DB_Driver_Base)

    def exec_op(self, op):
        """
        execute operation within a DB transaction
        """
        if isinstance(op, DB_composed_op):
            # construct a list comprehension composed of all sup_op statements
            for s_op in op.sub_op_set:
                self.exec_op(s_op)
            return op.process_result_set()

        try:
            self.db_driver.begin_tx(op)
            self.db_driver.exec_statement_set(op)
            self.db_driver.commit_tx(op)

            return op.process_result_set()
        except Exception as e:
            # here we watch for IOExecptions, etc - not db errors
            # these are returned in the db response itself
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e

    def create_db_op(self, f_work, f_cont):
        ret = DB_op(f_work, f_cont)
        return ret

    def exec_cypher_query(self, q):
        """
        @deprecated: use transaction based api
        """

        # call post and not db_util.post_neo4j to avoid response key errors
        db_util.post(self.config.db_base_url + '/db/data/cypher', {"query" : q})
