class Attr_Diff(dict):
    """
    Represents a change to note attributes, where nodes can represent
    either logical nodes or logical links, and attributes can be added,
    changed or removed
    
    Example:
            attr_diff = {n_id: {'attr_write': {'attr_0': 0,
                                               'attr_1': 'a'},
                                'attr_remove': ['attr_2'] }
                        }
    """
    def __init__(self):
        pass

    def init_node_attr_diff(self, n_id):
        ret = {'attr_write': {},
                      'attr_remove': []}
        self[n_id] = ret
        return ret
                      
    def add_node_attr_write(self, n_id, attr_name, attr_val):
        n_attr_diff = self.get(n_id)
        if None == n_attr_diff:
            n_attr_diff = self.init_node_attr_diff(n_id)
        n_attr_diff['attr_write'][attr_name] = attr_val

    def add_node_attr_rm(self, n_id, attr_name):
        n_attr_diff = self.get(n_id)
        if None == n_attr_diff:
            n_attr_diff = self.init_node_attr_diff(n_id)
        n_attr_diff['attr_remove'].append(attr_name)

class Topo_Diff(object):
    """
    Represents a change to the graph topology
    """

    def __init__(self, link_set_rm=[],
                        node_set_rm=[],
                        node_set_add=[],
                        link_set_add=[]):
        self.link_set_rm = link_set_rm
        self.node_set_rm = node_set_rm
        self.node_set_add = node_set_add
        self.link_set_add = link_set_add

    def check_validity(self, topo_diff_dict):
        """
        Topo_Diff may represent invalid operations, eg. adding a link while
         removing it's end-point - this stub should check for that
        """
        pass

    @staticmethod
    def from_dict(topo_diff_dict):
        ret = Topo_Diff()
        ret.__dict__ = topo_diff_dict
        return ret
