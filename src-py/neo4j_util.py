"""
 Utility code in speaking the neo4j REST api
"""

import json
import urllib2

def post_neo4j(url, data):
    """
    return dict translation of the json string returned by neo4j, raise Exception if the 'errors' key is not empty  
    """
    ret = post(url, data)
    ret_data = json.load(ret)

    if ret_data['errors']:
        raise Exception('neo4j exception: ' + str(ret_data['errors']))

    return ret_data

def post(url, data):
    assert(isinstance(data, dict))  # make sure we're not handed json strings

    post_data_json = json.dumps(data)

    req = urllib2.Request(url)
    req.add_header('User-Agent', 'rhizi-server/0.1')
    req.add_header('Accept', 'application/json; charset=UTF-8')
    req.add_header('Content-Type', 'application/json')

    try:
        ret = urllib2.urlopen(req, post_data_json)
    except urllib2.HTTPError as e:
        raise Exception('post request failed: code: {0}, reason: {1}'.format(e.code, e.reason))

    return ret

def statement_to_REST_form(query, parameters={}):
    """
    turn cypher query to neo4j json API format
    """
    assert isinstance(query, str)
    assert isinstance(parameters, dict)

    return {'statement' : query, 'parameters': parameters}

def statement_set_to_REST_form(statement_set):
    assert isinstance(statement_set, list)

    return {'statements': statement_set}
