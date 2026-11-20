"""
DJ alerts router -- emails telling people the dj stream's live.

Anyone can sign up from the live room with just an email address. They get a
confirmation email first, and only confirmed addresses get alerts, so typing in someone
else's address does nothing but send them one email they can ignore. Alerts never go out
on their own: the admin writes one on the admin page's DJ tab and sends it. Every email
carries an unsubscribe link (to the site's /opium-den/live/alerts page) and one-click
unsubscribe headers for mail apps.
"""

import logging
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import require_admin
from app.kiln_firings import utc_now_naive
from app.mailer import MailNotConfiguredError, MailServerError, OutgoingEmail, mail_configured, send_emails
from app.models import DjAlertSubscriber
from app.rate_limit import limiter
from app.schemas import DjAlertSend, DjAlertSendResult, DjAlertSignup, DjAlertSignupResult, DjAlertSubscriberRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dj/alerts", tags=["DJ"])

# per visitor IP. a person signs up once; this just stops a script mailing strangers
SIGNUP_RATE_LIMIT = "5/minute;20/hour"
# signing up again while unconfirmed resends the confirmation, but not more often than
# this, so nobody can flood an address by signing it up from lots of IPs
CONFIRM_RESEND_COOLDOWN = timedelta(minutes=10)
# random bytes in each subscriber's link token (43 url-safe characters)
TOKEN_BYTES = 32

ALERTS_PAGE_PATH = "/opium-den/live/alerts"
LIVE_ROOM_PATH = "/opium-den/live/room"
CONFIRM_SUBJECT = "Confirm your live alerts from the den"
DEFAULT_ALERT_SUBJECT = "Tyler's live in the den"

CONFIRM_BODY = """Someone (hopefully you) asked for an email whenever Tyler goes live in the den at tyler-schwenk.com.

Confirm it here:
{confirm_url}

If that wasn't you, just ignore this and you won't hear from us again."""

ALERT_BODY = """{body}

Join the room: {room_url}

--
You're getting this because you signed up for live alerts on tyler-schwenk.com.
Unsubscribe: {unsubscribe_url}"""

MAIL_NOT_CONFIGURED_DETAIL = "live alerts aren't set up on the pi yet -- SMTP_HOST and MAIL_FROM need setting in the backend's .env"


def alerts_page_url(action: str, token: str) -> str:
    """
    A link to the site's alerts page, which confirms or unsubscribes when it opens.

    Args:
        action: "confirm" or "unsubscribe".
        token: The subscriber's token.

    Returns:
        str: Like https://tyler-schwenk.com/opium-den/live/alerts?confirm=abc.
    """
    return f"{settings.SITE_URL}{ALERTS_PAGE_PATH}?{action}={token}"


def unsubscribe_headers(token: str) -> dict[str, str]:
    """
    The headers that give mail apps their own unsubscribe button (RFC 8058 one-click).

    Args:
        token: The subscriber's token.

    Returns:
        dict[str, str]: List-Unsubscribe pointing at POST /dj/alerts/unsubscribe, and
            List-Unsubscribe-Post saying it's one-click.
    """
    api_url = f"{settings.PUBLIC_API_URL}{router.prefix}/unsubscribe?token={token}"
    return {"List-Unsubscribe": f"<{api_url}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}


def confirmation_email(subscriber: DjAlertSubscriber) -> OutgoingEmail:
    """
    The email that asks a new subscriber to confirm.

    Args:
        subscriber: The (possibly not yet saved) subscriber.

    Returns:
        OutgoingEmail: The confirmation email.
    """
    return OutgoingEmail(
        to=subscriber.email,
        subject=CONFIRM_SUBJECT,
        body=CONFIRM_BODY.format(confirm_url=alerts_page_url("confirm", subscriber.token)),
    )


def alert_email(subscriber: DjAlertSubscriber, subject: str, body: str) -> OutgoingEmail:
    """
    One subscriber's copy of an alert: the admin's words, the room link, and their own
    unsubscribe link and headers.

    Args:
        subscriber: A confirmed subscriber.
        subject: The subject line.
        body: What the admin wrote.

    Returns:
        OutgoingEmail: The alert.
    """
    return OutgoingEmail(
        to=subscriber.email,
        subject=subject,
        body=ALERT_BODY.format(
            body=body,
            room_url=f"{settings.SITE_URL}{LIVE_ROOM_PATH}",
            unsubscribe_url=alerts_page_url("unsubscribe", subscriber.token),
        ),
        headers=unsubscribe_headers(subscriber.token),
    )


async def send_or_raise(emails: list[OutgoingEmail]) -> list[str]:
    """
    Sends emails, turning mail problems into errors the page can show.

    Args:
        emails: What to send.

    Returns:
        list[str]: The addresses the mail server refused.

    Raises:
        HTTPException: 503 if mail isn't configured, 502 if the mail server can't be reached.
    """
    try:
        return await send_emails(emails)
    except MailNotConfiguredError as err:
        raise HTTPException(status_code=503, detail=MAIL_NOT_CONFIGURED_DETAIL) from err
    except MailServerError as err:
        logger.error(f"dj alerts: {err}")
        raise HTTPException(
            status_code=502,
            detail="couldn't reach the mail server, nothing was sent -- check the backend logs",
        ) from err


def needs_confirmation_email(subscriber: DjAlertSubscriber) -> bool:
    """
    Says whether signing up again should send another confirmation.

    Args:
        subscriber: An existing subscriber.

    Returns:
        bool: True if they're unconfirmed and the last one went out over
            CONFIRM_RESEND_COOLDOWN ago.
    """
    if subscriber.confirmed_at is not None:
        return False
    return utc_now_naive() - subscriber.confirm_sent_at >= CONFIRM_RESEND_COOLDOWN


@router.post("/signup", response_model=DjAlertSignupResult, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(SIGNUP_RATE_LIMIT)
async def sign_up(request: Request, signup: DjAlertSignup, db: Session = Depends(get_db)) -> DjAlertSignupResult:
    """
    Signs an address up for live alerts by sending it a confirmation email. Answers the
    same whether it's new, waiting on its confirmation, or already confirmed.

    Args:
        request: Incoming request (the rate limiter keys on its IP).
        signup: The email address.
        db: Database session.

    Returns:
        DjAlertSignupResult: The address, as it was saved.

    Raises:
        HTTPException: 503 if mail isn't configured, 502 if the confirmation couldn't be
            sent, 422 for a bad address, 429 past the rate limit.
    """
    if not mail_configured():
        raise HTTPException(status_code=503, detail=MAIL_NOT_CONFIGURED_DETAIL)
    email = signup.email.lower()
    subscriber = db.query(DjAlertSubscriber).filter(DjAlertSubscriber.email == email).first()
    if subscriber is not None and not needs_confirmation_email(subscriber):
        return DjAlertSignupResult(email=email)

    now = utc_now_naive()
    if subscriber is None:
        subscriber = DjAlertSubscriber(
            email=email, token=secrets.token_urlsafe(TOKEN_BYTES), created_at=now, confirm_sent_at=now
        )
    failed = await send_or_raise([confirmation_email(subscriber)])
    if failed:
        raise HTTPException(
            status_code=502,
            detail=f"the mail server wouldn't take an email for {email} -- check the address and try again",
        )
    # only saved once the email's gone, so a failed send leaves nothing half done
    subscriber.confirm_sent_at = now
    db.add(subscriber)
    db.commit()
    logger.info(f"dj alerts: sent a confirmation to {email}")
    return DjAlertSignupResult(email=email)


@router.post("/confirm", response_model=DjAlertSignupResult)
async def confirm(token: str, db: Session = Depends(get_db)) -> DjAlertSignupResult:
    """
    Confirms a signup, from the link in the confirmation email. Confirming twice is fine.

    Args:
        token: The token from the link.
        db: Database session.

    Returns:
        DjAlertSignupResult: The confirmed address.

    Raises:
        HTTPException: 404 if no subscriber has that token (wrong link, or unsubscribed since).
    """
    subscriber = db.query(DjAlertSubscriber).filter(DjAlertSubscriber.token == token).first()
    if subscriber is None:
        raise HTTPException(
            status_code=404,
            detail="that link doesn't match a signup anymore -- sign up again from the live room",
        )
    if subscriber.confirmed_at is None:
        subscriber.confirmed_at = utc_now_naive()
        db.commit()
        logger.info(f"dj alerts: {subscriber.email} confirmed")
    return DjAlertSignupResult(email=subscriber.email)


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(token: str, db: Session = Depends(get_db)) -> None:
    """
    Unsubscribes, from the site's page or a mail app's one-click button (which posts
    `List-Unsubscribe=One-Click` as a form; the body's ignored). Answers the same if
    they're already gone, so a second click never looks like an error.

    Args:
        token: The subscriber's token.
        db: Database session.

    Side effects:
        Deletes the subscriber.
    """
    subscriber = db.query(DjAlertSubscriber).filter(DjAlertSubscriber.token == token).first()
    if subscriber is None:
        return
    db.delete(subscriber)
    db.commit()
    logger.info(f"dj alerts: {subscriber.email} unsubscribed")


@router.get("/subscribers", response_model=list[DjAlertSubscriberRead], dependencies=[Depends(require_admin)])
async def list_subscribers(db: Session = Depends(get_db)) -> list[DjAlertSubscriber]:
    """
    Everyone signed up, confirmed or not, newest first (admin only).

    Args:
        db: Database session.

    Returns:
        list[DjAlertSubscriber]: The subscribers.
    """
    return db.query(DjAlertSubscriber).order_by(DjAlertSubscriber.created_at.desc()).all()


@router.delete("/subscribers/{subscriber_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_subscriber(subscriber_id: int, db: Session = Depends(get_db)) -> None:
    """
    Takes someone off the list (admin only).

    Args:
        subscriber_id: The subscriber's id.
        db: Database session.

    Raises:
        HTTPException: 404 if there's no such subscriber.
    """
    subscriber = db.get(DjAlertSubscriber, subscriber_id)
    if subscriber is None:
        raise HTTPException(status_code=404, detail=f"no alert subscriber with id {subscriber_id}")
    db.delete(subscriber)
    db.commit()
    logger.info(f"dj alerts: admin removed {subscriber.email}")


@router.post("/send", response_model=DjAlertSendResult, dependencies=[Depends(require_admin)])
async def send_alert(alert: DjAlertSend, db: Session = Depends(get_db)) -> DjAlertSendResult:
    """
    Emails every confirmed subscriber (admin only). Each gets their own copy with their
    own unsubscribe link. Takes about SEND_INTERVAL_S per subscriber, so the request
    stays open until they've all gone.

    Args:
        alert: The subject (blank for the default) and what to say.
        db: Database session.

    Returns:
        DjAlertSendResult: How many went, and any address the mail server refused.

    Raises:
        HTTPException: 409 with nobody confirmed, 503 if mail isn't configured, 502 if
            the mail server can't be reached.
    """
    subscribers = db.query(DjAlertSubscriber).filter(DjAlertSubscriber.confirmed_at.is_not(None)).all()
    if not subscribers:
        raise HTTPException(status_code=409, detail="nobody's confirmed a signup yet, so there's no one to send to")
    subject = alert.subject or DEFAULT_ALERT_SUBJECT
    failed = await send_or_raise([alert_email(subscriber, subject, alert.body) for subscriber in subscribers])
    logger.info(f"dj alerts: sent {subject!r} to {len(subscribers) - len(failed)} of {len(subscribers)}")
    return DjAlertSendResult(sent=len(subscribers) - len(failed), failed=failed)
