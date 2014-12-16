"""
code with no better place to go
"""
import time

def debug_log_duration(method):
    """
    dubug call durations - use example:
    
        neo4j_util.post = util.debug_log_duration(neo4j_util.post)
    """

    def timed(*args, **kw):
        t_0 = time.time()
        result = method(*args, **kw)
        t_1 = time.time()
        dt = t_1 - t_0

        print ('%2.2f sec, function: %r' % (dt, method.__name__))
        return result

    return timed
