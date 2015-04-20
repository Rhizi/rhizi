from email import Encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import COMMASPACE, formatdate
from flask import current_app
import logging
from os.path import basename
import smtplib


log = logging.getLogger('rhizi')

def send_email__flask_ctx(recipients, subject, body, attachments=[]):
    """
    Flask context dependent email sending utility
    """

    send_from = current_app.rz_config.mail_default_sender
    mta_host = current_app.rz_config.mta_host
    mta_port = current_app.rz_config.mta_port

    send_email(mta_host,
                        mta_port,
                        send_from=send_from,
                        recipients=recipients,
                        subject=subject,
                        attachments=attachments,
                        body=body)

    log.info('email sent: recipients: %s: subject: %s, attachment-count: %d' % (recipients, subject, len(attachments)))

def send_email(mta_host, mta_port, send_from, recipients, subject, attachments, body):
    """
    Note: to allow for easy testing this function should not depend on any flask app/request context

    @param attachments: is a list of tuples (filename, mimetype, data)
    """
    assert isinstance(recipients, list)

    msg = MIMEMultipart('utf-8')
    msg['From'] = send_from
    msg['To'] = COMMASPACE.join(recipients)
    msg['Date'] = formatdate(localtime=True)
    msg['Subject'] = subject
    msg.attach(MIMEText(body, _charset='utf-8'))

    for filename, mimetype, data in attachments:
        maintype, subtype = mimetype.split('/')
        part = MIMEBase(maintype, subtype)
        part.set_payload(data)
        Encoders.encode_base64(part)
        part.add_header('Content-Disposition', 'attachment', filename=filename)
        # Content_Disposition: attachment; filename="feedback_page.html"
        msg.attach(part)

    smtp = smtplib.SMTP(host=mta_host, port=mta_port)
    smtp.sendmail(send_from, recipients, msg.as_string())
    smtp.close()

if __name__ == '__main__':
    # FIXME - move to actual test suite
    send_email('localhost', 'alon@localhost', ['alon@localhost'], 'test subject', [
        ('diary.txt', 'text/plain', "bla bla bla yeah that's right bla")], 'this is it pal')
