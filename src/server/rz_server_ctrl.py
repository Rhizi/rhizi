"""
Server control/monitoring logic
"""

from datetime import datetime
from flask import current_app
from rz_req_handling import make_response__http__pre_tag_wrapped

def monitor__server_info():
    """
    server monitor stub
    """
    dt = datetime.now()
    body_line_arr = ['Rhizi Server v0.1',
                     'date: ' + dt.strftime('%Y-%m-%d'),
                     'time: ' + dt.strftime('%H:%M:%S')
                     ]
    return make_response__http__pre_tag_wrapped('\n'.join(body_line_arr))

def rest__list_users():
    body_line_arr = []
    for uid, u_account in current_app.user_db:
        ret_line = []
        ret_line.append('uid: %s' % (uid).ljust(16))
        for f_str in str(u_account).split(','):
            ret_line.append(f_str.ljust(16))
        body_line_arr.append(' '.join(ret_line))
    return make_response__http__pre_tag_wrapped('\n'.join(body_line_arr))
