#
# meta label schema
#
META_LABEL__RZDOC_TYPE = '__RZDOC'
META_LABEL__RZDOC_NS_PREFIX = '__RZDOC_NS_'
META_LABEL__RZDOC_NS_META_PREFIX = '__RZDOC_NS_META_'

meta_label_set = ['__HEAD',
                  '__USER',  # user node
                  '__Commit',  # diff commit node
                  '__Parent',  # parent commit node
                  '__Authored-by',
                  META_LABEL__RZDOC_TYPE,  # RZ doc node
                  # META_LABEL__RZDOC_NS_PREFIX, # [!] considered a meta label but excluded from set to allow returning nodes with this label
                  ]
