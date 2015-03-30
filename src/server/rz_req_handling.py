from flask import make_response
from werkzeug.wrappers import BaseResponse as Response
import json
from rz_kernel import RZDoc_Exception__not_found
import logging
from rz_api_common import API_Exception__bad_request
from functools import wraps


HTTP_STATUS__201_CREATED = 201
HTTP_STATUS__204_NO_CONTENT = 204

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
            return common_resp_handle__client_error(error=e) # currently blame client for all DNFs
        except RZDoc_Exception__not_found as e:
            log.exception(e)
            return common_resp_handle__client_error(error=e) # currently blame client for all DNFs
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
    return make_response__json(data={'response__html': html_str })

def make_response__json__redirect(redirect_url, status=303, html_str=''):
    """
    Construct a json response with redirect payload
    """
    return make_response__json(data={'response__html': html_str,
                                    'redirect_url': redirect_url })
