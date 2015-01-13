from flask_mail import Mail, Message

mail = None

def init_mail(webapp):
    global mail
    mail = Mail(webapp)

def send_message(recipients, subject, attachments, body):
    """
    attachments is a list of tuples (filename, data)
    libmagic is used to guess the mimetype
    """
    msg = Message(subject, recipients=recipients)
    msg.body = body
    for filename, mimetype, data in attachments:
        msg.attach(filename=filename, content_type=mimetype, data=data)
    mail.send(msg)

