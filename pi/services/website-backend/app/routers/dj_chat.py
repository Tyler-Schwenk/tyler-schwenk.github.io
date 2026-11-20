"""
DJ chat router -- the chat in the opium den's live room.

Anonymous like the public square: chatters pick a nickname, nothing else. During a live
session, a nickname belongs to the browser that first sends with it (its random
owner_key, kept in localStorage), so two people can't chat as the same name at once. The
next session starts with every name free again. Anyone can read
the recent messages; sending only works while the stream's live, so the chat is a room
that opens with the set instead of an always-on board for spam to collect in. The page
polls GET /dj/chat for the whole recent room (it's small), so a message the admin
deletes disappears for everyone on the next poll.
"""

import hashlib
import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.dj_stream import watcher
from app.models import DjChatMessage, DjChatName
from app.rate_limit import limiter
from app.schemas import DjChatMessageCreate, DjChatMessageRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dj/chat", tags=["DJ"])

# how far back the room's chat reaches. long enough to cover a long set and a break,
# short enough that tomorrow's set starts with an empty room
CHAT_HISTORY_WINDOW = timedelta(hours=6)
# most messages one read returns. the room shows the latest, older ones drop off
MAX_CHAT_MESSAGES = 100
# per visitor IP. plenty for chatting, too few to flood the room
CHAT_SEND_RATE_LIMIT = "8/minute;120/hour"


def utc_now() -> datetime:
    """
    The current time as naive UTC, like every other time in the database.

    Returns:
        datetime: Now, without tzinfo.
    """
    return datetime.now(UTC).replace(tzinfo=None)


def hash_owner_key(owner_key: str) -> str:
    """
    Hashes a browser's owner key for storing, so the table never holds a usable key.

    Args:
        owner_key: The browser's secret key.

    Returns:
        str: sha256 hex digest.
    """
    return hashlib.sha256(owner_key.encode()).hexdigest()


def claim_nickname(db: Session, nickname: str, owner_key: str) -> None:
    """
    Makes sure this browser may chat as this name in the current live session, claiming
    it if nobody has yet this session. Claims from earlier sessions are cleared out along
    the way. Changes are added to the db session and saved with the message's commit.

    Args:
        db: Database session.
        nickname: The name, already trimmed.
        owner_key: The sending browser's secret key.

    Raises:
        HTTPException: 403 if another browser holds the name this session (ignoring case).
    """
    session_started_at = watcher.started_at
    if session_started_at is None:
        # icecast gave no readable start time, so there's no session to hold names in
        logger.warning("dj chat: no session start time from icecast, not checking chat names")
        return
    db.query(DjChatName).filter(DjChatName.session_started_at != session_started_at).delete()
    name_key = nickname.lower()
    key_hash = hash_owner_key(owner_key)
    claim = (
        db.query(DjChatName)
        .filter(DjChatName.session_started_at == session_started_at, DjChatName.name_key == name_key)
        .first()
    )
    if claim is None:
        db.add(DjChatName(session_started_at=session_started_at, name_key=name_key, owner_key_hash=key_hash, created_at=utc_now()))
        return
    if claim.owner_key_hash != key_hash:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"someone else is already chatting as {nickname} this set -- pick another name",
        )


@router.get("", response_model=list[DjChatMessageRead])
async def list_messages(db: Session = Depends(get_db)) -> list[DjChatMessage]:
    """
    The room's recent chat, oldest first. Cheap enough to poll every few seconds.

    Args:
        db: Database session.

    Returns:
        list[DjChatMessage]: The latest MAX_CHAT_MESSAGES from the last CHAT_HISTORY_WINDOW.
    """
    latest = (
        db.query(DjChatMessage)
        .filter(DjChatMessage.created_at >= utc_now() - CHAT_HISTORY_WINDOW)
        .order_by(DjChatMessage.id.desc())
        .limit(MAX_CHAT_MESSAGES)
        .all()
    )
    return list(reversed(latest))


@router.post("", response_model=DjChatMessageRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(CHAT_SEND_RATE_LIMIT)
async def send_message(request: Request, message: DjChatMessageCreate, db: Session = Depends(get_db)) -> DjChatMessage:
    """
    Sends a chat message to the room. Only while the stream's live.

    Args:
        request: Incoming request (the rate limiter keys on its IP).
        message: Nickname and message, already trimmed onto one line.
        db: Database session.

    Returns:
        DjChatMessage: The stored message, with its id and time.

    Raises:
        HTTPException: 409 when the stream's off air, 403 when the name belongs to another
            browser, 429 past the rate limit.
    """
    if not watcher.live:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="the chat's closed while the stream's off air -- it opens when the next set starts",
        )
    claim_nickname(db, message.nickname, message.owner_key)
    row = DjChatMessage(nickname=message.nickname, content=message.content, created_at=utc_now())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_message(message_id: int, db: Session = Depends(get_db)) -> None:
    """
    Deletes a chat message (admin only). It disappears for everyone on their next poll.

    Args:
        message_id: The message's id.
        db: Database session.

    Raises:
        HTTPException: 401 without a valid admin token, 404 if there's no such message.
    """
    row = db.get(DjChatMessage, message_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"no chat message with id {message_id}")
    db.delete(row)
    db.commit()
    logger.info(f"dj chat: deleted message {message_id} from {row.nickname!r}")
