class Link():
    """
    documentation anchor - this class currently carries no implementation
    and only acts as a documentation anchor
    
    link['__src'] - meta attribute for link source object
    link['__dst'] - meta attribute for link destination object
    """

    def __init__(self, src=None, dst=None):
        assert False, 'currently unused'

    class Link_Ptr(dict):
        """
        link['__src_id'] - meta attribute for link source id
        link['__dst_id'] - meta attribute for link destination id
        """
        def __init__(self, src_id=None, dst_id=None):
            assert None != src_id or None != dst_id

            self['__src_id'] = src_id
            self['__dst_id'] = dst_id

        @property
        def src_id(self):
            return self['__src_id']

        @property
        def dst_id(self):
            return self['__dst_id']

    @staticmethod
    def link_ptr(src_id=None, dst_id=None):
        """
        init from src_id or dst_id attributes - at least one must be provided
        """
        return Link.Link_Ptr(src_id, dst_id)

class RZDoc():

    def __init__(self, rzdoc_id = None, rzdoc_name = None):
        self.id = rzdoc_id
        self.name = rzdoc_name
