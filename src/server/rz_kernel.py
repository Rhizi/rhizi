"""
Rhizi kernel, home to core operation login
"""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from functools import wraps
import logging
import time
import traceback

from db_controller import DB_Controller
from db_op import (DBO_diff_commit__attr, DBO_block_chain__commit, DBO_rzdoc__create,
    DBO_rzdoc__lookup_by_name, DBO_rzdoc__clone, DBO_rzdoc__delete, DBO_rzdoc__list,
    DBO_block_chain__init, DBO_rzdoc__rename, DBO_nop,
    DBO_match_node_set_by_id_attribute, DBO_rzdb__fetch_DB_metablock,
    DBO_rzdb__init_DB)
from db_op import DBO_diff_commit__topo, DBO_rzdoc__commit_log
from model.graph import Topo_Diff
from model.model import RZDoc
from neo4j_qt import QT_RZDOC_NS_Filter, QT_RZDOC_Meta_NS_Filter
import neo4j_util


log = logging.getLogger('rhizi')

class RZDoc_Exception__not_found(Exception):

    def __init__(self, rzdoc_name):
        super(RZDoc_Exception__not_found, self).__init__('rzdoc not found: \'%s\'' % (rzdoc_name))
        self.rzdoc_name = rzdoc_name

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
        self.mark__invalid = False  # set upon rzdoc deletion

    def __eq__(self, other):
        if not isinstance(other, RZDoc_Reader_Association): return False

        return  self.socket == other.socket

    def __str__(self):
        return '%s: peer-addr: %s:%s' % (self.rzdoc, self.remote_socket_addr[0], self.remote_socket_addr[1])

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
       - activation/shutdown via start(), shutdown()
       - all public methods decorated with deco__exception_log
    """

    def __init__(self):
        self.cache__rzdoc_name_to_rzdoc = {}
        self.heartbeat_period_sec = 0.5
        self.period__db_conn_check = 60
        self.rzdoc_reader_assoc_map = defaultdict(list)

        self.db_ctl = None  # set by caller
        self.op_factory__DBO_rzdb__init_DB = None  # required for DB initialization, set by caller

        self.should_stop = False
        self.db_conn_avail = False
        self.db_metablock_obtained = False

    def start(self):

        def kernel_heartbeat():
            """
            Handle periodic server tasks:
               - manage rzdoc subscriber lists
            """
            t__last_db_conn_check = 0

            while False == self.should_stop:

                t_0 = time.time()

                if t_0 - t__last_db_conn_check > self.period__db_conn_check:
                    try:
                        op = DBO_nop()
                        self.db_ctl.exec_op(op)
                        self.db_conn_avail = True
                    except Exception as e:
                        log.info('rz_kernel: unable to establish DB connection')
                        self.db_conn_avail = False
                    finally:
                        t__last_db_conn_check = t_0

                if self.db_conn_avail and not self.db_metablock_obtained:
                    try:
                        op_probe = DBO_rzdb__fetch_DB_metablock()
                        db_mb = self.db_ctl.exec_op(op_probe)
                        if db_mb is None:
                            log.warning('uninitialized DB detected, attempting initialization')
                            op_init = self.op_factory__DBO_rzdb__init_DB.gen_op__rzdb__init_DB()
                            self.db_ctl.exec_op(op_init)
                            op_probe = DBO_rzdb__fetch_DB_metablock()  # reattempt mb fetch
                            db_mb = self.db_ctl.exec_op(op_probe)
                            log.info('DB initialized, schema-version: %s' % (db_mb['schema_version']))
                        else:
                            log.info('DB metablock read, schema-version: %s' % (db_mb['schema_version']))
                        self.db_metablock_obtained = True
                    except Exception as e:
                        log.info('rz_kernel: failed DB metablock fetch / DB init')

                for rzdoc, r_assoc_set in self.rzdoc_reader_assoc_map.items():
                    for r_assoc in r_assoc_set:

                        if r_assoc.mark__invalid:  # remove expired associations
                            r_assoc_set.remove(r_assoc)
                            log.debug('rz_kernel: removing invalid reader association: remote-addr: %s, rzdoc: %s' % (r_assoc.remote_socket_addr, rzdoc.name))

                        if r_assoc.err_count__IO > 3:
                            r_assoc_set.remove(r_assoc)
                            log.debug('rz_kernel: evicting reader: IO error count exceeded limit: remote-addr: %s, rzdoc: %s' % (r_assoc.remote_socket_addr, rzdoc.name))

                for i in xrange(self.heartbeat_period_sec * 2):
                    if False == self.should_stop:
                        return;
                    time.sleep(0.5)

        self.executor = ThreadPoolExecutor(max_workers=8)
        log.info('rz_kernel: on-line')

        self.executor.submit(kernel_heartbeat)

    def shutdown(self):
        self.should_stop = True
        self.executor.shutdown()
        log.info('rz_kernel: shutting down')

    def cache_lookup__rzdoc(self, rzdoc_name):
        """
        lookup RZDoc by rzdoc_name, possibly triggering a DB query

        @return: RZDoc
        @raise RZDoc_Exception__not_found
        """
        # FIXME: impl cache cleansing logic

        cache_doc = self.cache__rzdoc_name_to_rzdoc.get(rzdoc_name)
        if None != cache_doc:
            return cache_doc

        rz_doc = self.rzdoc__lookup_by_name(rzdoc_name)

        if None == rz_doc:
            raise RZDoc_Exception__not_found(rzdoc_name)

        self.cache__rzdoc_name_to_rzdoc[rzdoc_name] = rz_doc
        return rz_doc

    def diff_commit__topo(self, topo_diff, ctx):
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
        ts_created = self.exec_chain_commit_op(topo_diff, ctx, topo_diff.meta)
        topo_diff.meta['author'] = ctx.user_name
        topo_diff.meta['ts_created'] = ts_created
        op_ret['meta'] = topo_diff.meta
        return topo_diff, op_ret

    def diff_commit__attr(self, attr_diff, ctx):
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
        ts_created = self.exec_chain_commit_op(attr_diff, ctx)
        attr_diff.meta['author'] = ctx.user_name
        attr_diff.meta['ts_created'] = ts_created
        return attr_diff, op_ret

    def exec_chain_commit_op(self, diff_obj, ctx, meta=None):

        # FIXME: clean
        if isinstance(diff_obj, Topo_Diff):
            commit_obj = diff_obj.to_json_dict()
        else:
            commit_obj = diff_obj

        rzdoc = ctx.rzdoc
        op = DBO_block_chain__commit(commit_obj, ctx, meta)
        op = QT_RZDOC_Meta_NS_Filter(rzdoc)(op)
        op_ret = self.db_ctl.exec_op(op)
        return op_ret.meta['ts_created']

    def load_node_set_by_id_attr(self, id_set, ctx=None):
        op = DBO_match_node_set_by_id_attribute(id_set=id_set)
        self.db_ctl.exec_op(op)

    def rzdoc__reader_subscribe(self,
                                remote_socket_addr=None,
                                rzdoc_name=None,
                                socket=None):

        rzdoc = self.cache_lookup__rzdoc(rzdoc_name)

        r_assoc = RZDoc_Reader_Association()
        r_assoc.remote_socket_addr = remote_socket_addr
        r_assoc.rzdoc = rzdoc
        r_assoc.socket = socket

        self.rzdoc_reader_assoc_map[rzdoc].append(r_assoc)
        log.debug("rz_kernel: reader subscribed: assoc: %s" % (r_assoc))

    def rzdoc__reader_unsubscribe__r_assoc(self, r_assoc):
        return self.rzdoc__reader_unsubscribe(r_assoc.remote_socket_addr,
                                              r_assoc.rzdoc_name,
                                              r_assoc.socket)

    def rzdoc__reader_unsubscribe(self,
                                  remote_socket_addr=None,
                                  rzdoc_name=None,
                                  socket=None):

        rzdoc = self.cache_lookup__rzdoc(rzdoc_name)

        rm_target = None
        r_assoc_set = self.rzdoc_reader_assoc_map[rzdoc]
        for r_assoc in r_assoc_set:
            if r_assoc.socket == socket:
                rm_target = r_assoc

        if None == rm_target:  # target possibly removed after becoming stale
            log.debug("rz_kernel: rzdoc__reader_unsubscribe: assoc not found: remote-address: %s" % (remote_socket_addr))
            return

        r_assoc_set.remove(rm_target)  # FIXME: make thread safe
        log.debug("rz_kernel: reader unsubscribed: %s" % (rm_target))

    def rzdoc__reader_set_from_rzdoc(self, rzdoc):
        rzdoc_r_set = self.rzdoc_reader_assoc_map[rzdoc]
        ret_list = list(rzdoc_r_set)
        return ret_list

    def rzdoc__clone(self, rzdoc, ctx=None):
        """
        Clone entire rzdoc

        @return Topo_Diff with node/link attributes
        """
        op = DBO_rzdoc__clone()
        op = QT_RZDOC_NS_Filter(rzdoc)(op)

        topo_diff = self.db_ctl.exec_op(op)
        return topo_diff

    def rzdoc__commit_log(self, rzdoc, limit):
        """
        return commit log
        """
        op = DBO_rzdoc__commit_log(limit=limit)
        op = QT_RZDOC_Meta_NS_Filter(rzdoc)(op)

        commit_log = self.db_ctl.exec_op(op)
        return commit_log

    def rzdoc__create(self, rzdoc_name, ctx=None):
        """
        Create & persist new RZDoc - may fail on unique name/id constraint violation

        @return: RZDoc object
        @raise RZDoc_Exception__already_exists
        """
        try:
            self.cache_lookup__rzdoc(rzdoc_name)
            raise RZDoc_Exception__already_exists(rzdoc_name)
        except RZDoc_Exception__not_found: pass

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

        self.cache__rzdoc_name_to_rzdoc.pop(rzdoc.name, None)

        for r_assoc in self.rzdoc_reader_assoc_map[rzdoc]:
            r_assoc.mark__invalid = True

        # FIXME:
        #    - broadcast delete event

    def rzdoc__lookup_by_name(self, rzdoc_name, ctx=None):
        """
        @param ctx: may be None

        @return: RZDoc object or None if rzdoc was not found
        """

        op = DBO_rzdoc__lookup_by_name(rzdoc_name)

        rzdoc = self.db_ctl.exec_op(op)
        return rzdoc  # may be None

    def rzdoc__list(self, ctx=None):
        """
        List available RZDocs

        @return: RZDoc object
        """
        op = DBO_rzdoc__list()
        op_ret = self.db_ctl.exec_op(op)
        return op_ret

    def rzdoc__rename(self, cur_name, new_name):
        op = DBO_rzdoc__rename(cur_name, new_name)

        rzdoc = self.db_ctl.exec_op(op)

        self.cache__rzdoc_name_to_rzdoc.pop(cur_name, None)
        self.cache__rzdoc_name_to_rzdoc.pop(new_name, None)

        # FIXME:
        #    - broadcast rename event
        #    - notify all rzdoc readers

        return rzdoc  # may be None
