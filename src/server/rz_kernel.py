"""
Rhizi kernel, home to core operation login
"""
import json
import logging
import traceback

import db_controller
from db_op import DBO_diff_commit__attr, DBO_block_chain__commit
from db_op import DBO_diff_commit__topo
from model.graph import Topo_Diff
from neo4j_cypher import QT_Node_Filter__Doc_ID_Label


log = logging.getLogger('rhizi')

class RZ_Kernel(object):

    def exec_chain_commit_op(self, diff_obj, ctx):

        # FIXME: clean
        if isinstance(diff_obj, Topo_Diff):
            commit_obj = diff_obj.to_json_dict()
        else:
            commit_obj = diff_obj

        chain_commit_op = DBO_block_chain__commit(commit_obj, ctx)
        self.db_ctl.exec_op(chain_commit_op)

    def diff_commit__topo(self, topo_diff, ctx=None):
        """
        commit a graph topology diff - this is a common pathway for:
           - RESP API calls
           - socket.io calls
           - future interfaces
           
        @return: a tuple containing the input diff and the result of it's commit
        """
        rzdoc_id = ctx.get('rzdoc_id')
        assert rzdoc_id, 'diff_commit__topo: missing doc id'

        op = DBO_diff_commit__topo(topo_diff)
        op = QT_Node_Filter__Doc_ID_Label(rzdoc_id)(op)

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
        rzdoc_id = ctx.get('rzdoc_id')
        assert rzdoc_id, 'diff_commit__topo: missing doc id'

        op = DBO_diff_commit__attr(attr_diff)
        op = QT_Node_Filter__Doc_ID_Label(rzdoc_id)(op)

        try:
            op_ret = self.db_ctl.exec_op(op)

            self.exec_chain_commit_op(attr_diff, ctx)

            return attr_diff, op_ret
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e
