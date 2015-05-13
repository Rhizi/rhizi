import json

class Attr_Diff(dict):
    """
    Represents a change to note attributes, where nodes can represent
    either logical nodes or logical links, and attributes can be added,
    changed or removed
    
    Example:
            attr_diff = {'__type_node' : {n_id: {'__attr_write': {'attr_0': 0,
                                                                  'attr_1': 'a'},
                                                '__attr_remove': ['attr_2'] }}
                         '__type_link' : {l_id: ... }
                        }
    """
    def __init__(self):
        self['__type_node'] = {}
        self['__type_link'] = {}
        self['meta'] = {}

    def init_node_attr_diff(self, n_id):
        ret = {'__attr_write': {},
               '__attr_remove': []}
        self['__type_node'][n_id] = ret
        return ret

    def init_link_attr_diff(self, l_id):
        ret = {'__attr_write': {},
               '__attr_remove': []}
        self['__type_link'][l_id] = ret
        return ret

    @staticmethod
    def from_json_dict(json_dict):
        ret = Attr_Diff()
        for obj_type, writer, remover in [
            ('__type_node', ret.add_node_attr_write, ret.add_node_attr_rm),
            ('__type_link', ret.add_link_attr_write, ret.add_link_attr_rm),
            ]:
            obj_ad_set = json_dict.get(obj_type)
            if None != obj_ad_set:
                for o_id, ad in obj_ad_set.items():
                    if None != ad.get('__attr_write'):
                        for k, v in ad['__attr_write'].items():
                            writer(o_id, k, v)
                    if None != ad.get('__attr_remove'):
                        for k in ad['__attr_remove']:
                            remover(o_id, k)
        return ret

    @property
    def type__node(self):
        return self['__type_node']

    @property
    def type__link(self):
        return self['__type_link']

    @property
    def meta(self):
        return self['meta']

    def add_node_attr_write(self, n_id, attr_name, attr_val):

        assert 'id' != attr_name.lower(), 'Attr_Diff: attempt to write to \'id\' attribute'

        n_attr_diff = self['__type_node'].get(n_id)
        if None == n_attr_diff:
            n_attr_diff = self.init_node_attr_diff(n_id)
        n_attr_diff['__attr_write'][attr_name] = attr_val

    def add_node_attr_rm(self, n_id, attr_name):

        assert 'id' != attr_name.lower(), 'Attr_Diff: attempt to remove \'id\' attribute'

        n_attr_diff = self['__type_node'].get(n_id)
        if None == n_attr_diff:
            n_attr_diff = self.init_node_attr_diff(n_id)
        n_attr_diff['__attr_remove'].append(attr_name)

    def add_link_attr_write(self, l_id, attr_name, attr_val):

        assert 'id' != attr_name.lower(), 'Attr_Diff: attempt to write to \'id\' attribute'

        l_attr_diff = self['__type_link'].get(l_id)
        if None == l_attr_diff:
            l_attr_diff = self.init_link_attr_diff(l_id)
        l_attr_diff['__attr_write'][attr_name] = attr_val

    def add_link_attr_rm(self, l_id, attr_name):

        assert 'id' != attr_name.lower(), 'Attr_Diff: attempt to remove \'id\' attribute'
        assert 'name' != attr_name.lower(), 'Attr_Diff: attempt to remove link \'name\' attribute, use write instead'

        l_attr_diff = self['__type_link'].get(l_id)
        if None == l_attr_diff:
            l_attr_diff = self.init_link_attr_diff(l_id)
        l_attr_diff['__attr_remove'].append(attr_name)

class Topo_Diff(object):
    """
    Represents a change to the graph topology
    """

    class Commit_Result_Type(dict):
        """
        Topo_Diff graph commit result type
        """
        def __init__(self, node_id_set_add=[],
                           link_id_set_add=[],
                           node_id_set_rm=[],
                           link_id_set_rm=[]):
            self['node_id_set_add'] = node_id_set_add
            self['link_id_set_add'] = link_id_set_add
            self['node_id_set_rm'] = node_id_set_rm
            self['link_id_set_rm'] = link_id_set_rm
            self['meta'] = {}

        @staticmethod
        def from_json_dict(json_dict):
            ret = Topo_Diff.Commit_Result_Type()
            ret.__dict__ = json_dict
            return ret

    class JSON_Encoder(json.JSONEncoder):
        """
        Topo_Diff is not a plain dict, so we provide a json encoder
        """
        def default(self, obj):
            return obj.to_json_dict()

    @staticmethod
    def from_json_dict(json_dict):
        """
        construct from dict - no node/link constructor set must be provided
        """
        ret = Topo_Diff()

        # merge keys - this allows constructor argument omission (link_id_set_rm,
        # node_id_set_rm, etc.) such as when constructing from POST JSON data
        for k, _ in ret.__dict__.items():
            v = json_dict.get(k)
            if None != v:
                ret.__dict__[k] = v
        return ret

    def __init__(self, link_id_set_rm=[],
                       node_id_set_rm=[],
                       node_set_add=[],
                       link_set_add=[],
                       meta={}):

        self.link_id_set_rm = link_id_set_rm
        self.node_id_set_rm = node_id_set_rm
        self.node_set_add = node_set_add
        self.link_set_add = link_set_add
        self.meta = {}

    def __str__(self):
        return __name__ + ': ' + ', '.join('%s: %s' % (k, v) for k, v in self.__dict__.items())

    def len__n_add(self):
        return len(self.node_set_add)

    def len__n_id_rm(self):
        return len(self.node_id_set_rm)

    def len__l_add(self):
        return len(self.link_set_add)

    def len__l_id_rm(self):
        return len(self.link_id_set_rm)

    def is_empty(self):
        return self.len__n_add() + self.len__n_id_rm() + self.len__l_add() + self.len__l_id_rm() == 0

    def to_json_dict(self):
        ret = {k: getattr(self, k) for k in ['link_id_set_rm',
                                             'node_id_set_rm',
                                             'node_set_add',
                                             'link_set_add',
                                             'meta'] }
        return ret

    def to_str__commit_name(self):
        return 'TD: +n:%d l:%d -n:%d -l:%d' % (len(self.node_set_add),
                                               len(self.link_set_add),
                                               len(self.node_id_set_rm),
                                               len(self.link_id_set_rm))

    def check_validity(self, topo_diff_dict):
        """
        Topo_Diff may represent invalid operations, eg. adding a link while
         removing it's end-point - this stub should check for that
        """
        pass
