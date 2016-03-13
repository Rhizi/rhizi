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


"""
Rhizi kernel, home to core operation login
"""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from functools import wraps
import logging
import time
import traceback
import sys

from .db_op import (DBO_diff_commit__attr, DBO_block_chain__commit, DBO_rzdoc__create,
    DBO_rzdoc__lookup_by_name, DBO_rzdoc__clone, DBO_rzdoc__delete, DBO_rzdoc__search,
    DBO_block_chain__init, DBO_rzdoc__rename, DBO_nop,
    DBO_match_node_set_by_id_attribute, DBO_rzdb__fetch_DB_metablock,
    DBO_rzdoc__commit_log, DBO_factory__default, DBO_raw_query_set,
    DBO_rzdoc__commit, DBO_find_links_touching, DBO_find_rzdocs_touching,
    DBO_add_node_set, DBO_add_link_set)
from . import neo4j_util as db_util
from .db_op import DBO_diff_commit__topo
from .model.graph import Topo_Diff, split_off_attr_diff
from .model.model import RZDoc
from .neo4j_qt import QT_RZDOC_Meta_NS_Filter
from .neo4j_util import generate_random_rzdoc_id
from .neo4j_util import RESERVED_LABEL__EMPTY_STRING # TODO: move this to db_op
from . import neo4j_schema


python2 = sys.version_info[0] == 2

log = logging.getLogger('rhizi')


def dictunion(d, *ds):
    # TODO: test me
    ret = dict(d)
    for d2 in ds:
        ret.update(d2)
    return ret


class RZDoc_Exception__not_found(Exception):

    def __init__(self, rzdoc_name):
        super(RZDoc_Exception__not_found, self).__init__('rzdoc not found: \'%s\'' % (rzdoc_name))
        self.rzdoc_name = rzdoc_name

class RZDoc_Exception__already_exists(Exception):

    def __init__(self, rzdoc_name):
        super(RZDoc_Exception__already_exists, self).__init__('rzdoc already exists: \'%s\'' % (rzdoc_name))

class RZKernel_Exception__DB_conn_unavailable(Exception):

    def __init__(self):
        super(RZKernel_Exception__DB_conn_unavailable, self).__init__('DB connection unavailable')

class RZKernel_Exception__DB_metablock_unavailable(Exception):

    def __init__(self):
        super(RZKernel_Exception__DB_metablock_unavailable, self).__init__('DB metablock unavailable')


class RZDoc_Client_Association:
    """
    RZDoc client association used to map rzdoc's to update subscribing clients.
    """

    def __init__(self):
        self.rzdoc = None
        self.sid = None
        self.err_count__IO = 0  # allow n IO errors before disconnecting reader
        self.mark__invalid = False  # set upon rzdoc deletion

    def __eq__(self, other):
        return isinstance(other, RZDoc_Client_Association) and self.sid == other.sid

    def __str__(self):
        return '%s: sid: %s' % (self.rzdoc, self.sid)

    def __hash__(self):
        # only valid if sid is not None
        assert self.sid is not None
        return hash(self.sid)


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
            if python2:
                log.error(e.args)
                log.error(traceback.print_exc())
            raise e

    return f_decorated

def deco__DB_status_check(kernel_f):
    """
    Check DB status:
       - connection available
       - DB metablock available
    """

    @wraps(kernel_f)
    def f_decorated(self, *args, **kwargs):
        if False == self.db_conn_avail:
            raise RZKernel_Exception__DB_conn_unavailable()
        if self.db_metablock is None:
            raise RZKernel_Exception__DB_metablock_unavailable()

        return kernel_f(self, *args, **kwargs)

    return f_decorated

def for_all_public_functions(decorator):

    def cls_decorated(cls):
        for attr in cls.__dict__:
            if callable(getattr(cls, attr)) and not attr.startswith('_'):
                setattr(cls, attr, decorator(getattr(cls, attr)))
        return cls
    return cls_decorated

#@for_all_public_functions(deco__exception_log)
class RZ_Kernel(object):
    """
    RZ kernel:
       - activation/shutdown via start(), shutdown()
       - all public methods decorated with deco__exception_log
    """

    def __init__(self):
        """
        caller must set:
           - self.db_ctl

        caller may set:
           - self.db_op_factory: mush support gen_op__rzdb__init_DB()
        """

        self.cache__rzdoc_name_to_rzdoc = {}
        self.heartbeat_period_sec = 0.5
        self.period__db_conn_check = 60
        self.rzdoc_client_assoc_map = defaultdict(list)

        self.db_ctl = None  # set by caller
        self.db_op_factory = DBO_factory__default()

        self.should_stop = False
        self.db_conn_avail = False
        self.db_metablock = None

    def _exec_chain_commit_op(self, diff_obj, ctx, meta=None):

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

    def _init_DB(self):
        op_init = self.db_op_factory.gen_op__rzdb__init_DB()
        self.db_ctl.exec_op(op_init)
        op_probe = DBO_rzdb__fetch_DB_metablock()  # reattempt mb fetch
        db_mb = self.db_ctl.exec_op(op_probe)
        log.info('DB initialized, schema-version: %s' % (db_mb['schema_version']))
        return db_mb

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

                if self.db_conn_avail and self.db_metablock is None:
                    try:
                        op_probe = DBO_rzdb__fetch_DB_metablock()
                        db_mb = self.db_ctl.exec_op(op_probe)
                        if db_mb is None:
                            log.warning('uninitialized DB detected, attempting initialization')
                            db_mb = self._init_DB()
                        else:
                            log.info('DB metablock read, schema-version: %s' % (db_mb['schema_version']))

                        self.db_metablock = db_mb
                    except Exception as e:
                        log.info('rz_kernel: failed DB metablock fetch / DB init')

                for rzdoc, r_assoc_set in self.rzdoc_client_assoc_map.items():
                    for r_assoc in r_assoc_set:

                        if r_assoc.mark__invalid:  # remove expired associations
                            r_assoc_set.remove(r_assoc)
                            log.debug('rz_kernel: removing invalid reader association: sid: %s, rzdoc: %s' % (r_assoc.sid, rzdoc.name))

                        if r_assoc.err_count__IO > 3:
                            r_assoc_set.remove(r_assoc)
                            log.debug('rz_kernel: evicting reader: IO error count exceeded limit: sid: %s, rzdoc: %s' % (r_assoc.sid, rzdoc.name))

                for i in range(self.heartbeat_period_sec * 2):
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

    def cache_lookup__rzdoc(self, rzdoc_name, raise_if_missing=True):
        """
        lookup RZDoc by rzdoc_name, possibly triggering a DB query

        @raise RZDoc_Exception__not_found if raise_if_missing
        @return: RZDoc or None
        """
        # FIXME: impl cache cleansing logic

        cache_doc = self.cache__rzdoc_name_to_rzdoc.get(rzdoc_name)
        if None != cache_doc:
            return cache_doc

        rz_doc = self.rzdoc__lookup_by_name(rzdoc_name)

        if None == rz_doc:
            if raise_if_missing:
                raise RZDoc_Exception__not_found(rzdoc_name)
            return None

        self.cache__rzdoc_name_to_rzdoc[rzdoc_name] = rz_doc
        return rz_doc

    def is_DB_status__ok(self):
        return self.db_conn_avail and self.db_metablock is not None

    def _find_links_touching(self, node_id_set):
        norm_op = DBO_find_links_touching(node_ids=node_id_set)
        norm_op_ret = self.db_ctl.exec_op(norm_op)
        return set(norm_op_ret)

    def _commit__topo__helper(self, topo_diff, rzdoc):
        """
        helper that does not produce a commit. used by two paths:
         - the regular topo diff
         - restoring from backup, where we create a new document and produce the commit
           history from the backup as well.

        Implementation notes:
            1. first add new nodes and links. Result contains id map for ids of existing
               nodes, use those for next query
            2. update document to meta nodes links, return removed nodes and links
            3. remove nodes and links from real graph

        TODO: translate all of this to a DB_composed op - not sure it is better (faster db transactions) but it
        is perhaps easier to run testing for it?

        :param topo_diff:
        :param ctx:
        :return: return of the DBO_diff_commit__topo operation
        """
        # find any existing nodes and links, remove them from the topo_diff, and instead
        # just add the document label to them
        for x in topo_diff.node_set_add:
            assert set(x.keys()) >= {'name', 'id'}

        # assert no overlapping in ids between removed and added parts - no
        # reason to support that (we cannot test for removed links without a
        # query so skip that for now, later maybe incorporate it into the
        # query)
        overlapped_ids = (({x['id'] for x in topo_diff.node_set_add} |
                 {x['__src_id'] for x in topo_diff.link_set_add} |
                 {x['__dst_id'] for x in topo_diff.link_set_add}) &
                 set(topo_diff.node_id_set_rm))
        assert overlapped_ids == set(), "{} != %s" % overlapped_ids

        #import pdb; pdb.set_trace()

        # 1. NORMALIZE. expand the given node set to include all touching links.
        links_touching = self._find_links_touching(topo_diff.node_id_set_rm)
        topo_diff.link_id_set_rm = list(set(topo_diff.link_id_set_rm) | links_touching)

        # 2. commit node addition
        n_add_map = db_util.meta_attr_list_to_meta_attr_map(topo_diff.node_set_add)
        n_add_map, attr_diff = split_off_attr_diff(n_add_map)
        add_node_op = DBO_add_node_set(n_add_map)
        add_node_ret = self.db_ctl.exec_op(add_node_op)

        # 2.2 commit attr write
        op = DBO_diff_commit__attr(attr_diff)
        self.db_ctl.exec_op(op)

        # 2.5 update node and link id (node for meta commit, link for both regular and meta)
        asked_to_returned = {d['asked_id']: d['id'] for d in add_node_ret}
        def translate_id(dict_list, mapper):
            return [{k:(v if k != 'id' else mapper[v]) for k, v in d.items()} for d in dict_list]
        topo_diff.node_set_add = translate_id(topo_diff.node_set_add, asked_to_returned)
        def map_src_dst_v(k, v):
            if k in ['__src_id', '__dst_id']:
                return asked_to_returned.get(v, v)
            return v
        topo_diff.link_set_add = [{k:map_src_dst_v(k, v) for k, v in d.items()}
                                  for d in topo_diff.link_set_add]

        # 3. commit link addition
        l_add_map = db_util.meta_attr_list_to_meta_attr_map(topo_diff.link_set_add, meta_attr='__type')
        add_link_op = DBO_add_link_set(l_add_map)
        add_link_ret = self.db_ctl.exec_op(add_link_op)

        # 4. adjust ids for meta commit based on actual ids
        asked_to_returned_link = {d['asked_id']: d['id'] for d in add_link_ret}
        topo_diff.link_set_add = translate_id(topo_diff.link_set_add, asked_to_returned_link)

        # 5. commit meta doc part in one go. returns removed links and nodes.
        meta_op = DBO_rzdoc__commit(topo_diff, rzdoc=rzdoc)

        removed_nodes, removed_links = self.db_ctl.exec_op(meta_op)

        nodes_d = dict(removed_nodes)
        links_d = dict(removed_links)
        node_id_set_rm = [nid for nid, link_count in nodes_d.items() if link_count == 0]
        link_id_set_rm = [lid for lid, link_count in links_d.items() if link_count == 0]

        # 6. commit removal part
        topo_diff_rm = Topo_Diff(node_id_set_rm=node_id_set_rm, link_id_set_rm=link_id_set_rm)
        graph_op_rm = DBO_diff_commit__topo(topo_diff_rm)
        graph_op_rm_ret = self.db_ctl.exec_op(graph_op_rm)

        # Return dictionary:
        # removed requested (from single client standpoint, and Doc standpoint, anything requested to be removed
        # has been removed).
        ret = {
            'node_id_set_rm': topo_diff.node_id_set_rm,
            'link_id_set_rm': topo_diff.link_id_set_rm
        }

        # 7. retreive nodes that were not given in the request
        link_node_ids_set = {l['__dst_id'] for l in add_link_ret} | {l['__src_id'] for l in add_link_ret}
        touched_node_ids = list(set(asked_to_returned.values()) | link_node_ids_set)
        ret.update(self._clone_subset(node_ids=touched_node_ids))

        # return augmented graph_op_ret with add operation
        ret['link_id_set_add'] = list(asked_to_returned_link.values())
        ret['node_id_set_add'] = list(asked_to_returned.values()) # TODO: verify the nodes are returned complete with data. (if too large we need a direct client->large fields path)

        assert set(ret['node_id_set_rm']) >= set(topo_diff.node_id_set_rm)

        return ret

    def _clone_subset(self, node_ids):
        """
        clone all nodes that match given ids, return links matching as well

        :param node_ids:
        :return: {'node_set_add': [same as TopoDiff.node_set_add], 'link_set_add':[same as TopoDiff.link_set_add]}
         TODO: use TopoDiff?
        """
        # TODO: you cannot ask for a link without asking for it's source and dest nodes. do we enforce that?
        # TODO: can merge into 1? all of this requires improvement to reduce query count? need benchmarking to figure out if this is a real problem.
        # TODO 2: put this into db_op, test it individually (as a lower layer, below / unknowing of rz_kernel).
        node_label = neo4j_schema.META_LABEL__RZDOC_NODE
        q_arr = [
            "match (n:%s) where n.id in {ids}" % node_label,
            "optional match (n1:%s)-[l]->(n2:%s)" % (node_label, node_label),
            "where n1.id in {ids} and n2.id in {ids}",
            'return collect([n, filter(l in labels(n) where l <> "%s")]),' % node_label,
            "collect(distinct([l, type(l), startNode(l).id, endNode(l).id]))"
        ]
        op = DBO_raw_query_set(q_arr=q_arr, q_params={'ids': node_ids})
        op_ret = self.db_ctl.exec_op(op)
        def db_to_client__type(ztype):
            if ztype == RESERVED_LABEL__EMPTY_STRING:
                return ''
            return ztype
        return {
         'node_set_add': [dictunion(n,
                                    {
                                        '__label_set': label_set,
                                        'type': label_set[0].lower() # TODO: this should be done at the client. plus - no verification??
                                    }) for n, label_set in op_ret[0]],
         'link_set_add': [dictunion(l,
                                    {
                                        '__type': [db_to_client__type(ztype)],

                                        # TODO computed from __type, do this at client
                                        'name': db_to_client__type(ztype),

                                        '__src_id': src_id,
                                        '__dst_id': dst_id
                                    })
                          for l, ztype, src_id, dst_id in op_ret[1] if l is not None],
        }

    @deco__DB_status_check
    def diff_commit__topo(self, topo_diff, ctx):
        """
        commit a graph topology diff - this is a common pathway for:
           - RESP API calls
           - socket.io calls
           - future interfaces

        :return: a tuple containing the input diff and the result of it's commit
        """
        rzdoc = ctx.rzdoc
        op_ret = self._commit__topo__helper(topo_diff, rzdoc)
        ts_created = self._exec_chain_commit_op(topo_diff, ctx, topo_diff.meta)
        topo_diff.meta['author'] = ctx.user_name
        topo_diff.meta['ts_created'] = ts_created
        op_ret['meta'] = topo_diff.meta
        return topo_diff, op_ret

    @deco__DB_status_check
    def diff_commit__attr(self, attr_diff, ctx):
        """
        commit a graph attribute diff - this is a common pathway for:
           - RESP API calls
           - socket.io calls
           - future interfaces

        :return: a tuple containing the input diff and the result of it's commit
        """
        rzdoc = ctx.rzdoc
        op = DBO_diff_commit__attr(attr_diff)

        op_ret = self.db_ctl.exec_op(op)
        ts_created = self._exec_chain_commit_op(attr_diff, ctx, attr_diff.meta)
        attr_diff.meta['author'] = ctx.user_name
        attr_diff.meta['ts_created'] = ts_created
        op_ret['meta'] = attr_diff.meta
        return attr_diff, op_ret

    @deco__DB_status_check
    def load_node_set_by_id_attr(self, id_set, ctx=None):
        op = DBO_match_node_set_by_id_attribute(id_set=id_set)
        op_ret = self.db_ctl.exec_op(op)
        return op_ret

    @deco__DB_status_check
    def rzdoc__clone(self, rzdoc, ctx=None):
        """
        Clone entire rzdoc

        @return Topo_Diff with node/link attributes
        """
        op = DBO_rzdoc__clone(rzdoc)

        topo_diff = self.db_ctl.exec_op(op)
        return topo_diff


    @deco__DB_status_check
    def rzdoc__from_clone_and_commits(self, rzdoc_name, ctx=None):
        """
        Create a new document with given name and graph from clone, plus populate the history.

        Note: History may be partial; i.e. it may be inconsistent.

        :param rzdoc_name:
        :param ctx:
        :return: None
        """
        raise NotImplementedError("not yet implemented, requires efficient commits production, plus blob fix")
        # TODO: atomically
        rzdoc = self.rzdoc__create(rzdoc_name=rzdoc_name, ctx=ctx)
        # TODO: check rzdoc creation error


    @deco__DB_status_check
    def rzdoc__commit_log(self, rzdoc, limit):
        """
        return commit log
        """
        op = DBO_rzdoc__commit_log(limit=limit)
        op = QT_RZDOC_Meta_NS_Filter(rzdoc)(op)

        commit_log = self.db_ctl.exec_op(op)
        return commit_log

    @deco__DB_status_check
    def rzdoc__create(self, rzdoc_name, ctx=None):
        """
        Create & persist new RZDoc - may fail on unique name/id constraint violation

        @return: RZDoc object
        @raise RZDoc_Exception__already_exists
        """
        existing_doc = self.cache_lookup__rzdoc(rzdoc_name, raise_if_missing=False)
        if existing_doc is not None:
            raise RZDoc_Exception__already_exists(rzdoc_name)

        rzdoc = RZDoc(rzdoc_name)
        rzdoc.id = generate_random_rzdoc_id()

        op__rzdoc__create = DBO_rzdoc__create(rzdoc)
        op__block_chain__init = DBO_block_chain__init(rzdoc)

        self.db_ctl.exec_op(op__rzdoc__create)
        self.db_ctl.exec_op(op__block_chain__init)
        return rzdoc

    @deco__DB_status_check
    def rzdoc__delete(self, rzdoc, ctx=None):
        """
        Delete RZDoc

        @return: RZDoc object
        """

        op = DBO_rzdoc__delete(rzdoc)
        self.db_ctl.exec_op(op)

        self.cache__rzdoc_name_to_rzdoc.pop(rzdoc.name, None)

        for r_assoc in self.rzdoc_client_assoc_map[rzdoc]:
            r_assoc.mark__invalid = True

        # FIXME:
        #    - broadcast delete event

    @deco__DB_status_check
    def rzdoc__lookup_by_name(self, rzdoc_name, ctx=None):
        """
        @param ctx: may be None

        @return: RZDoc object or None if rzdoc was not found
        """

        op = DBO_rzdoc__lookup_by_name(rzdoc_name)
        rzdoc = self.db_ctl.exec_op(op)
        return rzdoc  # may be None

    def rzdoc__client_subscribe(self,
                                rzdoc_name=None,
                                sid=None):

        rzdoc = self.cache_lookup__rzdoc(rzdoc_name)

        r_assoc = RZDoc_Client_Association()
        r_assoc.rzdoc = rzdoc
        r_assoc.sid = sid

        self.rzdoc_client_assoc_map[rzdoc].append(r_assoc)
        log.debug("rz_kernel: reader subscribed: assoc: %s" % (r_assoc))

    def rzdoc__client_unsubscribe__r_assoc(self, r_assoc):
        return self.rzdoc__client_unsubscribe(r_assoc.rzdoc_name,
                                              r_assoc.sid)

    def rzdoc__client_unsubscribe(self,
                                  rzdoc_name=None,
                                  sid=None):

        rzdoc = self.cache_lookup__rzdoc(rzdoc_name)

        rm_target = None
        r_assoc_set = self.rzdoc_client_assoc_map[rzdoc]
        for r_assoc in r_assoc_set:
            if r_assoc.sid == sid:
                rm_target = r_assoc

        if None == rm_target:  # target possibly removed after becoming stale
            log.debug("rz_kernel: rzdoc__client_unsubscribe: assoc not found: sid: {}".format(sid))
            return

        r_assoc_set.remove(rm_target)  # FIXME: make thread safe
        log.debug("rz_kernel: reader unsubscribed: %s" % (rm_target))

    def dump_clients(self):
        log.info(repr(self.rzdoc_client_assoc_map))

    def rzdoc__client_set_from_rzdocs(self, rzdocs):
        rzdoc_r_set = set()
        for rzdoc in rzdocs:
            rzdoc_r_set |= set(self.rzdoc_client_assoc_map[rzdoc])
        ret_list = list(rzdoc_r_set)
        return ret_list

    def rzdoc__rzdocs_from_ids(self, node_ids, link_ids):
        """
        return all clients touching these ids.
        """
        op = DBO_find_rzdocs_touching(node_ids=node_ids, link_ids=link_ids)
        op_ret = self.db_ctl.exec_op(op)
        return op_ret

    @deco__DB_status_check
    def rzdoc__search(self, search_query, ctx=None):
        """
        List available RZDocs

        @return: RZDoc object
        """
        rzdoc__name__max_length = self.db_metablock['rzdoc__name__max_length']
        op = DBO_rzdoc__search(search_query, rzdoc__name__max_length)
        op_ret = self.db_ctl.exec_op(op)
        return op_ret

    @deco__DB_status_check
    def rzdoc__rename(self, cur_name, new_name):
        op = DBO_rzdoc__rename(cur_name, new_name)

        rzdoc = self.db_ctl.exec_op(op)

        self.cache__rzdoc_name_to_rzdoc.pop(cur_name, None)
        self.cache__rzdoc_name_to_rzdoc.pop(new_name, None)

        # FIXME:
        #    - broadcast rename event
        #    - notify all rzdoc readers

        return rzdoc  # may be None

    def reset_graph(self):
        for _type in [neo4j_schema.META_LABEL__RZDOC_NODE, neo4j_schema.META_LABEL__RZDOC_META_NODE,
                      neo4j_schema.META_LABEL__RZDOC_META_LINK, neo4j_schema.META_LABEL__RZDOC_TYPE]:
            op = DBO_raw_query_set(['match (n:%s) optional match (n)-[l]-() delete n, l' % _type])
            self.db_ctl.exec_op(op)
        self.cache__rzdoc_name_to_rzdoc.clear()
