class Link():
    """
    documentation anchor - this class currently carries no implementation
    and only acts as a documentation anchor
    
    link['__src'] - meta attribute for link source
    link['__dst'] - meta attribute for link destination
    """
    
    class Link_Ptr(dict):
        def __init__(self, src_id=None, dst_id=None):
            assert None != src_id or None != dst_id
            
            self['__src'] = src_id
            self['__dst'] = dst_id
        
        @property
        def src_id(self):
            return self['__src']

        @property
        def dst_id(self):
            return self['__dst']

    @staticmethod
    def link_ptr(src_id=None, dst_id=None):
        """
        init from src_id or dst_id attributes - at least one must be provided
        """
        return Link.Link_Ptr(src_id, dst_id)
