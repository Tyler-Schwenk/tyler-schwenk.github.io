"""
Event RSVP router.

Public endpoint lets people RSVP to an event with a phone or email and a few
preferences. Admin endpoints read and delete those submissions for the panel.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models import EventRsvp
from app.rate_limit import limiter
from app.schemas import RsvpCreate, RsvpRead

router = APIRouter(prefix="/events/rsvp", tags=["Event RSVPs"])

# public, unauthenticated write — cap per IP so it can't be spammed. the short
# window stops rapid-fire submits; the hourly cap stops slow drip flooding.
RSVP_CREATE_RATE_LIMIT = "5/minute;30/hour"


@router.post("", response_model=RsvpRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(RSVP_CREATE_RATE_LIMIT)
async def create_rsvp(request: Request, rsvp: RsvpCreate, db: Session = Depends(get_db)):
    """
    Record an RSVP submitted from the public event page.

    No auth — anyone can RSVP, so it's rate limited per IP (see
    RSVP_CREATE_RATE_LIMIT). The contact value is cross-checked against the
    chosen contact type here since pydantic validates fields in isolation.

    Args:
        request: Incoming request (required by the rate limiter for the client IP).
        rsvp: Submitted RSVP data.
        db: Database session.

    Returns:
        The stored RSVP record.

    Raises:
        HTTPException: 422 if the contact value doesn't match its type.
        HTTPException: 429 if the per-IP rate limit is exceeded.
    """
    try:
        rsvp.validate_contact()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    db_rsvp = EventRsvp(
        event_slug=rsvp.event_slug,
        contact_type=rsvp.contact_type,
        contact_value=rsvp.contact_value,
        friends_count=rsvp.friends_count,
        wants_address=rsvp.wants_address,
        wants_reminder=rsvp.wants_reminder,
    )
    db.add(db_rsvp)
    db.commit()
    db.refresh(db_rsvp)
    return db_rsvp


@router.get("", response_model=List[RsvpRead])
async def list_rsvps(
    event_slug: Optional[str] = None,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    List RSVPs, newest first, optionally filtered to one event.

    Admin only.

    Args:
        event_slug: If given, only return RSVPs for this event.
        db: Database session.

    Returns:
        List of RSVP records.
    """
    query = db.query(EventRsvp)
    if event_slug:
        query = query.filter(EventRsvp.event_slug == event_slug)
    return query.order_by(EventRsvp.created_at.desc()).all()


@router.delete("/{rsvp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rsvp(
    rsvp_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Delete a single RSVP.

    Admin only — handy for clearing out test or duplicate submissions.

    Args:
        rsvp_id: ID of the RSVP to delete.
        db: Database session.

    Raises:
        HTTPException: 404 if no RSVP with that id exists.
    """
    db_rsvp = db.query(EventRsvp).filter(EventRsvp.id == rsvp_id).first()
    if not db_rsvp:
        raise HTTPException(status_code=404, detail="RSVP not found")
    db.delete(db_rsvp)
    db.commit()
