"""
Rhizi web API

@deprecated: destined to split into rz_api_rest & rz_api_websocket
"""
from flask import current_app
from flask import escape
from flask import render_template
from flask import request
from flask import session
import logging

from rz_api_common import sanitize_input__rzdoc_name
from rz_req_handling import common_resp_handle__client_error


log = logging.getLogger('rhizi')

def index(rzdoc_name=None):
    return rz_mainpage(rzdoc_name)

def rz_mainpage(rzdoc_name=None):
    """
    Main application load function.

    [!] Do not use as a flask endpoint as multiple functions redirect here
    """

    # fetch rz_username for welcome message
    email_address = session.get('username')
    rz_username = "Anonymous Stranger"
    role_set = []
    if None != email_address:  # session cookie passed & contains uid (email_address)
        try:
            _uid, u_account = current_app.user_db.lookup_user__by_email_address(email_address)
        except Exception as e:
            # may occur on user_db reset or malicious cookie != stale cookie,
            # for which the user would at least be known to the user_db
            # FIXME: remove the cookie
            pass
        else:
            role_set = u_account.role_set
            rz_username = escape(u_account.rz_username)

    rz_config = current_app.rz_config
    if None == rzdoc_name:
        s_rzdoc_name = rz_config.rzdoc__mainpage_name
    else:
        try:
            s_rzdoc_name = sanitize_input__rzdoc_name(rzdoc_name)
        except Exception as e:
            log.exception(e)
            return common_resp_handle__client_error(status=404)

    # establish rz_config template values
    host_addr, host_port = request.host_sock_addr[0], request.host_sock_addr[1]
    rz_config = {'rz_config__rzdoc_cur__name': s_rzdoc_name,
                 'rz_config__rzdoc__mainpage_name': rz_config.rzdoc__mainpage_name,
                 'rz_config__hostname': host_addr,
                 'rz_config__port': host_port,
                 'rz_config__optimized_main': 'true' if rz_config.optimized_main else 'false',
                 'rz_config__role_set': role_set,
                 'fragment_d_path': rz_config.fragment_d_path,
                 }
    return render_template('index.html', rz_username=rz_username, **rz_config)

