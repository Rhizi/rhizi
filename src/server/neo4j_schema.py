#
# meta label schema
#
NEO4J_SCHEMA_VERSION = '0.2.0'

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

