"""
DJ alerts router -- emails telling people the dj stream's live.

Anyone can sign up from the live room with just an email address, and they're on the
list straight away, no confirmation email. The admin can see everyone on the admin page
and take off anyone who shouldn't be there. Alerts never go out on their own: the admin writes one on the admin page's DJ tab and sends it, or a guest dj
does from their /guest-dj page, once per set and only while they're on air. Guests never
see who's on the list. Sending one while a set's recording also makes its subject and
message that set's title and description, since they're usually the same thing (editable
later like any set). Every email is html styled like the den with a plain text fallback
(app/dj_alert_email.py), and carries an unsubscribe link (to the site's
/opium-den/live/alerts page) and one-click unsubscribe headers for mail apps.
"""

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dj_alert_email import alert_html, alert_text
from app.dependencies import DjActor, require_admin, require_dj_or_admin
from app.kiln_firings import utc_now_naive
from app.mailer import MailNotConfiguredError, MailServerError, OutgoingEmail, mail_configured, send_emails
from app.dj_stream import watcher
from app.models import DjAlertSubscriber, DjSet
from app.rate_limit import limiter
from app.schemas import (
    DjAlertAudience,
    DjAlertSend,
    DjAlertSendResult,
    DjAlertSignup,
    DjAlertSignupResult,
    DjAlertSubscriberRead,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dj/alerts", tags=["DJ"])

# per visitor IP. a person signs up once; this just stops a script filling the list
SIGNUP_RATE_LIMIT = "5/minute;20/hour"
# random bytes in each subscriber's unsubscribe token (43 url-safe characters)
TOKEN_BYTES = 32

ALERTS_PAGE_PATH = "/opium-den/live/alerts"
LIVE_ROOM_PATH = "/opium-den/live/room"
DEFAULT_ALERT_SUBJECT = "Tyler's live in the den"
# a guest dj's default subject, with their name in it
GUEST_ALERT_SUBJECT = "{name}'s live in the den"

MAIL_NOT_CONFIGURED_DETAIL = "live alerts aren't set up on the pi yet -- SMTP_HOST and MAIL_FROM need setting in the backend's .env"


def unsubscribe_page_url(token: str) -> str:
    """
    A link to the site's alerts page, which unsubscribes when it opens.

    Args:
        token: The subscriber's token.

    Returns:
        str: Like https://tyler-schwenk.com/opium-den/live/alerts?unsubscribe=abc.
    """
    return f"{settings.SITE_URL}{ALERTS_PAGE_PATH}?unsubscribe={token}"


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


def alert_email(subscriber: DjAlertSubscriber, subject: str, body: str) -> OutgoingEmail:
    """
    One subscriber's copy of an alert: the dj's words, the room link, and their own
    unsubscribe link and headers, as html with a plain text fallback.

    Args:
        subscriber: A subscriber.
        subject: The subject line.
        body: What the dj wrote.

    Returns:
        OutgoingEmail: The alert.
    """
    room_url = f"{settings.SITE_URL}{LIVE_ROOM_PATH}"
    unsubscribe_url = unsubscribe_page_url(subscriber.token)
    return OutgoingEmail(
        to=subscriber.email,
        subject=subject,
        body=alert_text(body, room_url, unsubscribe_url),
        html=alert_html(subject, body, room_url, unsubscribe_url),
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


@router.post("/signup", response_model=DjAlertSignupResult, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(SIGNUP_RATE_LIMIT)
async def sign_up(request: Request, signup: DjAlertSignup, db: Session = Depends(get_db)) -> DjAlertSignupResult:
    """
    Puts an address on the live alerts list. Nothing's emailed; the next alert is the
    first they hear. Answers the same whether it's new or already on the list.

    Args:
        request: Incoming request (the rate limiter keys on its IP).
        signup: The email address.
        db: Database session.

    Returns:
        DjAlertSignupResult: The address, as it was saved.

    Raises:
        HTTPException: 503 if mail isn't configured (no alert could ever reach them),
            422 for a bad address, 429 past the rate limit.
    """
    if not mail_configured():
        raise HTTPException(status_code=503, detail=MAIL_NOT_CONFIGURED_DETAIL)
    email = signup.email.lower()
    existing = db.query(DjAlertSubscriber).filter(DjAlertSubscriber.email == email).first()
    if existing is not None:
        return DjAlertSignupResult(email=email)
    db.add(DjAlertSubscriber(email=email, token=secrets.token_urlsafe(TOKEN_BYTES), created_at=utc_now_naive()))
    db.commit()
    logger.info(f"dj alerts: {email} signed up")
    return DjAlertSignupResult(email=email)


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
    Everyone signed up, newest first (admin only).

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


def recording_set(db: Session) -> DjSet | None:
    """
    The set that's recording right now.

    Args:
        db: Database session.

    Returns:
        DjSet | None: The set, or None when nothing's recording.
    """
    set_id = watcher.recording_set_id
    return db.get(DjSet, set_id) if set_id is not None else None


def guest_alert_set(db: Session, actor: DjActor) -> DjSet:
    """
    The set a guest dj's alert is for: theirs, on air right now, and not alerted yet.

    Args:
        db: Database session.
        actor: The guest dj sending.

    Returns:
        DjSet: Their live set.

    Raises:
        HTTPException: 409 if they're not on air, or already sent one for this set.
    """
    dj_set = recording_set(db)
    if dj_set is None or dj_set.dj is None or dj_set.dj.id != actor.guest.id:
        raise HTTPException(
            status_code=409,
            detail="you can only send an alert while you're on air -- start streaming, then send it",
        )
    if dj_set.guest_link.alert_sent_at is not None:
        raise HTTPException(status_code=409, detail="you've already sent an alert for this set, one per set")
    return dj_set


def label_live_set(db: Session, alert: DjAlertSend) -> int | None:
    """
    Makes an alert's subject and message the title and description of the set that's
    recording, if there is one. A blank subject leaves the title alone (the default
    subject isn't much of a title). Commits.

    Args:
        db: Database session.
        alert: The alert being sent.

    Returns:
        int | None: The set's id, or None when nothing's recording.
    """
    dj_set = recording_set(db)
    if dj_set is None:
        return None
    if alert.subject:
        dj_set.title = alert.subject
    dj_set.description = alert.body
    db.commit()
    logger.info(f"dj alerts: labelled live set {dj_set.id} from the alert")
    return dj_set.id


def all_subscribers(db: Session) -> list[DjAlertSubscriber]:
    """
    Everyone an alert goes to.

    Args:
        db: Database session.

    Returns:
        list[DjAlertSubscriber]: Every subscriber.
    """
    return db.query(DjAlertSubscriber).all()


@router.get("/audience", response_model=DjAlertAudience)
async def get_audience(
    actor: DjActor = Depends(require_dj_or_admin),
    db: Session = Depends(get_db),
) -> DjAlertAudience:
    """
    How many people an alert would go to (the admin or a guest dj), for the send button.
    Just the count, so guests never see who's on the list.

    Args:
        actor: Who's asking.
        db: Database session.

    Returns:
        DjAlertAudience: How many are signed up.
    """
    return DjAlertAudience(subscribers=len(all_subscribers(db)))


@router.post("/send", response_model=DjAlertSendResult)
async def send_alert(
    alert: DjAlertSend,
    actor: DjActor = Depends(require_dj_or_admin),
    db: Session = Depends(get_db),
) -> DjAlertSendResult:
    """
    Emails every subscriber (the admin, or a guest dj while they're on air,
    once per set). Each gets their own copy with their own unsubscribe link. Takes about
    SEND_INTERVAL_S per subscriber, so the request stays open until they've all gone. If
    a set's recording, the subject and message become its title and description first
    (label_live_set), whether or not the emails then go out.

    Args:
        alert: The subject (blank for the default) and what to say.
        actor: Who's sending.
        db: Database session.

    Returns:
        DjAlertSendResult: How many went, any address the mail server refused (only the
            count for a guest), and the set it labelled.

    Raises:
        HTTPException: 409 with nobody signed up, or for a guest who's off air or already
            sent one this set, 503 if mail isn't configured, 502 if the mail server can't
            be reached.
    """
    guest_set = None if actor.is_admin else guest_alert_set(db, actor)
    labelled_set_id = label_live_set(db, alert)
    subscribers = all_subscribers(db)
    if not subscribers:
        raise HTTPException(status_code=409, detail="nobody's signed up yet, so there's no one to send to")
    default_subject = DEFAULT_ALERT_SUBJECT if actor.is_admin else GUEST_ALERT_SUBJECT.format(name=actor.guest.name)
    subject = alert.subject or default_subject
    # marked before sending, so a guest can't send twice by clicking again while it's going out
    if guest_set is not None:
        guest_set.guest_link.alert_sent_at = utc_now_naive()
        db.commit()
    try:
        failed = await send_or_raise([alert_email(subscriber, subject, alert.body) for subscriber in subscribers])
    except HTTPException:
        # nothing went out, so the guest gets to try again
        if guest_set is not None:
            guest_set.guest_link.alert_sent_at = None
            db.commit()
        raise
    sender = "admin" if actor.is_admin else actor.guest.username
    logger.info(f"dj alerts: {sender} sent {subject!r} to {len(subscribers) - len(failed)} of {len(subscribers)}")
    return DjAlertSendResult(
        sent=len(subscribers) - len(failed),
        failed=failed if actor.is_admin else [],
        failed_count=len(failed),
        labelled_set_id=labelled_set_id,
    )
