"""
Rhizi kernel, home to core operation login
"""
import logging
import traceback

import db_controller
from db_op import DBO_diff_commit__attr
from db_op import DBO_diff_commit__topo


log = logging.getLogger('rhizi')

class RZ_Kernel(object):

    def diff_commit__topo(self, topo_diff):
        """
        commit a graph topology diff - this is a common pathway for:
           - RESP API calls
           - socket.io calls
           - future interfaces
           
        @return: a tuple containing the input diff and the result of it's commit
        """
        op = DBO_diff_commit__topo(topo_diff)
        try:
            op_ret = self.db_ctl.exec_op(op)
            return topo_diff, op_ret
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e

    def diff_commit__attr(self, attr_diff):
        """
        commit a graph attribute diff - this is a common pathway for:
           - RESP API calls
           - socket.io calls
           - future interfaces
           
        @return: a tuple containing the input diff and the result of it's commit
        """
        op = DBO_diff_commit__attr(attr_diff)
        try:
            op_ret = self.db_ctl.exec_op(op)
            return attr_diff, op_ret
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e
