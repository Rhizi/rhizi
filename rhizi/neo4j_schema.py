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


#
# meta label schema
#
NEO4J_SCHEMA_VERSION = '0.2.2'

META_LABEL__RZDB_META = '__RZDB_META'

META_LABEL__RZDOC_TYPE = '__RZDOC'  # RZdoc node
META_LABEL__RZDOC_NS_PREFIX = '__RZDOC_NS_'
META_LABEL__RZDOC_NS_META_PREFIX = '__RZDOC_NS_META_'

META_LABEL__VC_HEAD = '__HEAD'
META_LABEL__VC_COMMIT = '__COMMIT'  # diff commit node
META_LABEL__VC_PARENT = '__PARENT'  # diff commit node
META_LABEL__VC_COMMIT_AUTHOR = '__AUTHORED-BY'
META_LABEL__VC_COMMIT_RESULT_OF = '__RESULT_OF'
META_LABEL__VC_OPERATION = '__OPERATION'
META_LABEL__VC_EMPTY_RZDOC_HASH = 'adc83b19e793491b1c6ea0fd8b46cd9f32e592fc'  # value of: echo '' | sha1sum

META_LABEL__USER = '__USER'  # user node

META_LABEL__RZDOC_META_NODE = '__RZDOC_META_NODE'
META_LABEL__RZDOC_META_LINK = '__RZDOC_META_LINK'
META_LABEL__RZDOC_BELONGS_TO = '__RZDOC_BELONGS_TO'

META_LABEL__RZDOC_NODE = '__RZDOC_NODE'
META_LABEL__RZDOC_LINK = '__RZDOC_LINK' # not actually required - unusable on a
                                        # relationship, but if we move to an
                                        # edge as node representation then use
                                        # this.


meta_label_set = [META_LABEL__VC_HEAD,
                  META_LABEL__VC_COMMIT,
                  META_LABEL__VC_PARENT,
                  META_LABEL__VC_COMMIT_AUTHOR,
                  META_LABEL__VC_COMMIT_RESULT_OF,
                  META_LABEL__VC_OPERATION,

                  META_LABEL__USER,

                  META_LABEL__RZDOC_TYPE,
                  META_LABEL__RZDOC_NS_PREFIX,
                  META_LABEL__RZDOC_NS_META_PREFIX,
                  ]


RZDOC__NAME__MAX_LENGTH = 256
RZDOC__DEFAULT_MAINPAGE_NAME = 'Welcome Rhizi'
