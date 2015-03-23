"""
Cypher language parser
   - clear logical separation between lexing/parsing still missing
   - e_XXX class object should be considered internal
"""
import re
from collections import defaultdict
import logging
from enum import Enum

#
# meta label schema
#

META_LABEL__RZ_DOC = '__RZDOC_'
META_LABEL__RZ_DOC_PREFIX = '__RZ_DOC_ID_'

meta_label_set = [META_LABEL__RZ_DOC,  # RZ doc node
                  '__HEAD',
                  '__USER',  # user node
                  '__Commit',  # diff commit node
                  '__Parent',  # parent commit node
                  '__Authored-by',
                  # __RZ_DOC_ID_xxx, # [!] considered a meta label, excluded from set to allow returning nodes with this label
                  ]

log = logging.getLogger('rhizi')

class Query_Struct_Type(Enum):
    unkown = 1
    r = 2
    w = 3
    rw = 4

    def __add__(self, other):
        if self == other or self == pt_root.Query_Struct_Type.rw:
            return self
        if self == Query_Struct_Type.unkown:
            return other
        if self == Query_Struct_Type.r and other != Query_Struct_Type.r:
            return Query_Struct_Type.rw
        if self == Query_Struct_Type.w and other != Query_Struct_Type.w:
            return Query_Struct_Type.rw

    def __str__(self):
        if self == Query_Struct_Type.unkown: return 'unkown'
        if self == Query_Struct_Type.r: return 'r'
        if self == Query_Struct_Type.w: return 'w'
        if self == Query_Struct_Type.rw: return 'rw'
        assert False


























        """
        """












    @property
    def query_struct_type(self):
        """
        calc query_structure_type: read|write|read-write
        """
            if kw == 'match':











