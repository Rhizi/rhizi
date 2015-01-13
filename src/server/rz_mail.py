import smtplib
from os.path import basename
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import COMMASPACE, formatdate
from email import Encoders

from flask import current_app

def send_message(recipients, subject, attachments, body):
    send_from = current_app.rz_config.mail_default_sender
    smtp_hostname = current_app.rz_config.mail_hostname
    send_message_helper(smtp_hostname=smtp_hostname,
                        send_from=send_from, recipients=recipients,
                        subject=subject, attachments=attachments, body=body)

def send_message_helper(smtp_hostname, send_from, recipients, subject, attachments, body):
    """
    attachments is a list of tuples (filename, mimetype, data)

    note: helper exists for ease of testing, since it doesn't use flask only
    python batteries-included packages
    """
    assert isinstance(recipients, list)
    msg = MIMEMultipart()
    msg['From'] = send_from
    msg['To'] = COMMASPACE.join(recipients)
    msg['Date'] = formatdate(localtime=True)
    msg['Subject'] = subject
    msg.attach(MIMEText(body))

    for filename, mimetype, data in attachments:
        maintype, subtype = mimetype.split('/')
        part = MIMEBase(maintype, subtype)
        part.set_payload(data)
        Encoders.encode_base64(part)
        part.add_header('Content-Disposition', 'attachment', filename=filename)
        #Content_Disposition: attachment; filename="feedback_page.html"
        msg.attach(part)

    smtp = smtplib.SMTP(smtp_hostname)
    smtp.sendmail(send_from, recipients, msg.as_string())
    smtp.close()

if __name__ == '__main__':
    # FIXME - move to actual test suite
    send_message_helper('localhost', 'alon@localhost', ['alon@localhost'], 'test subject', [
        ('diary.txt', 'text/plain', "bla bla bla yeah that's right bla")], 'this is it pal')
