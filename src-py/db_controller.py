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
        self.s_id = 0  # statement id counter
        self.id_to_statement_map = {}  # zero based id to statement map
        self.tx_id = None
        self.tx_commit_url = None  # cached from response to tx begin

    def parse_tx_id(self, tx_commit_url):
        m = re.search('/(?P<id>\d+)/commit$', tx_commit_url)
        id_str = m.group('id')
        self.tx_id = int(id_str)

    def add_statement(self, cypher_query, params={}):
        """
        add a DB query language statement
        @return: statement id
        """
        ret = self.s_id
        self.id_to_statement_map[self.s_id] = dbu.statement_to_REST_form(cypher_query, params)
        self.s_id = self.s_id + 1
        return ret

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
                ret.append(row)
        return ret

    def parse_multi_statement_response_data(self, data):
        pass

    def on_completion(self, data):
        self.result_set = data['results']
        self.error_set = data['errors']

        pass

class DBO_add_node_set(DB_op):
    def __init__(self, node_map, input_to_DB_property_map=lambda _: _):
        """
        DB op: add node set
        
        @param node_map: node-type to node list map
        @input_to_DB_property_map: optional function which takes a map of input properties and returns a map of DB properties - use to map input schemas to DB schemas
        """
        super(DBO_add_node_set, self).__init__()

        for k, v in node_map.iteritems():  # do some type sanity checking
            assert isinstance(k, basestring)
            assert isinstance(v, list)

        self.node_map = node_map

        for type, n_set in self.node_map.items():
            q = "create (n:{0} {{prop_dict}}) return id(n)".format(type)
            for n_prop_dict in n_set:
                p = {'prop_dict' : input_to_DB_property_map(n_prop_dict)}
                self.add_statement(q, p)

    def on_completion(self, data):
        # [!] fragile - parse results
        # sample input: dict: {u'errors': [], u'results': [{u'data': [{u'row': [20]}], u'columns': [u'id(n)']}]}
        id_set = []
        for r in data['results']:
            columns = r['columns']
            for k in r['data']:
                nid = k['row'][0]
                id_set.append(nid)

        log.debug('node-set added: ids: ' + str(id_set))
        return id_set

class DBO_add_link_set(DB_op):
    def __init__(self, link_map):
        """
        @param link_map: is a link-type to link-set map - see model.link
        """
        super(DBO_add_link_set, self).__init__()
        for q, q_params in db_util.gen_query_create_from_link_map(link_map):
            self.add_statement(q, q_params)

    def on_completion(self, data):
        super(DBO_add_link_set, self).on_completion(data)

        id_set = []
        for s_id, s, r_set in self:
            for row in r_set:
                # [!] fragile - parse results
                lid = row
                id_set.append(lid)

        log.debug('link-set added: ids: ' + str(id_set))
        return id_set

class DBO_load_node_set_by_DB_id(DB_op):
    def __init__(self, id_set):
        """
        load a set of nodes whose DB id is in id_set
        
        @return: loaded node set or an empty set if no match was found
        """
        super(DBO_load_node_set_by_DB_id, self).__init__()
        q = "match (n) where id(n) in {id_set} return n"
        self.add_statement(q, { 'id_set': id_set})

    def on_completion(self, data):
        log.debug('loaded node set: ' + str(data))
        return self.parse_single_query_response_data(data)

class DBO_load_node_set(DB_op):

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

class DBO_load_node_set_by_id_attribute(DBO_load_node_set):
    def __init__(self, id_set):
        """
        convenience op: load a set of nodes by their 'id' attribute != DB node id
        """
        assert isinstance(id_set, list)

        super(DBO_load_node_set_by_id_attribute, self).__init__({'id': id_set})

class DBO_load_link_id_set(DB_op):
    def __init__(self, filter_type=None, filter_attr_map=None):
        """
        load a set of link ids
        
        @param filter_type: link type filter 
        @param filter_attr_map: is a filter_key to filter_value_set map of
               attributes to match link properties against
        @return: a set of loaded link ids
        """
        filter_str = dbu.where_clause_from_filter_attr_map()
        

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
            data = data = dbu.statement_set_to_REST_form([])
            ret = dbu.post_neo4j(tx_open_url, data)
            tx_commit_url = ret['commit']
            op.parse_tx_id(tx_commit_url)

            log.debug('tx-open: id: {0}, commit-url: {1}'.format(op.tx_id, tx_commit_url))
        except Exception as e:
            raise Exception('failed to open transaction:' + e.message)

    def exex_op_statements(self, op):
        tx_url = "{0}/{1}".format(self.tx_base_url, op.tx_id)
        statement_set = dbu.statement_set_to_REST_form(op.statement_set)

        try:
            ret = dbu.post_neo4j(tx_url, statement_set)
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
            data = dbu.statement_set_to_REST_form([])
            ret = dbu.post(tx_commit_url, data)

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

        # call post and not dbu.post_neo4j to avoid response key errors
        dbu.post(self.config.db_base_url + '/db/data/cypher', {"query" : q})
