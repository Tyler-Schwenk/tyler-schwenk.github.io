"""
Trash reminder service.

Sends weekly SMS reminders on Thursday evenings via Twilio, then follows up
hourly until a roommate confirms by replying. Uses APScheduler for scheduling
and a simple JSON state file for persistence across restarts.
"""

import json
import logging
import threading
from datetime import date, datetime
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import APIRouter, Request, Response
from twilio.request_validator import RequestValidator
from twilio.rest import Client

from app.config import settings

logger = logging.getLogger(__name__)

# keep state writes atomic — scheduler runs in a thread, webhook in async
_state_lock = threading.Lock()

# how many days after Thursday to keep sending follow-ups (1 = Thu + Fri)
MAX_FOLLOWUP_DAYS = 1

router = APIRouter(prefix="/trash", tags=["Trash Reminder"])


# --- state management ---


def _state_path() -> Path:
    """Return the path to the trash state JSON file."""
    return Path(settings.DATA_DIR) / "trash_state.json"


def load_state() -> dict:
    """
    Load current trash reminder state from disk.

    Returns:
        dict with keys: week_iso, confirmed, confirmed_by, last_sent.
        Returns empty dict if no state file exists.
    """
    path = _state_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Failed to load trash state: %s — returning empty state", exc)
        return {}


def save_state(state: dict) -> None:
    """
    Persist trash reminder state to disk.

    Args:
        state: State dict to write. Expected keys: week_iso, confirmed, confirmed_by, last_sent.
    """
    try:
        _state_path().write_text(json.dumps(state, indent=2))
    except OSError as exc:
        logger.error("Failed to save trash state: %s — reminder state lost until restart", exc)


def current_iso_week() -> str:
    """
    Return the ISO year-week string for today, e.g. '2026-W19'.

    Returns:
        str: ISO year-week.
    """
    iso = date.today().isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


# --- SMS helpers ---


def _build_twilio_client() -> Client:
    """Return a configured Twilio REST client using settings credentials."""
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def send_trash_sms(message: str) -> None:
    """
    Send an SMS to every roommate in ROOMMATE_PHONES.

    Logs errors per-number but doesn't raise — we don't want one bad number
    to stop texts from going out to everyone else.

    Args:
        message: Text body to send.
    """
    client = _build_twilio_client()
    for number in settings.roommate_phones_list:
        try:
            client.messages.create(
                body=message,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=number,
            )
            logger.info("Sent trash SMS to %s", number)
        except Exception as exc:
            logger.error("Failed to send SMS to %s: %s — skipping this number", number, exc)


# --- scheduler jobs ---


def _is_quiet_hours(now: datetime) -> bool:
    """
    Check if the current time falls within configured quiet hours.

    Handles windows that cross midnight (e.g. 22:00 to 08:00).

    Args:
        now: Current datetime.

    Returns:
        bool: True if texting should be suppressed.
    """
    h = now.hour
    start = settings.TRASH_QUIET_START_HOUR
    end = settings.TRASH_QUIET_END_HOUR

    if start < end:
        # window doesn't cross midnight (e.g. 02:00 to 06:00)
        return start <= h < end

    # window crosses midnight (e.g. 22:00 to 08:00)
    return h >= start or h < end


def send_initial_reminder() -> None:
    """
    Scheduled job: fire the initial Thursday evening trash reminder.

    Skips silently if trash is already confirmed for the current week.
    Resets state and sends the configured TRASH_INITIAL_MESSAGE.
    """
    week = current_iso_week()

    with _state_lock:
        state = load_state()
        if state.get("week_iso") == week and state.get("confirmed"):
            logger.info("Trash already confirmed for %s — skipping initial reminder", week)
            return

        save_state({
            "week_iso": week,
            "confirmed": False,
            "confirmed_by": None,
            "last_sent": datetime.now().isoformat(),
        })

    send_trash_sms(settings.TRASH_INITIAL_MESSAGE)
    logger.info("Sent initial trash reminder for week %s", week)


def send_followup_reminder() -> None:
    """
    Scheduled job: send an hourly follow-up if trash isn't confirmed.

    Fires every hour but bails out early if:
    - No reminder has gone out this week yet
    - Trash is already confirmed
    - Currently within quiet hours
    - More than MAX_FOLLOWUP_DAYS days have passed since Thursday
    """
    with _state_lock:
        state = load_state()

    week = current_iso_week()

    if state.get("week_iso") != week:
        return  # no reminder sent this week, nothing to follow up on

    if state.get("confirmed"):
        return  # already handled, all good

    now = datetime.now()

    if _is_quiet_hours(now):
        logger.debug("Quiet hours — skipping follow-up at %s", now.strftime("%H:%M"))
        return

    # only follow up Thursday through Thursday+MAX_FOLLOWUP_DAYS
    # weekday(): Monday=0, Thursday=3
    days_since_thursday = (date.today().weekday() - 3) % 7
    if days_since_thursday > MAX_FOLLOWUP_DAYS:
        return

    send_trash_sms(settings.TRASH_FOLLOWUP_MESSAGE)

    with _state_lock:
        state = load_state()
        save_state({**state, "last_sent": now.isoformat()})

    logger.info("Sent follow-up trash reminder for week %s", week)


def start_scheduler(scheduler: AsyncIOScheduler) -> None:
    """
    Register trash reminder jobs on the given APScheduler instance.

    Skips registration if Twilio credentials aren't configured (useful for
    dev environments where you don't want accidental texts).

    Args:
        scheduler: A running (or about to be started) AsyncIOScheduler.
    """
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not set — trash reminder scheduler disabled")
        return

    if not settings.roommate_phones_list:
        logger.warning("ROOMMATE_PHONES not set — trash reminder scheduler disabled")
        return

    tz = settings.TRASH_TIMEZONE

    # initial reminder every Thursday at the configured hour
    scheduler.add_job(
        send_initial_reminder,
        CronTrigger(day_of_week="thu", hour=settings.TRASH_REMINDER_HOUR, timezone=tz),
        id="trash_initial",
        replace_existing=True,
    )

    # hourly follow-up check (the job itself decides whether to actually send)
    scheduler.add_job(
        send_followup_reminder,
        IntervalTrigger(hours=1),
        id="trash_followup",
        replace_existing=True,
    )

    logger.info(
        "Trash reminders scheduled: Thursdays at %d:00 %s, hourly follow-ups, quiet %d:00–%d:00",
        settings.TRASH_REMINDER_HOUR,
        tz,
        settings.TRASH_QUIET_START_HOUR,
        settings.TRASH_QUIET_END_HOUR,
    )


# --- webhook ---

# any reply containing one of these words counts as "done"
_CONFIRMATION_KEYWORDS = {
    "done", "yes", "took", "got it", "yep", "yup",
    "did it", "i did", "taken", "out", "finished",
}


def _is_confirmation(body: str) -> bool:
    """
    Check whether an SMS body is a trash-taken confirmation.

    Checks for any known confirmation keyword in the message. Intentionally
    broad — if someone texts back at all, they probably mean yes.

    Args:
        body: Raw SMS message body.

    Returns:
        bool: True if the message confirms trash is taken.
    """
    lower = body.lower().strip()
    return any(kw in lower for kw in _CONFIRMATION_KEYWORDS)


@router.post("/reply", include_in_schema=False)
async def twilio_reply_webhook(request: Request) -> Response:
    """
    Twilio webhook for incoming SMS replies.

    Marks the current week as confirmed when a known roommate sends a
    confirmation message. Validates the Twilio request signature to prevent
    spoofing. Always returns a valid (empty) TwiML response.

    Args:
        request: FastAPI request (form body contains Twilio's POST params).

    Returns:
        Response: Empty TwiML so Twilio doesn't complain.
    """
    form_data = dict(await request.form())
    from_number = form_data.get("From", "")
    body = form_data.get("Body", "")

    # validate request is actually from Twilio using the configured webhook URL
    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
    signature = request.headers.get("X-Twilio-Signature", "")

    if not validator.validate(settings.TRASH_WEBHOOK_URL, form_data, signature):
        logger.warning("Invalid Twilio signature from %s — rejecting request", from_number)
        return Response(content="<Response/>", media_type="text/xml", status_code=403)

    # ignore replies from unknown numbers — don't let randos confirm our trash
    if from_number not in settings.roommate_phones_list:
        logger.info("Reply from unknown number %s — ignoring", from_number)
        return Response(content="<Response/>", media_type="text/xml")

    if not _is_confirmation(body):
        logger.info("Non-confirmation reply from %s: '%s'", from_number, body)
        return Response(content="<Response/>", media_type="text/xml")

    week = current_iso_week()

    with _state_lock:
        state = load_state()

        if state.get("week_iso") != week or state.get("confirmed"):
            logger.info(
                "Confirmation from %s for week %s — no active reminder or already confirmed",
                from_number, week,
            )
            return Response(content="<Response/>", media_type="text/xml")

        save_state({**state, "confirmed": True, "confirmed_by": from_number})

    logger.info("Trash confirmed for week %s by %s", week, from_number)
    send_trash_sms(f"Trash is out! Thanks for taking care of it. See you next Thursday.")

    return Response(content="<Response/>", media_type="text/xml")


@router.get("/status")
async def trash_status() -> dict:
    """
    Return the current trash reminder state.

    Useful for debugging — shows the current week, whether trash is confirmed,
    and when the last reminder went out.

    Returns:
        dict: Current week and full state dict.
    """
    return {
        "current_week": current_iso_week(),
        "state": load_state(),
    }
