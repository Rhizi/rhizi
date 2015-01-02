"""
Rhizi kernel, home to core operation login
"""
import db_controller
import logging
import traceback

log = logging.getLogger('rhizi')

class RZ_Kernel(object):

    def diff_commit__topo(self, db_ctl, topo_diff):
        """
        commit a graph topology diff - this is a common pathway for:
           - RESP API calls
           - socket.io calls
           - future interfaces
        """
        op = db_controller.DBO_topo_diff_commit(topo_diff)
        try:
            op_ret = db_ctl.exec_op(op)
            return op_ret
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e

    def diff_commit__attr(self, db_ctl, attr_diff):
        op = db_controller.DBO_attr_diff_commit(attr_diff)
        try:
            op_ret = db_ctl.exec_op(op)
            return op_ret
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e
