"""
DJ room router -- who's in the opium den's live room during a live set.

The live room shows a little character for everyone in it, standing under the set's
loudness trace with their chat name over their head. It's only open while the stream's
live. A browser picks a name to come in, then checks in with it every few seconds
(POST /dj/room) and gets the room back; anyone who stops checking in drops out
(app/dj_room.py). Coming in also claims the name for the set the same way sending a chat
message does, so nobody can take it out from under you before you've said anything.

Every stay is saved as a visit (dj_room_visits), so a recorded set's page can show who was
in the room at each point as it replays (GET /dj/sets/{id}/people, routers/dj.py).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dj_room import CheckIn, RoomFullError, RoomNameTakenError, live_room
from app.dj_stream import watcher
from app.models import DjRoomVisit
from app.rate_limit import limiter
from app.routers.dj_chat import claim_nickname, utc_now
from app.schemas import DjRoom, DjRoomCheckIn, DjRoomLeave, DjRoomPerson

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dj/room", tags=["DJ"])

# per visitor IP. a check-in every 15 s is 4 a minute, so this leaves room for a few
# people on one network and name changes, not for hammering the pi
ROOM_CHECK_IN_RATE_LIMIT = "30/minute"


def current_room() -> DjRoom:
    """
    The room as the page shows it.

    Returns:
        DjRoom: Everyone in it, in arrival order.
    """
    return DjRoom(people=[DjRoomPerson(nickname=person.nickname, avatar=person.avatar) for person in live_room.people()])


def record_visit(db: Session, check_in: CheckIn) -> None:
    """
    Saves a check-in to the person's visit: a new row when they've just come in or changed
    their name, otherwise their visit's last_seen_at moves up to now. Commits.

    Args:
        db: Database session.
        check_in: What the check-in did.

    Side effects:
        Inserts or updates a dj_room_visits row, and sets the person's visit_id on a new one.
    """
    now = utc_now()
    person = check_in.person
    visit = None if check_in.new_visit or person.visit_id is None else db.get(DjRoomVisit, person.visit_id)
    if visit is None:
        visit = DjRoomVisit(nickname=person.nickname, avatar=person.avatar, joined_at=now, last_seen_at=now)
        db.add(visit)
        db.commit()
        person.visit_id = visit.id
        return
    visit.last_seen_at = now
    db.commit()


@router.post("", response_model=DjRoom)
@limiter.limit(ROOM_CHECK_IN_RATE_LIMIT)
async def check_in(request: Request, check_in: DjRoomCheckIn, db: Session = Depends(get_db)) -> DjRoom:
    """
    Puts this browser in the room under its name (or keeps it there), saves it to their
    visit, and returns the room.

    Args:
        request: Incoming request (the rate limiter keys on its IP).
        check_in: The chat name and the browser's owner key.
        db: Database session, for claiming the name and saving the visit.

    Returns:
        DjRoom: Everyone in the room, this browser included.

    Raises:
        HTTPException: 409 off air, 403 when someone else has the name (in the room, or
            this set's chat), 503 when the room's full, 429 past the rate limit.
    """
    if not watcher.live:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="the room's closed while the stream's off air -- it opens when the next set starts",
        )
    claim_nickname(db, check_in.nickname, check_in.owner_key)
    db.commit()
    try:
        result = live_room.check_in(check_in.nickname, check_in.owner_key)
    except RoomNameTakenError as err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"someone in the room is already called {check_in.nickname} -- pick another name",
        ) from err
    except RoomFullError as err:
        logger.warning("dj room: full, turned someone away")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="the room's full right now -- you can still listen from the live section",
        ) from err
    record_visit(db, result)
    return current_room()


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave(leave: DjRoomLeave, db: Session = Depends(get_db)) -> None:
    """
    Takes this browser out of the room right away, for when the page closes, instead of
    waiting for its check-ins to time out. Their visit ends now.

    Args:
        leave: The browser's owner key.
        db: Database session, for ending the visit.
    """
    person = live_room.leave(leave.owner_key)
    if person is None or person.visit_id is None:
        return
    visit = db.get(DjRoomVisit, person.visit_id)
    if visit is not None:
        visit.last_seen_at = utc_now()
        db.commit()
