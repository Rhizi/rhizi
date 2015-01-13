import smtplib
from os.path import basename
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import COMMASPACE, formatdate
from email import Encoders

from flask import current_app

def send_message(recipients, subject, attachments, body):
    """
    attachments is a list of tuples (filename, mimetype, data)
    """
    assert isinstance(recipients, list)
    send_from = current_app.rz_config.mail_default_sender
    msg = MIMEMultipart(
        From=send_from,
        To=COMMASPACE.join(recipients),
        Date=formatdate(localtime=True),
        Subject=subject
    )
    msg.attach(MIMEText(body))

    for filename, mimetype, data in attachments:
        maintype, subtype = mimetype.split('/')
        part = MIMEBase(maintype, subtype)
        part.set_payload(data)
        Encoders.encode_base64(part)
        part.add_header('Content_Disposition', 'attachment; filename="%s"' % filename)
        msg.attach(part)

    smtp = smtplib.SMTP(current_app.rz_config.mail_hostname)
    smtp.sendmail(send_from, recipients, msg.as_string())
    smtp.close()
