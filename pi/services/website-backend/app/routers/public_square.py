"""
Public Square router.

Anonymous reddit-like forum: anyone can create posts/comments and vote on
them, no login required. Votes are deduped per post/comment by hashed
visitor IP (see hash_ip) instead of accounts. Admin (JWT, via
require_admin) can hard-delete posts/comments as a moderation kill switch.
"""

import hashlib
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import require_admin
from app.models import Comment, CommentVote, Post, PostVote
from app.rate_limit import get_client_ip, limiter
from app.schemas import (
    CommentCreate,
    CommentRead,
    PostCreate,
    PostList,
    PostRead,
    PostSortLiteral,
    VoteRequest,
    VoteResult,
)

router = APIRouter(prefix="/public-square", tags=["Public Square"])

# public, unauthenticated writes -- capped per IP the same way event RSVPs
# are (see rsvp.py). loose on purpose: the site expects little traffic, and
# these are meant to be tightened later only if abuse actually shows up.
POST_CREATE_RATE_LIMIT = "5/hour"
COMMENT_CREATE_RATE_LIMIT = "20/hour"
VOTE_RATE_LIMIT = "60/minute"

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def hash_ip(ip: str) -> str:
    """
    Hash a visitor IP for anonymous vote/spam dedup.

    Raw IPs are never stored -- only this salted hash. The salt keeps the
    hash from being reversible via a precomputed table of common IPs.

    Args:
        ip: Client IP address, as resolved by get_client_ip.

    Returns:
        Hex-encoded sha256 digest of the salted IP.
    """
    return hashlib.sha256(f"{ip}{settings.IP_HASH_SALT}".encode()).hexdigest()


def _apply_vote(db: Session, vote_model, filter_kwargs: dict, target, value: int) -> VoteResult:
    """
    Create, flip, or retract a vote, keeping the target's denormalized score in sync.

    Voting the same direction again retracts the vote (back to neutral);
    voting the opposite direction flips it. Shared between post and
    comment voting so this logic only lives in one place.

    Args:
        vote_model: PostVote or CommentVote.
        filter_kwargs: Columns identifying this visitor's existing vote row, e.g. {"post_id": 1, "ip_hash": "..."}.
        target: The Post or Comment being voted on (its .score is updated in place).
        value: 1 for upvote, -1 for downvote.

    Returns:
        VoteResult with the updated score and this visitor's new vote state.
    """
    existing = db.query(vote_model).filter_by(**filter_kwargs).first()

    if existing is None:
        db.add(vote_model(**filter_kwargs, value=value))
        target.score += value
        your_vote = value
    elif existing.value == value:
        db.delete(existing)
        target.score -= value
        your_vote = 0
    else:
        target.score += value - existing.value
        existing.value = value
        your_vote = value

    db.commit()
    db.refresh(target)
    return VoteResult(score=target.score, your_vote=your_vote)


def _get_post_or_404(db: Session, post_id: int) -> Post:
    """Fetch a post by id or raise 404."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


def _attach_comment_counts(db: Session, posts: list[Post]) -> None:
    """
    Set a non-persisted `comment_count` on each post so PostRead can include it.

    Uses one grouped COUNT query for the whole batch (not one per post) to avoid
    an N+1, then stamps each post; posts with no comments get 0. `comment_count`
    isn't a mapped column -- it's a plain instance attribute the response schema
    reads via from_attributes.

    Args:
        db: Database session.
        posts: Posts to annotate in place.
    """
    if not posts:
        return
    counts = dict(
        db.query(Comment.post_id, func.count(Comment.id))
        .filter(Comment.post_id.in_([p.id for p in posts]))
        .group_by(Comment.post_id)
        .all()
    )
    for post in posts:
        post.comment_count = counts.get(post.id, 0)


def _get_comment_or_404(db: Session, comment_id: int) -> Comment:
    """Fetch a comment by id or raise 404."""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


# Post endpoints
@router.get("/posts", response_model=PostList)
async def list_posts(
    sort: PostSortLiteral = "top",
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    db: Session = Depends(get_db),
):
    """
    List published posts, sorted by top score or most recent.

    Args:
        sort: "top" (score desc, then newest) or "new" (newest first).
        page: 1-indexed page number.
        page_size: Posts per page, capped at MAX_PAGE_SIZE.
        db: Database session.

    Returns:
        A page of posts plus pagination metadata.
    """
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

    query = db.query(Post).filter(Post.is_published == True)
    if sort == "top":
        query = query.order_by(Post.score.desc(), Post.created_at.desc())
    else:
        query = query.order_by(Post.created_at.desc())

    total = query.count()
    posts = query.offset((page - 1) * page_size).limit(page_size).all()
    _attach_comment_counts(db, posts)
    total_pages = (total + page_size - 1) // page_size if total else 0

    return PostList(posts=posts, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/posts/{post_id}", response_model=PostRead)
async def get_post(post_id: int, db: Session = Depends(get_db)):
    """
    Get a single post by id.

    Args:
        post_id: Post ID.
        db: Database session.

    Returns:
        The post.

    Raises:
        HTTPException: 404 if no post with that id exists.
    """
    post = _get_post_or_404(db, post_id)
    _attach_comment_counts(db, [post])
    return post


@router.post("/posts", response_model=PostRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(POST_CREATE_RATE_LIMIT)
async def create_post(request: Request, post: PostCreate, db: Session = Depends(get_db)):
    """
    Create a new post.

    No auth -- anyone can post, so it's rate limited per IP (see
    POST_CREATE_RATE_LIMIT).

    Args:
        request: Incoming request (required by the rate limiter for the client IP).
        post: Submitted post data.
        db: Database session.

    Returns:
        The created post.
    """
    db_post = Post(title=post.title, content=post.content, nickname=post.nickname)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    db_post.comment_count = 0  # brand new post, nothing to count yet
    return db_post


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Delete a post and its comments/votes.

    Admin only -- moderation kill switch for spam/abuse.

    Args:
        post_id: Post ID.
        db: Database session.

    Raises:
        HTTPException: 404 if no post with that id exists.
    """
    db_post = _get_post_or_404(db, post_id)
    db.delete(db_post)
    db.commit()


# Comment endpoints
@router.get("/posts/{post_id}/comments", response_model=List[CommentRead])
async def list_comments(
    post_id: int,
    sort: PostSortLiteral = "top",
    db: Session = Depends(get_db),
):
    """
    List a post's comments, flat (no nested replies), sorted by top score or most recent.

    Args:
        post_id: Post ID.
        sort: "top" (score desc, then newest) or "new" (newest first).
        db: Database session.

    Returns:
        The post's comments.

    Raises:
        HTTPException: 404 if no post with that id exists.
    """
    _get_post_or_404(db, post_id)

    query = db.query(Comment).filter(Comment.post_id == post_id)
    if sort == "top":
        query = query.order_by(Comment.score.desc(), Comment.created_at.desc())
    else:
        query = query.order_by(Comment.created_at.desc())
    return query.all()


@router.post("/posts/{post_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(COMMENT_CREATE_RATE_LIMIT)
async def create_comment(request: Request, post_id: int, comment: CommentCreate, db: Session = Depends(get_db)):
    """
    Add a comment to a post.

    No auth -- anyone can comment, so it's rate limited per IP (see
    COMMENT_CREATE_RATE_LIMIT).

    Args:
        request: Incoming request (required by the rate limiter for the client IP).
        post_id: Post ID being commented on.
        comment: Submitted comment data.
        db: Database session.

    Returns:
        The created comment.

    Raises:
        HTTPException: 404 if no post with that id exists.
    """
    _get_post_or_404(db, post_id)

    db_comment = Comment(post_id=post_id, content=comment.content, nickname=comment.nickname)
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Delete a comment and its votes.

    Admin only -- moderation kill switch for spam/abuse.

    Args:
        comment_id: Comment ID.
        db: Database session.

    Raises:
        HTTPException: 404 if no comment with that id exists.
    """
    db_comment = _get_comment_or_404(db, comment_id)
    db.delete(db_comment)
    db.commit()


# Vote endpoints
@router.post("/posts/{post_id}/vote", response_model=VoteResult)
@limiter.limit(VOTE_RATE_LIMIT)
async def vote_on_post(request: Request, post_id: int, vote: VoteRequest, db: Session = Depends(get_db)):
    """
    Cast, flip, or retract a vote on a post.

    No auth -- votes are deduped per post by hashed visitor IP (see
    hash_ip), not accounts. Voting the same direction again retracts the
    vote; voting the opposite direction flips it.

    Args:
        request: Incoming request (used for both the rate limiter and the client IP to hash).
        post_id: Post ID being voted on.
        vote: The requested vote direction.
        db: Database session.

    Returns:
        The updated score and this visitor's new vote state.

    Raises:
        HTTPException: 404 if no post with that id exists.
    """
    post = _get_post_or_404(db, post_id)
    ip_hash = hash_ip(get_client_ip(request))
    return _apply_vote(db, PostVote, {"post_id": post_id, "ip_hash": ip_hash}, post, vote.value)


@router.post("/comments/{comment_id}/vote", response_model=VoteResult)
@limiter.limit(VOTE_RATE_LIMIT)
async def vote_on_comment(request: Request, comment_id: int, vote: VoteRequest, db: Session = Depends(get_db)):
    """
    Cast, flip, or retract a vote on a comment.

    Same semantics as vote_on_post -- see that docstring for details.

    Args:
        request: Incoming request (used for both the rate limiter and the client IP to hash).
        comment_id: Comment ID being voted on.
        vote: The requested vote direction.
        db: Database session.

    Returns:
        The updated score and this visitor's new vote state.

    Raises:
        HTTPException: 404 if no comment with that id exists.
    """
    comment = _get_comment_or_404(db, comment_id)
    ip_hash = hash_ip(get_client_ip(request))
    return _apply_vote(db, CommentVote, {"comment_id": comment_id, "ip_hash": ip_hash}, comment, vote.value)
