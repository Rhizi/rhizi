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


import logging

from neo4j_util import Neo4JException
import neo4j_util as db_util

log = logging.getLogger('rhizi')

class DB_Driver_Base():

    def log_committed_queries(self, statement_set):
        indent_prefix = '  '
        for sp_dict in statement_set['statements']:
            if None != sp_dict['parameters']:
                msg = indent_prefix + 'q: {0}\n\tp: {1}'.format(sp_dict['statement'].encode('utf-8'),
                                                  sp_dict['parameters'])
            else:
                msg = indent_prefix + 'q: {0}'.format(sp_dict['statement'])
            log.debug(msg)

class DB_Driver_Embedded(DB_Driver_Base):

    def __init__(self, db_base_url):
        self.tx_base_url = db_base_url + '/db/data/transaction'

        from org.rhizi.db.neo4j.util import EmbeddedNeo4j
        self.edb = EmbeddedNeo4j.createDb()
        self.edb.createDb()

    def begin_tx(self, op):
        pass

    def exec_query_set(self, op):
        pass

    def commit_tx(self, op):
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
            data = db_util.db_query_set_to_REST_form([])  # open TX with empty query_set
            ret = db_util.post_neo4j(tx_open_url, data)
            tx_commit_url = ret['commit']
            op.parse_tx_id(tx_commit_url)

            log.debug('tx-open: id: {0}, commit-url: {1}'.format(op.tx_id, tx_commit_url))
        except Exception as e:
            raise Exception('failed to open transaction: ' + e.message)

    def exec_query_set(self, op):

        tx_url = "{0}/{1}".format(self.tx_base_url, op.tx_id)
        statement_param_pair_set = db_util.db_query_set_to_REST_form(op.query_set)

        try:
            post_ret = db_util.post_neo4j(tx_url, statement_param_pair_set)
            op.result_set = post_ret['results']
            op.error_set = post_ret['errors']
            if 0 != len(op.error_set):
                raise Neo4JException(op.error_set)

            self.log_committed_queries(statement_param_pair_set)
        except Neo4JException as e:
            # NOTE: python 2.7 loses the stack when reraising the exception.
            # python 3 does the right thing, but gevent doesn't support it yet.
            log.error('REST statement: %r' % statement_param_pair_set)
            log.exception(e)
            raise e
        except Exception as e:
            log.error('REST statement: %r' % statement_param_pair_set)
            log.exception(e)
            raise Exception('failed exec op statements: err: {0}, url: {1}'.format(e.message, tx_url))

    def commit_tx(self, op):
        tx_commit_url = "{0}/{1}/commit".format(self.tx_base_url, op.tx_id)

        try:
            #
            # [!] neo4j seems picky about receiving an additional empty statement list
            #
            data = db_util.db_query_set_to_REST_form([])  # close TX with empty query_set
            ret = db_util.post(tx_commit_url, data)

            log.debug('tx-commit: id: {0}, commit-url: {1}'.format(op.tx_id, tx_commit_url))

            return ret
        except Exception as e:
            raise Exception('failed to commit transaction:' + e.message)
