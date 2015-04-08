"""
Rhizi kernel, home to core operation login
"""
import json
import logging
import traceback

from db_op import DBO_diff_commit__attr, DBO_block_chain__commit, DBO_rzdoc__create, \
    DBO_rzdoc__lookup_by_name, DBO_rzdoc__clone, DBO_rzdoc__delete, DBO_rzdoc__list,\
    DBO_block_chain__init
from db_op import DBO_diff_commit__topo
from model.graph import Topo_Diff
from model.model import RZDoc
import neo4j_util
from neo4j_qt import QT_RZDOC_NS_Filter, QT_RZDOC_Meta_NS_Filter


log = logging.getLogger('rhizi')

class RZDoc_Exception__not_found(Exception):

    def __init__(self, rzdoc_name):
        super(RZDoc_Exception__not_found, self).__init__('rzdoc not found: \'%s\'' % (rzdoc_name))

class RZDoc_Exception__already_exists(Exception):

    def __init__(self, rzdoc_name):
        super(RZDoc_Exception__already_exists, self).__init__('rzdoc already exists: \'%s\'' % (rzdoc_name))

class RZDoc_Reader_Association:
    """
    RZDoc reader association used to map rzdoc's to update subscribing readers.

    Note: the term reader is used to represent a party performing R/W operations
    """

    def __init__(self):
        self.remote_socket_addr = None  # (addr, port)
        self.rzdoc = None
        self.socket = None
        self.err_count__IO = 0  # allow n IO errors before disconnecting reader
        self.mark__expired = False

    def __eq__(self, other):
        if not isinstance(other, RZDoc_Reader_Association): return False

        return  self.socket == other.socket

    def __str__(self):
        return '%s: remote addr: %s:%s' % (self.rzdoc, self.remote_socket_addr[0], self.remote_socket_addr[1])

def deco__exception_log(kernel_f):
    """
    Exception logger function decorator
    """

    @wraps(kernel_f)
    def f_decorated(self, *args, **kwargs):
        try:
            ret = kernel_f(self, *args, **kwargs)
            return ret
        except Exception as e:
            log.error(e.message)
            log.error(traceback.print_exc())
            raise e

    return f_decorated

def for_all_public_functions(decorator):

    def cls_decorated(cls):
        for attr in cls.__dict__:
            if callable(getattr(cls, attr)) and not attr.startswith('_'):
                setattr(cls, attr, decorator(getattr(cls, attr)))
        return cls
    return cls_decorated

@for_all_public_functions(deco__exception_log)
class RZ_Kernel(object):
    """
    RZ kernel:
       - all public methods decorated with deco__exception_log
    """

    def __init__(self):
        self.db_ctl = None

    def exec_chain_commit_op(self, diff_obj, ctx):

        # FIXME: clean
        if isinstance(diff_obj, Topo_Diff):
            commit_obj = diff_obj.to_json_dict()
        else:
            commit_obj = diff_obj

        rzdoc = ctx.rzdoc
        op = DBO_block_chain__commit(commit_obj, ctx)
        op = QT_RZDOC_Meta_NS_Filter(rzdoc)(op)
        self.db_ctl.exec_op(op)

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

        op_ret = self.db_ctl.exec_op(op)
        self.exec_chain_commit_op(topo_diff, ctx)
        return topo_diff, op_ret

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

        op_ret = self.db_ctl.exec_op(op)
        self.exec_chain_commit_op(attr_diff, ctx)
        return attr_diff, op_ret



    def rzdoc__clone(self, rzdoc, ctx=None):
        """
        Clone entire rzdoc

        @return Topo_Diff with node/link attributes
        """
        op = DBO_rzdoc__clone()
        op = QT_RZDOC_NS_Filter(rzdoc)(op)

        topo_diff = self.db_ctl.exec_op(op)
        return topo_diff

    def rzdoc__lookup_by_name(self, rzdoc_name, ctx=None):
        """
        @param ctx: may be None

        @return: RZDoc object or None if rzdoc was not found
        """

        op = DBO_rzdoc__lookup_by_name(rzdoc_name)

        rzdoc = self.db_ctl.exec_op(op)
        return rzdoc  # may be None

    def rzdoc__create(self, rzdoc_name, ctx=None):
        """
        Create & persist new RZDoc - may fail on unique name/id constraint violation

        @return: RZDoc object
        @raise RZDoc_Exception__already_exists
        """
        try:
            self.cache_lookup__rzdoc(rzdoc_name)
            raise RZDoc_Exception__already_exists(rzdoc_name)
        except RZDoc_Exception__not_found:
            pass

        rzdoc = RZDoc(rzdoc_name)
        rzdoc.id = neo4j_util.generate_random_rzdoc_id()

        op__rzdoc__create = DBO_rzdoc__create(rzdoc)
        op__block_chain__init = DBO_block_chain__init(rzdoc)

        self.db_ctl.exec_op(op__rzdoc__create)
        self.db_ctl.exec_op(op__block_chain__init)
        return rzdoc

    def rzdoc__delete(self, rzdoc, ctx=None):
        """
        Delete RZDoc

        @return: RZDoc object
        """

        op = DBO_rzdoc__delete(rzdoc)
        self.db_ctl.exec_op(op)

        # TODO: broadcast delete event, clear cache mapping entry

    def rzdoc__list(self, rzdoc, ctx=None):
        """
        List available RZDocs

        @return: RZDoc object
        """
        op = DBO_rzdoc__list()
        op_ret = self.db_ctl.exec_op(op)
        return op_ret;
