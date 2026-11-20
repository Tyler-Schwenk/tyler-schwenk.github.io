"""
Outgoing email over SMTP, for the opium den's live alerts.

Any provider with SMTP works (resend, gmail with an app password, ...), set through the
SMTP_* and MAIL_FROM settings. Each email goes out on its own (never one email with
everyone on it), so nobody sees anyone else's address and each gets its own unsubscribe
link. smtplib blocks, so send_emails runs it in a worker thread.
"""

import logging
import smtplib
import ssl
import time
from dataclasses import dataclass, field
from email import policy
from email.message import EmailMessage

import anyio

from app.config import settings

logger = logging.getLogger(__name__)

SMTP_TIMEOUT_S = 20
# the port that's TLS from the first byte; anything else upgrades with STARTTLS
IMPLICIT_TLS_PORT = 465
# gap between emails in one batch. resend's free tier takes 2 a second, and slower is
# kinder to any provider's spam heuristics
SEND_INTERVAL_S = 0.6
# RFC 5322's hard limit on a line. python's default (78) folds a long List-Unsubscribe url
# into encoded words, which mail apps can't read as a link
MAX_HEADER_LINE_LENGTH = 998
MESSAGE_POLICY = policy.SMTP.clone(max_line_length=MAX_HEADER_LINE_LENGTH)


class MailNotConfiguredError(Exception):
    """SMTP_HOST or MAIL_FROM isn't set, so nothing can be sent."""


class MailServerError(Exception):
    """Couldn't connect or log in to the SMTP server, so nothing in the batch was sent."""


@dataclass
class OutgoingEmail:
    """
    One plain text email.

    Attributes:
        to: The recipient's address.
        subject: One line.
        body: Plain text, line breaks kept.
        headers: Extra headers, like List-Unsubscribe.
    """
    to: str
    subject: str
    body: str
    headers: dict[str, str] = field(default_factory=dict)


def mail_configured() -> bool:
    """
    Says whether there's enough config to send anything.

    Returns:
        bool: True when SMTP_HOST and MAIL_FROM are both set.
    """
    return bool(settings.SMTP_HOST and settings.MAIL_FROM)


def build_message(email: OutgoingEmail) -> EmailMessage:
    """
    Turns an OutgoingEmail into a message smtplib can send.

    Args:
        email: The email.

    Returns:
        EmailMessage: With From, To, Subject, any extra headers, and the body.
    """
    message = EmailMessage(policy=MESSAGE_POLICY)
    message["From"] = settings.MAIL_FROM
    message["To"] = email.to
    message["Subject"] = email.subject
    for name, value in email.headers.items():
        message[name] = value
    message.set_content(email.body)
    return message


def connect() -> smtplib.SMTP:
    """
    Opens an encrypted, logged in connection to the SMTP server.

    Returns:
        smtplib.SMTP: Ready to send. The caller closes it.

    Raises:
        MailServerError: If it can't connect, encrypt or log in.
    """
    host, port = settings.SMTP_HOST, settings.SMTP_PORT
    context = ssl.create_default_context()
    smtp: smtplib.SMTP | None = None
    try:
        if port == IMPLICIT_TLS_PORT:
            smtp = smtplib.SMTP_SSL(host, port, timeout=SMTP_TIMEOUT_S, context=context)
        else:
            smtp = smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_S)
            smtp.starttls(context=context)
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        return smtp
    except (smtplib.SMTPException, OSError) as err:
        if smtp is not None:
            smtp.close()
        raise MailServerError(
            f"couldn't connect and log in to the mail server {host}:{port} ({err}) -- "
            "check SMTP_HOST, SMTP_PORT, SMTP_USERNAME and SMTP_PASSWORD in the backend's .env"
        ) from err


def send_one(smtp: smtplib.SMTP, email: OutgoingEmail) -> bool:
    """
    Sends one email on an open connection, logging instead of raising if it's refused.

    Args:
        smtp: An open connection from connect().
        email: The email.

    Returns:
        bool: True if the server took it.
    """
    try:
        smtp.send_message(build_message(email))
        return True
    except (smtplib.SMTPException, OSError) as err:
        logger.error(f"mailer: couldn't send {email.subject!r} to {email.to} ({err})")
        return False


def send_all_blocking(emails: list[OutgoingEmail]) -> list[str]:
    """
    Sends a batch over one connection, a short gap between each. Blocks.

    Args:
        emails: What to send.

    Returns:
        list[str]: The addresses that failed. If the connection drops partway, everyone
            after that fails too, and is listed.

    Raises:
        MailServerError: If it can't connect or log in at all.
    """
    failed: list[str] = []
    with connect() as smtp:
        for index, email in enumerate(emails):
            if index:
                time.sleep(SEND_INTERVAL_S)
            if not send_one(smtp, email):
                failed.append(email.to)
    return failed


async def send_emails(emails: list[OutgoingEmail]) -> list[str]:
    """
    Sends a batch of emails without blocking the event loop.

    Args:
        emails: What to send.

    Returns:
        list[str]: The addresses that failed.

    Raises:
        MailNotConfiguredError: If SMTP_HOST or MAIL_FROM isn't set.
        MailServerError: If it can't connect or log in.
    """
    if not mail_configured():
        raise MailNotConfiguredError("SMTP_HOST and MAIL_FROM aren't set in the backend's .env")
    failed = await anyio.to_thread.run_sync(send_all_blocking, emails)
    logger.info(f"mailer: sent {len(emails) - len(failed)} of {len(emails)} emails")
    return failed
