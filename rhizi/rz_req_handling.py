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


from flask import make_response
from functools import wraps
import json
import logging
from werkzeug.wrappers import BaseResponse as Response

from .rz_api_common import API_Exception__bad_request
from .rz_kernel import RZDoc_Exception__not_found


HTTP_STATUS__101_SWITCHING_PROTOCOLS = 101
HTTP_STATUS__200_OK = 201
HTTP_STATUS__201_CREATED = 201
HTTP_STATUS__204_NO_CONTENT = 204
HTTP_STATUS__400_BAD_REQUEST = 400
HTTP_STATUS__401_UNAUTORIZED = 401
HTTP_STATUS__500_INTERNAL_SERVER_ERROR = 500

log = logging.getLogger('rhizi')

def __common_resp_handle(data, error, status):
    """
    common response handling:
       - add common response headers
       - serialize response

    @data must be json serializable
    @error will be serialized with str()
    """

    def __response_wrap(data=None, error=None):
        """
        wrap response data/errors as dict - this should always be used when returning
        data to allow easy return of list objects, assist in error case distinction, etc.
        """
        return dict(data=data, error=error)

    if not error:
        error_str = None
    else:
        error_str = str(error)  # convert any Exception objects to serializable form

    ret_data = __response_wrap(data, error_str)
    resp_payload = json.dumps(ret_data)
    resp = Response(resp_payload, mimetype='application/json', status=status)
    resp.headers['Access-Control-Allow-Origin'] = '*'

    # more response processing
    return resp


def common_resp_handle__success(data=None, error=None, status=200):
    return __common_resp_handle(data, error, status)

def common_resp_handle__redirect(data=None, error=None, status=300):
    return __common_resp_handle(data, error, status)

def common_resp_handle__client_error(data=None, error=None, status=400):
    return __common_resp_handle(data, error, status)

def common_resp_handle__server_error(data=None, error=None, status=500):
    return __common_resp_handle(data, error, status)

def common_rest_req_exception_handler(rest_API_endpoint):

    @wraps(rest_API_endpoint)
    def rest_API_endpoint__decorated(*args, **kwargs):
        try:
            return rest_API_endpoint(*args, **kwargs)
        except API_Exception__bad_request as e:
            log.exception(e)
            return common_resp_handle__client_error(error=e)  # currently blame client for all DNFs
        except RZDoc_Exception__not_found as e:
            log.exception(e)
            return common_resp_handle__client_error(data={'rzdoc_name': e.rzdoc_name}, error=e)  # currently blame client for all DNFs
        except Exception as e:
            log.exception(e)
            return common_resp_handle__server_error(error=e)

    return rest_API_endpoint__decorated

def make_response__json(status=200, data={}):
    """
    Construct a json response with proper content-type header

    @param data: must be serializable via json.dumps
    """
    data_str = json.dumps(data)
    resp = make_response(data_str)
    resp.headers['Content-Type'] = "application/json"
    resp.status = str(status)

    return resp

def make_response__http__empty(status=200):
    """
    Construct an empty HTTP response
    """
    resp = make_response()
    resp.status = str(status)
    return resp

def make_response__http__pre_tag_wrapped(html_str, status=200):
    """
    Construct a '<pre>' tag wrapped HTTP response
    """
    resp_arr = ['<!DOCTYPE html>',
                '<html><body><pre>',
                html_str,
                '</pre></body></html>'
                ]
    return (''.join(resp_arr), 200)

def make_response__json__html(status=200, html_str=''):
    """
    Construct a json response with HTML payload
    """
    return make_response__json(status=status, data={'response__html': html_str })

def make_response__json__redirect(redirect_url, status=303, html_str=''):
    """
    Construct a json response with redirect payload
    """
    assert status >= 300 and status < 400

    return make_response__json(status=status,
                               data={'response__html': html_str,
                                    'redirect_url': redirect_url })

def sock_addr_from_env_HTTP_headers(req_env, key_name__addr):
    """
    Extract remote socket address based on header data

    [!] if header value contains more than a single address only the first one is used.

    @param key_name__addr: header name to probe for address value
    @return: (remote_addr, remote_port) where remote_port may be None
    @raise Exception: if header is missing from env
    """
    header_key = 'HTTP_' + key_name__addr.upper().replace('-', '_')
    addr_set_str = req_env.get(header_key)
    if not addr_set_str:
        raise Exception('\'%s\' header missing' % (key_name__addr))

    addr_set = addr_set_str.split(',')
    if len(addr_set) > 1:
        log.warning('%s header contains multiple addresses, using first: header value: \'%s\'' % (key_name__addr, addr_set_str))
    addr_val = addr_set.pop()

    # deduce addr:port - port might not be present in header value
    addr_val_arr = addr_val.split(':')
    rmt_addr = addr_val_arr[0]
    rmt_port = addr_val_arr[1] if 2 == len(addr_val_arr) else None

    return rmt_addr, rmt_port

def sock_addr_from_REMOTE_X_keys(req_env):
    rmt_addr = req_env.get('REMOTE_ADDR', '127.0.0.1')
    rmt_port = req_env.get('REMOTE_PORT', 12345)
    return rmt_addr, rmt_port
