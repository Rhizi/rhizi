import hashlib
import logging

log = logging.getLogger('rhizi')

def hash_pw(pw_str, salt_str):
    salt = hashlib.sha512(salt_str).hexdigest()
    ret = hashlib.sha512(pw_str + salt).hexdigest()
    return ret
