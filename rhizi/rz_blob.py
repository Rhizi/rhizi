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


from flask import Flask, send_from_directory, request
from werkzeug import secure_filename

def upload():
    f = request.files['file']
    f.save('temp')
    checksum = filechecksum('temp', f.filename)
    d = os.path.join(uploads_dir, checksum)
    makedirs(d)
    shutil.move('temp', os.path.join(d, secure_filename(f.filename)))
    return os.path.join('/', 'blob', checksum, secure_filename(f.filename))


def retreive():
    pass
