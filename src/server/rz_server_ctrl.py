"""
Server control/monitoring logic
"""

from datetime import datetime
from flask import current_app

def monitor__server_info():
    """
    server monitor stub
    """
    dt = datetime.now()
    resp_arr = ["<html><body>",
                "<h1>Rhizi Server v0.1</h1><p>",
                "date: " + dt.strftime("%Y-%m-%d") + "<br>",
                "time: " + dt.strftime("%H:%M:%S") + "<br>",
                "</p></body></html>"]
    return (''.join(resp_arr), 200)

def rest__list_users():
    ret_body = []
    for uid, u_account in current_app.user_db:
        ret_line = []
        ret_line.append('uid: %s' % (uid).ljust(16))
        for f_str in str(u_account).split(','):
            ret_line.append(f_str.ljust(16))
        ret_body.append(' '.join(ret_line))
    return ('<pre>' + '\n'.join(ret_body) + '</pre>')
