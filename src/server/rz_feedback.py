import logging
import base64

from flask import request
from flask import json
from flask import current_app
from flask import session

from rz_mail import send_message

log = logging.getLogger('rhizi')

def decode_base64_uri(base64_encoded_data_uri):
    start = base64_encoded_data_uri.find(',') + 1
    encoded = base64_encoded_data_uri[start:]
    return base64.decodestring(encoded)

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
        img = decode_base64_uri(req_json['img'])
        html = req_json['html']
        return url, note, img, html

    try:
        url, note, img, html = sanitize_input(request)
    except:
        log.warn('failed to sanitize inputs. request: %s' % request)

    # FIXME: should be async via celery (or another method)
    session_user = session.get('username')
    feedback_body = """Feedback from user:
%(user)s

watching URL:
%(url)s

Left note:
%(note)s
""" % dict(url=url, note=note, user=session_user if session_user else "Not logged in")
    send_message(recipients=[current_app.rz_config.FEEDBACK_RECIPIENT],
                 subject="User feedback from Rhizi",
                 body=feedback_body,
                 attachments=[
                    ('feedback_screenshot.png', 'image/png', img),
                    ('feedback_page.html', 'text/html', html),
                 ])

    return "{}" # expects json encoded, contents discarded
