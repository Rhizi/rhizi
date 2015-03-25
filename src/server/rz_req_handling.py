from flask import jsonify
from flask import make_response
import json

def common_resp_handle(data=None, error=None, status=200):
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

    if error is None:
        error_str = ""
    else:
        error_str = str(error)  # convert any Exception objects to serializable form


    ret_data = __response_wrap(data, error_str)
    resp = Response(ret_data, mimetype='application/json')
    resp.headers['Access-Control-Allow-Origin'] = '*'
    
    # jsonify(ret_data)  # this will create a Flask Response object

    # more response processing
    return resp

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
