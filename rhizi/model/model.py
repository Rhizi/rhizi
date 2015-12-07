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


import sys
import base64
import gzip
import json


python2 = sys.version_info[0] == 2


class RZCommit():
    """
    Rhizi Commit object

    Currently this object is substituted by either a diff object, this currently
    acts as a model stub.
    """

    @staticmethod
    def diff_obj_from_blob(blob):
        """
        @return json.loads(gzip_decompress(base64_decode(blob)))
        """
        blob_gzip = base64.decodestring(blob.encode('utf-8'))
        blob = gzip.zlib.decompress(blob_gzip).decode()
        return json.loads(blob)

    @staticmethod
    def blob_from_diff_obj(obj):
        """
        @return: blob = base64(gzip(json.dumps(obj)))
        """
        obj_bytes = json.dumps(obj).encode('utf-8')
        blob_gzip = gzip.zlib.compress(obj_bytes)
        blob_base64 = base64.encodestring(blob_gzip)
        if not python2:
            blob_base64 = blob_base64.decode('utf-8')

        return blob_base64

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
            assert None is not src_id and None is not dst_id
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

    def __init__(self, rzdoc_name=None):
        self.id = None  # set upon DB commit
        self.name = rzdoc_name

    def __eq__(self, other):
        if not isinstance(other, RZDoc): return False

        assert self.id != None and other.id != None

        return self.id == other.id

    def __hash__(self):
        assert self.id != None

        return self.id.__hash__()

    def __str__(self):
        return 'rzdoc: name: %s'.decode('utf-8') % (self.name)
