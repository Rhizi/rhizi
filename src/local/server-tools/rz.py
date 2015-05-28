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


# hack to setup rhizi path - needs a proper install
import sys
import os

# to work both from source dir and from deployment dir
path = None
for postfix in [['..', 'bin'], ['..', '..', 'server']]:
    candidate = os.path.join(*([os.path.dirname(__file__)] + postfix))
    if os.path.exists(candidate):
        path = candidate
        break
if None is path:
    print("must be run from one or two directories above server")
    raise SystemExit
sys.path.append(path)
