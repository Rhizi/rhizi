#!/usr/bin/python

import os
import json
import re
import logging
import traceback

import urllib2

import neo4j_util as dbu
from neo4j_util import DB_result_set

log = logging.getLogger('rhizi')

class DB_op(object):
    """
    tx wrapped DB operation possibly composing multiple DB queries
    """

    def __init__(self):
        self.statement_set = []
        self.result_set = None
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
        if self.result_set:
            for s in self.statement_set:
                rs = DB_result_set(self.result_set[i])
                yield (i, s, rs)
                i = i + 1
        else:
            for s in self.statement_set:
                yield (i, s, None)
                i = i + 1

    def parse_single_query_response_data(self, data):
        """
        DB op can issue complex sets of quries all at once - this helper method
        assists in parsing response data from a single query.
        """
        ret = []
        for _, _, r_set in self:
            for row in r_set:
                for cloumn in row:
                    ret.append(row)
        return ret

    def parse_multi_statement_response_data(self, data):
        pass

    def on_completion(self, data):
        pass

    def _assign_results_errors(self, data):
        self.result_set = data['results']
        self.error_set = data['errors']

class DB_composed_op(DB_op):
    def __init__(self):
        super(DB_composed_op, self).__init__()
        self.sub_op_set = []

    def add_statement(self, query, query_params={}):
        assert False, "composed_op may not contain statements, only sub-ops"

    def add_sub_op(self, op):
        self.sub_op_set.append(op)

    def __getattribute__(self, attr):
        """
        intercept 'statement_set' attr get
        """
        if attr == 'statement_set':
            # construct a list comprehension composed of all sup_op statements 
            return [s for s_op in self.sub_op_set for s in s_op.statement_set]

        return object.__getattribute__(self, attr)

class DBO_topo_diff_commit(DB_composed_op):
    """
    commit a 
    """
    def __init__(self, topo_diff):
        super(DBO_topo_diff_commit, self).__init__()

        # TODO rm link set
        # TODO rm node set
        assert not topo_diff.node_set_rm, 'unsupported'
        assert not topo_diff.link_set_rm, 'unsupported'

        n_add_map = db_util.meta_attr_list_to_meta_attr_map(topo_diff.node_set_add)
        l_add_map = db_util.meta_attr_list_to_meta_attr_map(topo_diff.link_set_add)

        op_n_add = DBO_add_node_set(n_add_map)
        op_l_add = DBO_add_link_set(l_add_map)
        
        # [!] order critical
        self.add_sub_op(op_n_add)
        self.add_sub_op(op_l_add)

    def on_completion(self, data):
        pass

class DBO_attr_diff_commit(DB_op):
    """
    commit a Attr_Diff
    """
    def __init__(self, attr_diff):
        super(DBO_attr_diff_commit, self).__init__()

        for id_attr, n_attr_diff in attr_diff.items():
            # TODO parameterize multiple attr removal
            rm_attr_set = n_attr_diff['attr_remove']
            rm_attr_str = ', '.join(['n.' + attr for attr in rm_attr_set])

            q = ("match (n {id: {id}}) " +
                 "set n += {attr_set} " +
                 "remove " + rm_attr_str + " " +
                 "return n.id, n")
            q_param_set = {'id': id_attr,
                           'attr_set': n_attr_diff['attr_write']}
            self.add_statement(q, q_param_set)

    def on_completion(self, data):
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

    def on_completion(self, data):
        id_set = []
        for _, _, r_set in self:
            for row in r_set:
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

    def on_completion(self, data):
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

    def on_completion(self, data):
        log.debug('loaded node set: ' + str(data))
        return self.parse_single_query_response_data(data)

class DBO_match_node_id_set(DB_op):

    def __init__(self, filter_type=None, filter_attr_map=None):
        """
        load a set of nodes according to filter_attr_map
        
        @param filter_attr_map: is a filter_key to filter_value_set map of
               attributes to match against, eg.:
               { 'id':[0,1], 'color: ['red','blue'] } 
        @param filter_type: node type filter 
        @return: loaded node set or an empty set if no match was found
        """

        filter_str = dbu.where_clause_from_filter_attr_map()

        super(DBO_load_node_set, self).__init__()
        q = "match (n) {0} return n".format(filter_str)
        self.add_statement(q, params=filter_attr_map)

        self.add_statement(q, q_params)

    def on_completion(self, data):
        log.debug('loaded id-set: ' + str(data))
        return self.parse_single_query_response_data(data)

class DBO_match_node_set_by_id_attribute(DBO_match_node_id_set):
    def __init__(self, id_set):
        """
        convenience op: load a set of nodes by their 'id' attribute != DB node id
        """
        assert isinstance(id_set, list)

        super(DBO_match_node_set_by_id_attribute, self).__init__(filter_attr_map={'id': id_set})


class DBO_match_link_set_by_src_or_dst_id_attributes(DB_op):
    def __init__(self, src_id=None, dst_id=None):
        """
        match a set of links by source/target node id attributes
        
        @return: a set of loaded links
        """
        assert None != src_id or None != dst_id

        super(DBO_match_link_set_by_src_or_dst_id_attributes, self).__init__()

        if not src_id:
            q = "match ()-[r]->({id: {dst_id}}) return r"
            q_params = {'dst_id': dst_id}
        elif not dst_id:
            q = "match ({id: {src_id}})-[r]->() return r"
            q_params = {'src_id': src_id}
        else:
            q = "match ({id: {src_id}})-[r]->({id: {dst_id}}) return r"
            q_params = {'src_id': src_id, 'dst_id': dst_id}

        self.add_statement(q, q_params)

    def on_completion(self, data):
        log.debug('loaded id-set: ' + str(data))
        return self.parse_single_query_response_data(data)

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

    def on_completion(self, data):
        log.debug('loaded id-set: ' + str(data))
        return self.parse_single_query_response_data(data)

class DB_Driver_Base():
    pass

class DB_Driver_REST(DB_Driver_Base):
    def __init__(self, db_base_url):
        self.tx_base_url = db_base_url + '/db/data/transaction'

    def begin_tx(self, op):
        tx_open_url = self.tx_base_url

        try:
            #
            # [!] neo4j seems picky about receiving an additional empty statement list
            #
            data = data = db_util.statement_set_to_REST_form([])
            ret = db_util.post_neo4j(tx_open_url, data)
            tx_commit_url = ret['commit']
            op.parse_tx_id(tx_commit_url)

            log.debug('tx-open: id: {0}, commit-url: {1}'.format(op.tx_id, tx_commit_url))
        except Exception as e:
            raise Exception('failed to open transaction:' + e.message)

    def exex_op_statements(self, op):
        tx_url = "{0}/{1}".format(self.tx_base_url, op.tx_id)
        statement_set = db_util.statement_set_to_REST_form(op.statement_set)

        try:
            ret = db_util.post_neo4j(tx_url, statement_set)
            op._assign_results_errors(ret)
            self.log_committed_queries(statement_set)
            return ret
        except Exception as e:
            raise Exception('failed exec op statements: err: {0}, url: {1}'.format(e.message, tx_url))

    def commit_tx(self, op):
        tx_commit_url = "{0}/{1}/commit".format(self.tx_base_url, op.tx_id)

        try:
            #
            # [!] neo4j seems picky about receiving an additional empty statement list
            #
            data = db_util.statement_set_to_REST_form([])
            ret = db_util.post(tx_commit_url, data)

            log.debug('tx-commit: id: {0}, commit-url: {1}'.format(op.tx_id, tx_commit_url))

            return ret
        except Exception as e:
            raise Exception('failed to commit transaction:' + e.message)

    def log_committed_queries(self, statement_set):
        for sp_dict in statement_set['statements']:
            log.debug('\tq: {0}'.format(sp_dict['statement']))

class DB_Driver_Embedded(DB_Driver_Base):
    def __init__(self, db_base_url):
        self.tx_base_url = db_base_url + '/db/data/transaction'

        from org.rhizi.db.neo4j.util import EmbeddedNeo4j
        self.edb = EmbeddedNeo4j.createDb()
        self.edb.createDb()

    def begin_tx(self, op):
        pass

    def exex_op_statements(self, op):
        s_set = op.statement_set
        self.edb.executeCypherQury()

    def commit_tx(self, op):
        pass

    def log_committed_queries(self, statement_set):
        for sp_dict in statement_set['statements']:
            log.debug('\tq: {0}'.format(sp_dict['statement']))


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
        try:
            self.db_driver.begin_tx(op)
            ret_tx = self.db_driver.exex_op_statements(op)
            ret_commit = self.db_driver.commit_tx(op)
            return op.on_completion(ret_tx)
        except Exception as e:
            # here we watch for IOExecptions, etc - not db errors
            # these are returned in the db response itself
            log.error(e.message)
            log.error(traceback.print_exc())

    def create_db_op(self, f_work, f_cont):
        ret = DB_op(f_work, f_cont)
        return ret

    def exec_cypher_query(self, q):
        """
        @deprecated: use transaction based api
        """

        # call post and not db_util.post_neo4j to avoid response key errors
        db_util.post(self.config.db_base_url + '/db/data/cypher', {"query" : q})
