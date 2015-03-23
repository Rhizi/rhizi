#!/usr/bin/python

import logging

from db_driver import DB_Driver_REST, DB_Driver_Base
from db_op import DB_composed_op
from db_op import DB_op
from neo4j_util import Neo4JException
import neo4j_util as db_util


log = logging.getLogger('rhizi')

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
        if isinstance(op, DB_composed_op):  # composed DB op
            log.debug('exec_composed-op:' + op.name)
            for sub_op in op.iter__sub_op():
                sub_op_ret = self.exec_op(sub_op)  # recursive call

            op_ret = op.process_result_set()
            return op_ret

        try:  # non-composed DB op
            self.db_driver.begin_tx(op)
            self.db_driver.exec_query_set(op)
            self.db_driver.commit_tx(op)

            op_ret = op.process_result_set()
            log.debug('exec_op:' + op.name + ': return value: ' + str(op_ret))
            return op_ret

        except Neo4JException as e:
            log.exception(e)  # Neo4JException may be composed of several sub errors, defer to class __str__
            raise e
        except Exception as e:
            # here we watch for IOExecptions, etc - not db errors
            # these are returned in the db response itself

            log.exception(e)
            raise e

    def create_db_op(self, f_work, f_cont):
        ret = DB_op(f_work, f_cont)
        return ret

    def exec_cypher_query(self, q):
        """
        @deprecated: use DBO_cypher_query
        """

        # call post and not db_util.post_neo4j to avoid response key errors
        try:
            db_util.post(self.config.db_base_url + '/db/data/cypher', {"query" : q})
        except Exception as e:
            log.exception(e)
            raise e
