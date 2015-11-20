import unittest
import os
import sys
import subprocess
from glob import glob
import time
from tempfile import TemporaryFile


root_path = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', '..'))
bin_path = os.path.join(root_path, 'bin')

# running python binaries takes a long time for some reason, so short circuit
# by using this python interpreter
def run_python_script(s, args):
    with open(s) as fd:
        old_argv = sys.argv
        sys.argv = [s] + args
        try:
            exec fd
        except Exception, e:
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
    proc = subprocess.Popen([f] + args,
                            env=dict(PYTHONPATH=root_path), stdout=null,
                            stderr=null)
    max = 5
    dt = 0.1
    t = 0
    while t < max:
        if proc.poll() is not None:
            break
        t += dt
        time.sleep(dt)
    if proc.poll() is None:
        ret = 0 # still running is fine - rz_server will run
        proc.terminate()
    else:
        ret = proc.poll()
    if ret == 0:
        return ret, None
    null.seek(0)
    return ret, null.read()

class TestBinaries(unittest.TestCase):

    def _helper_test_a_tool(self, bin_name, args):
        filename = os.path.join(bin_path, bin_name)
        ret, msg = run(filename, args)
        self.assertTrue(ret == 0, msg="failed to run {}, ret = {}, msg = {}".format(bin_name, ret, msg))

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
