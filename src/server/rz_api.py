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
import traceback

from db_op import DBO_diff_commit__topo
from db_op import DBO_load_link_set
from db_op import DBO_match_node_id_set
from db_op import DBO_match_node_set_by_id_attribute
from db_op import DBO_rz_clone
from model.graph import Topo_Diff
from model.model import Link
from rz_api_common import __sanitize_input, map_rzdoc_name_to_rzdoc_id
from rz_api_common import sanitize_input__topo_diff
from rz_api_rest import common_resp_handle
from neo4j_cypher import QT_Node_Filter__Doc_ID_Label


log = logging.getLogger('rhizi')

def index():

    # fetch rz_username for welcome message
    email_address = session.get('username')
    rz_username = "Anonymous Stranger"
    role_set = []
    if None != email_address:  # session cookie passed & contains uid (email_address)
        try:
            uid, u_account = current_app.user_db.lookup_user__by_email_address(email_address)
            role_set = u_account.role_set
            rz_username = escape(u_account.rz_username)
        except Exception as e:
            # may occur on user_db reset or malicious cookie != stale cookie,
            # for which the user would at least be known to the user_db
            log.exception(e)

    # establish rz_config template values
    client_POV_server_name = request.headers.get('X-Forwarded-Host')  # first probe for reverse proxy headers
    if None == client_POV_server_name:
        client_POV_server_name = request.headers.get('Host')  # otherwise use Host: header
    assert None != client_POV_server_name, 'failed to establish hostname, unable to construct rz_config'

    hostname = client_POV_server_name
    port = 80
    if ':' in client_POV_server_name:
        hostname = client_POV_server_name.split(':')[0]
        port = client_POV_server_name.split(':')[1]

    return render_template('index.html',
                           rz_username=rz_username,
                           rz_config__rzdoc_cur__name = s_rzdoc_name,
                           rz_config__rzdoc_default__name = current_app.rz_config.rzdoc__mainpage_name,
                           rz_config__hostname=hostname,
                           rz_config__port=port,
                           rz_config__optimized_main='true' if current_app.rz_config.optimized_main else 'false',
                           rz_config__role_set=role_set)
