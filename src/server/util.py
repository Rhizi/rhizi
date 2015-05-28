#    This file is part of rhizi, a collaborative knowledge graph editor.
#    Copyright (C) 2014-2015  Rhizi
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as published
#    by the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.


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
