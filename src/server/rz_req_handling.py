from flask import jsonify
from flask import make_response

def make_json_response(status=200, data='{}'):
    """
    Construct a json response with proper content-type header
    """
    resp = make_response(data)
    resp.headers['Content-Type'] = "application/json"
    resp.status = str(status)
    return resp

def common_resp_handle(data=None, error=None):
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
    resp = jsonify(ret_data)  # this will create a Flask Response object

    resp.headers['Access-Control-Allow-Origin'] = '*'

    # more response processing

    return resp
