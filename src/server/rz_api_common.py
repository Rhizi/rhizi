"""
Common public API logic:
  - object sanitization for inbound data
  - object validation for inbound data
  - sanitize_input__XXX: concerned with sanitizing potential currupt data arriving
                         from external sources.
  - validae_object__XXX: concerned with validating the logical state of an object

"""
def __sanitize_input(*args, **kw_args):
    pass

def sanitize_input__node(n):
    """
    provide a control point as to which node fields are persisted
    """
    assert None != n.get('id'), 'invalid input: node: missing id'

def sanitize_input__link(l):
    """
    provide a control point as to which link fields are persisted
    """

    # expected prop assertions
    assert None != l.get('id'), 'invalid input: link: missing id'
    assert None != l.get('__src_id'), 'invalid input: link: missing src id'
    assert None != l.get('__dst_id'), 'invalid input: link: missing dst id'
    assert None != l.get('__type'), 'invalid input: link: missing type'

    # unexpected prop assertions
    assert None == l.get('name'), 'client is sending us name link property, it should not'

def sanitize_input__topo_diff(topo_diff):
    for n in topo_diff.node_set_add:
        sanitize_input__node(n)
    for l in topo_diff.link_set_add:
        sanitize_input__link(l)

def sanitize_input__attr_diff(attr_diff):
    pass  # TODO: impl

def validate_obj__attr_diff(attr_diff):
    # check for name attr changes, which are currently forbidden
    for n_id, node_attr_diff_set in attr_diff['__type_node'].items():
        for attr_name in node_attr_diff_set['__attr_write'].keys():
            if 'id' == attr_name:
                raise Exception('validation error: Attr_Diff: forbidden attribute change: \'id\', n_id: ' + n_id)

def cache_lookup__rzdoc(rzdoc_name):
    """
    lookup RZDoc by rzdoc_name, possibly triggering a DB query
    
    @raise RZDoc_Exception__not_found
    """
    # FIXME: impl cache cleansing logic

    cache_doc = current_app.cache__rzdoc_name_to_rzdoc.get(rzdoc_name)
    if None != cache_doc:
        return cache_doc

    kernel = current_app.kernel
    rz_doc = kernel.rzdoc__lookup_by_name(rzdoc_name)
    
    if None == rz_doc:
        raise RZDoc_Exception__not_found(rzdoc_name)

    current_app.cache__rzdoc_name_to_rzdoc[rzdoc_name] = rz_doc
    return rz_doc

