class Attribute_Diff():
    """
    Represents a change to note attributes, where nodes can represent
    either logical nodes or logical links, and attributes can be added,
    changed or removed
    """
    pass

class Topo_Diff():
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

    @property
    def link_set_rm(self):
        return self.link_set_rm

    @property
    def node_set_rm(self):
        return self.node_set_rm

    @property
    def link_set_add(self):
        return self.link_set_add

    @property
    def node_set_add(self):
        return self.node_set_add
