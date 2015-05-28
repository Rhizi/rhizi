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


"""
Common public API logic:
  - object sanitization for inbound data
  - object validation for inbound data
  - sanitize_input__XXX: concerned with sanitizing potential currupt data arriving
                         from external sources.
  - validae_object__XXX: concerned with validating the logical state of an object

"""
from flask import current_app
import logging

log = logging.getLogger('rhizi')

class API_Exception__bad_request(Exception):  # raised by input sanitation functions

    def __init__(self, internal_err_msg, caller_err_msg=None):
        super(API_Exception__bad_request, self).__init__(internal_err_msg)
        self.caller_err_msg = None  # may be set to carry short string error messages which may be presented to the caller

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

def sanitize_input__rzdoc_name(rzdoc_name_raw):
    """
    sanitize rzdoc name raw input
    """
    rzdoc_name = rzdoc_name_raw.strip()  # make sure we ommit trailing white spaces from doc name

    if None == rzdoc_name or 0 == len(rzdoc_name):
        raise API_Exception__bad_request('rzdoc: open request: empty doc name')

    if None != rzdoc_name and len(rzdoc_name) > current_app.rz_config.rzdoc__name__max_length:
        raise API_Exception__bad_request('rzdoc: open request: doc name exceeds max doc name limit: %s' % (rzdoc_name))

    # FIXME: fail on HTML escape codes, UTF handling, etc

    return rzdoc_name

def validate_obj__attr_diff(attr_diff):
    # check for name attr changes, which are currently forbidden
    for n_id, node_attr_diff_set in attr_diff['__type_node'].items():
        for attr_name in node_attr_diff_set['__attr_write'].keys():
            if 'id' == attr_name:
                raise Exception('validation error: Attr_Diff: forbidden attribute change: \'id\', n_id: ' + n_id)

