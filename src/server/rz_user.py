from datetime import datetime
from datetime import timedelta
from flask import current_app
from flask import redirect
from flask import render_template
from flask import request
from flask import session
from flask import url_for
import flask
import json
import logging
import re
import uuid

from crypt_util import hash_pw
import crypt_util
from rz_mail import send_email_message
from rz_req_handling import make_response__json, make_response__json__html
from rz_user_db import User_Account


log = logging.getLogger('rhizi')

class User_Signup_Request(dict):

    def __init__(self, email_address,
                       first_name,
                       last_name,
                       pw_plaintxt,
                       rz_username):

        self['rz_username'] = rz_username
        self['email_address'] = email_address
        self['last_name'] = last_name
        self['first_name'] = first_name
        self['pw_plaintxt'] = pw_plaintxt

        self['submission_date'] = None
        self['validation_key'] = None

    def __str__(self):
        return 'email_address: %s' % (self['email_address'])

    def has_expired(self):
        date_now = datetime.now()
        dt_6h = timedelta(hours=6)
        dt = self['submission_date'] - date_now
        return dt > dt_6h

def filter_expired_requests(us_req_map):

    for su_req_email, su_req in us_req_map.items():
        if su_req.has_expired():
            log.info('user sign-up request expired: %s' % (su_req))
            del us_req_map[su_req_email]

def generate_security_token():
    """
    generate a random UUID based string ID
    """
    return str(uuid.uuid4()).replace('-', '')

def activate_user_account(us_req):

    user_db = current_app.user_db

    existing_account = None
    try:
        _, existing_account = user_db.lookup_user__by_email_address(us_req['email_address'])
    except Exception as _:
        pass  # thrown if user was not found, expected

    if None != existing_account:
        raise Exception('account activation code reused: existing-account: %s' % (existing_account.email_address))

    # calc pw hash
    pw_plaintxt = us_req['pw_plaintxt']
    salt = current_app.rz_config.secret_key
    pw_hash = hash_pw(str(pw_plaintxt), salt)

    u_account = User_Account(first_name=us_req['first_name'],
                              last_name=us_req['last_name'],
                              rz_username=us_req['rz_username'],
                              email_address=us_req['email_address'],
                              pw_hash=pw_hash,
                              role_set=['user'])

    user_db.user_add(u_account)

    log.info('user account activated: email: %s, rz_username: %s' % (us_req['email_address'], us_req['rz_username']))

def rest__login():

    def sanitize_input(req):
        req_json = request.get_json()
        email_address = req_json['email_address']
        p = req_json['password']
        return email_address, p

    if request.method == 'POST':

        u_account = None

        try:
            email_address, p = sanitize_input(request)
            u_account = current_app.user_db.lookup_user__by_email_address(email_address)
        except:
            log.warn('failed to sanitize inputs. request: %s' % request)
            return make_response__json(status=401)  # return empty response
        try:
            salt = current_app.rz_config.secret_key
            pw_hash = hash_pw(p, salt)
            current_app.user_db.validate_login(email_address=email_address, pw_hash=pw_hash)
        except Exception as e:
            # login failed
            log.warn('login: unauthorized: user: %s' % (email_address))
            return make_response__json(status=401)  # return empty response

        # login successful
        session['username'] = email_address
        log.debug('login: success: user: %s' % (email_address))
        return make_response__json(status=200)  # return empty response

    if request.method == 'GET':
        return render_template('login.html')

def rest__logout():
    """
    REST API endpoint: logout
    """
    # remove the username from the session if it's there
    u = session.pop('username', None)
    log.debug('logout: success: user: %s' % (u))
    return redirect(url_for('login'))

def rest__user_signup():
    """
    REST API endpoint: user sign up
    """
    def add_user_signup_req(us_req_map, us_req):
        key = us_req['email_address']
        us_req_map[key] = us_req  # finally, add request

    def rm_user_signup_req(us_req_map, us_req):
        key = us_req['email_address']
        del us_req_map[key]

    def sanitize_and_validate_input(req):
        req_json = request.get_json()

        # TODO: sanitize
        field_to_regex_map = {'first_name': r'\w{3,16}',
                              'last_name': r'\w{3,16}',
                              'rz_username': r'\w{3,16}',
                              'email_address': r'[^@]+@[^@]+\.[^@]+',
                              'pw_plaintxt': r'[A-Za-z0-9]{8,32}',  # avoid symbols
                              }

        for f_name, regex in field_to_regex_map.items():
            f_val = req_json.get(f_name)
            if None == f_val:
                raise Exception('malformed signup request: missing field: %s' % (f_name))
            if None == re.match(regex, f_val):
                raise Exception('malformed signup request: regex match failure: regex: %s, input: %s' % (regex, f_val))

        first_name = req_json['first_name']
        last_name = req_json['last_name']
        rz_username = req_json['rz_username']
        email_address = req_json['email_address']
        pw_plaintxt = req_json['pw_plaintxt']

        ret = User_Signup_Request(email_address=email_address,
                                  first_name=first_name,
                                  last_name=last_name,
                                  pw_plaintxt=pw_plaintxt,
                                  rz_username=rz_username)

        return ret

    def get_or_init_usreq_map():
        """
        lazy user signup request map getter
        """

        if not hasattr(current_app, 'usreq_email_to_req_map'):
            setattr(current_app, 'usreq_email_to_req_map', {})
        us_req_map = current_app.usreq_email_to_req_map

        return us_req_map

    html_ok__submitted = '<p>Your request has been successfully submitted.<br>Please check your email to activate your account.</p>'
    html_ok__already_pending = '<p>Your request has already been submitted.<br>please check your email to activate your account.</p>'
    html_err__tech_difficulty = '<p>We are experiencing technical difficulty processing your request,<br>please try again later.</p>'

    # use incoming request as house keeping trigger
    us_req_map = get_or_init_usreq_map()
    filter_expired_requests(us_req_map)

    if request.method == 'POST':
        # FIXME: add captcha
        # if req_json['captcha_solution'] = ...

        try:
            us_req = sanitize_and_validate_input(request)
        except Exception as e:
            log.exception(e)
            return make_response__json__html(status=400, html_str=html_err__tech_difficulty)

        # FIXME: implement form validation

        existing_req = us_req_map.get(us_req['email_address'])
        if None != existing_req:
            # already pending
            log.warning('user signup: request already pending: %s' % (existing_req))
            return make_response__json__html(status=200, html_str=html_ok__already_pending)

        us_req['submission_date'] = datetime.now()
        us_req['validation_key'] = generate_security_token()

        # send activation email
        try:
            activation_link = send_user_activation_link__email(us_req)

            log.info('user sign-up: req received, activation link sent via email: link: %s' % (activation_link))

            add_user_signup_req(us_req_map, us_req)
            return make_response__json__html(html_str=html_ok__submitted)
        except Exception as e:
            log.exception('user sign-up: failed to send validation email')  # exception derived from stack
            return make_response__json__html(status=500, html_str=html_err__tech_difficulty)

    if request.method == 'GET':

        v_tok = request.args.get('v_tok')
        if None != v_tok:  # validation token passed
            for _, us_req in us_req_map.items():
                other_req_v_tok = us_req['validation_key']
                if None == other_req_v_tok:
                    continue
                if other_req_v_tok == v_tok:

                    if us_req.has_expired():  # check again whether request has expired
                        log.warning('user signup: attempt to activate expired signup request: email: %s' % (us_req['email_address']))
                        return render_template('user_signup.html', state='activation_failure')

                    try:
                        activate_user_account(us_req)
                    except Exception as e:
                        log.exception(e)
                        return render_template('user_signup.html', state='activation_failure')

                    # activation success
                    rm_user_signup_req(us_req_map, us_req)
                    return render_template('user_signup.html', state='activation_success')

            # request expired & already removed OR bad token
            log.warning('user sign-up: request not found or bad token: remote-address: %s' % (request.remote_addr))
            return render_template('user_signup.html', state='activation_failure')

        else:  # no validation token: new user
            return render_template('user_signup.html')

def send_user_activation_link__email(us_req):
    """
    Send user feedback by email along with screen capture attachments
    
    @return: activation_link
    @raise exception: on send error
    """

    # FIXME: use HTTPS
    activation_link = 'http://%s/signup?v_tok=%s' % (current_app.rz_config.SERVER_NAME,
                                                       us_req['validation_key'])

    msg_body = ['Hello %s %s,' % (us_req['first_name'],
                                  us_req['last_name']),
                '',
                'Thank you for your joining the Rhizi community!',
                '',
                'Below is a sign up confirmation link - open it in your browser to activate your account:',
                '',
                activation_link,
                '',
                'Happy knowledge editing!',
                'The Rhizi team.'
                ]
    msg_body = '\n'.join(msg_body)

    send_email_message(recipients=[us_req['email_address']],
                       subject="Rhizi sign up request",
                       body=msg_body)
    return activation_link
