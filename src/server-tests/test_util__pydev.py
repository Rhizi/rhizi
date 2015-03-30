"""
PYDev test utilities
"""
import sys
import logging

log = logging.getLogger('rhizi')

def py_dev():
    try:  # enable pydev remote debugging
        import pydevd
        pydevd.settrace(trace_only_current_thread=False)
    except ImportError as e:
        pass


def debug__pydev_pd_arg(f_main):
    """
    PyDev Eclipse remote debug decorator:
       - follow PyDev's remote debugging instructions: http://pydev.org/manual_adv_remote_debugger.html
       - decorate main test function with @debug__pydev_pd_arg
       - pass the -pd command line argument
    """

    def main_decorated(*args, **kwargs):
        if len(sys.argv) > 1 and sys.argv[1] == '-pd':
            try:  # enable pydev remote debugging
                import pydevd
                pydevd.settrace(trace_only_current_thread=False)
            except ImportError as e:
                log.exception('failed to import pydevd')

            sys.argv.pop() # hide extra arg from main()
        f_main(*args, **kwargs)

    return main_decorated
