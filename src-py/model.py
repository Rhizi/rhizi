class link():
    """
    documentation anchor - this class currently carries no implementation
    and only acts as a documentation anchor
    
    link['__src'] - meta attribute for link source
    link['__dst'] - meta attribute for link destination
    """
    pass

class GDiff():

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
