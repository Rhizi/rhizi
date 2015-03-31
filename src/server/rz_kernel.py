"""
Rhizi kernel, home to core operation login
"""
import json
import logging
import traceback

from db_op import DBO_diff_commit__attr, DBO_block_chain__commit, DBO_rzdoc__create, \
    DBO_rzdoc__lookup_by_name, DBO_rz_clone, DBO_rzdoc__delete, DBO_rzdoc__list
from db_op import DBO_diff_commit__topo
from model.graph import Topo_Diff
from neo4j_cypher import QT_RZDOC_NS_Filter, QT_RZDOC_Meta_NS_Filter
from model.model import RZDoc
import neo4j_util


log = logging.getLogger('rhizi')

class RZDoc_Exception__not_found(Exception):

    def __init__(self, rzdoc_name):
        super(RZDoc_Exception__not_found, self).__init__('rzdoc not found: \'%s\'' % (rzdoc_name))

class RZ_Kernel(object):

    def __init__(self):
        self.db_ctl = None

    def exec_chain_commit_op(self, diff_obj, ctx):

        # FIXME: clean
        if isinstance(diff_obj, Topo_Diff):
            commit_obj = diff_obj.to_json_dict()
        else:
            commit_obj = diff_obj

        rzdoc = ctx.rzdoc
        chain_commit_op = DBO_block_chain__commit(commit_obj, ctx)
        chain_commit_op = QT_RZDOC_Meta_NS_Filter(rzdoc)(chain_commit_op)
        self.db_ctl.exec_op(chain_commit_op)

    def diff_commit__topo(self, topo_diff, ctx=None):
        """
        commit a graph topology diff - this is a common pathway for:
           - RESP API calls
           - socket.io calls
           - future interfaces
           
        @return: a tuple containing the input diff and the result of it's commit
        """
        rzdoc = ctx.rzdoc
        op = DBO_diff_commit__topo(topo_diff)
        op = QT_RZDOC_NS_Filter(rzdoc)(op)

        try:
            op_ret = self.db_ctl.exec_op(op)

            self.exec_chain_commit_op(topo_diff, ctx)

            return topo_diff, op_ret
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e

    def diff_commit__attr(self, attr_diff, ctx=None):
        """
        commit a graph attribute diff - this is a common pathway for:
           - RESP API calls
           - socket.io calls
           - future interfaces
           
        @return: a tuple containing the input diff and the result of it's commit
        """
        rzdoc = ctx.rzdoc
        op = DBO_diff_commit__attr(attr_diff)
        op = QT_RZDOC_NS_Filter(rzdoc)(op)

        try:
            op_ret = self.db_ctl.exec_op(op)

            self.exec_chain_commit_op(attr_diff, ctx)

            return attr_diff, op_ret
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e

    def rzdoc__clone(self, rzdoc, ctx=None):
        """
        Clone entire rzdoc

        @return Topo_Diff with node/link attributes
        """
        op = DBO_rzdoc__clone()
        op = QT_RZDOC_NS_Filter(rzdoc)(op)

        try:
            topo_diff = self.db_ctl.exec_op(op)
            return topo_diff
        except Exception as e:
            log.exception(e)
            log.error(traceback.print_exc())
            raise e

    def rzdoc__lookup_by_name(self, rzdoc_name, ctx=None):
        """
        @param ctx: may be None

        @return: RZDoc object or None if rzdoc was not found
        """

        op = DBO_rzdoc__lookup_by_name(rzdoc_name)
        try:
            rzdoc = self.db_ctl.exec_op(op)
            if None == rzdoc: return None

            return rzdoc
        except Exception as e:
            log.error(e.message)
            raise e

    def rzdoc__create(self, rzdoc_name, ctx=None):
        """
        Create & persist new RZDoc - may fail on unique name/id constraint violation

        @return: RZDoc object
        """

        rzdoc_id = neo4j_util.generate_random_rzdoc_id()
        rzdoc = RZDoc(rzdoc_id, rzdoc_name)

        op = DBO_rzdoc__create(rzdoc)
        try:
            self.db_ctl.exec_op(op)
            return rzdoc
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e

    def rzdoc__delete(self, rzdoc, ctx=None):
        """
        Delete RZDoc

        @return: RZDoc object
        """

        op = DBO_rzdoc__delete(rzdoc)
        try:
            self.db_ctl.exec_op(op)
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e

        # TODO: broadcast delete event, clear cache mapping entry

    def rzdoc__list(self, rzdoc, ctx=None):
        """
        List available RZDocs

        @return: RZDoc object
        """
        op = DBO_rzdoc__list()
        try:
            op_ret = self.db_ctl.exec_op(op)
            return op_ret;
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e
