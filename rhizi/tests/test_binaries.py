# coding: utf-8

import unittest
import os
import sys
import subprocess
from glob import glob
import time
from tempfile import TemporaryFile, mktemp

from six import u


root_path = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', '..'))
bin_path = os.path.join(root_path, 'bin')


def which(f):
    return [p for p in [os.path.join(x, f) for x in os.environ['PATH'].split(':')] if os.path.exists(p)][0]

python_bin = which('python')

def run_python_script(s, args):
    # not working right now, so do run the long way
    return run_process(python_bin, [s] + args)
    with open(s) as fd:
        old_argv = sys.argv
        sys.argv = [s] + args
        try:
            exec(fd.read())
        except Exception as e:
            ret = -1, str(e)
        else:
            ret = 0, None
        sys.argv = old_argv
    return ret

def run(f, args):
    run_python = False
    with open(f) as fd:
        first_line = fd.readline()
        run_python = first_line[:2] == '#!' and 'python' in first_line
    if run_python:
        return run_python_script(f, args)
    else:
        return run_process(f, args)

def run_process(f, args):
    null = TemporaryFile()
    print(str([f] + args))
    env = dict(PYTHONPATH=root_path,
               LC_ALL='en_US.UTF-8',
               LANG='en_US.UTF-8')
    proc = subprocess.Popen([f] + args, env=env, stdout=null, stderr=null)
    max = 5
    dt = 0.1
    t = 0
    while t < max:
        if proc.poll() is not None:
            break
        t += dt
        time.sleep(dt)
    if proc.poll() is None:
        ret = None # still running is fine - rz_server will run
        proc.terminate()
    else:
        ret = proc.poll()
    if ret is None:
        return ret, None
    null.seek(0)
    return ret, null.read().decode('utf-8')


def temp_file(contents):
    filename = mktemp()
    with open(filename, 'w+') as fd:
        fd.write(contents)
    return filename


class TestBinaries(unittest.TestCase):

    def _helper_test_a_tool(self, bin_name, args):
        filename = os.path.join(bin_path, bin_name)
        ret, msg = run(filename, args)
        self.assertTrue(ret == 0,
                        msg=u("failed to run {} {}, ret = {}, msg:\n{}").format(
                            bin_name, args, ret, msg))

    def _run_user_tool(self, args):
        if not isinstance(args, list):
            args = args.split()
        self._helper_test_a_tool('rz-user-tool', args)

    def test_root_path(self):
        """
        helper test for test_binaries
        """
        self.assertTrue(os.path.exists(os.path.join(root_path, 'setup.py')))

    def test_sanitybinaries(self):
        """
        check that bin/* can execute with --help

        some scripts may produce log files and db access as side effects.
        """
        for bin_name in [os.path.basename(p) for p in glob(os.path.join(bin_path, '*'))]:
            self._helper_test_a_tool(os.path.basename(bin_name), ['--help'])

    def test_user_tool(self):
        """
        test rz-user-tool

        do a whole cycle:
        init a new file
        add a user to it
        list the users
        """
        userdb_filename = mktemp()
        password_filename = temp_file('12345678')
        myugid = subprocess.check_output('whoami').strip().decode('utf-8') # assume group = user exists
        self._run_user_tool('init --user-db-path {} --user-db-ugid {}'.format(userdb_filename, myugid))
        self._run_user_tool(('add --user-db-path {} --password-file {} ' \
                             '--first-name hiro --last-name protagonist ' \
                             '--username hiro --email hiro@protagonist.com').format(
                                 userdb_filename, password_filename))
        self._run_user_tool(['add', '--user-db-path', userdb_filename, '--verbose',
                             '--first-name', 'מורה', '--last-name', 'נבוכים',
                             '--username', 'מורה', '--email', 'more@nevochim.com',
                             '--password-file', password_filename])
        self._run_user_tool('list --user-db-path {} --verbose'.format(userdb_filename))
