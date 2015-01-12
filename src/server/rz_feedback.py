import logging

from flask import request
from flask import json


log = logging.getLogger('rhizi')

def feedback():
    """
    Email all parts as attachments to configured feedback email
    """

    def sanitize_input(req):
        d = request.form.to_dict()
        feedback = d['feedback']
        req_json = json.loads(feedback)
        url = req_json['url']
        note = req_json['note']
        img = req_json['img'] # FIXME base64 encoded data URI
        html = req_json['html']
        return url, note, img, html

    try:
        url, note, img, html = sanitize_input(request)
    except:
        log.warn('failed to sanitize inputs. request: %s' % request)

    return "success"
