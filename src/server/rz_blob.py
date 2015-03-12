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
