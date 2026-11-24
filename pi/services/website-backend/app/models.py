"""
SQLAlchemy database models.

Defines database schema for users, Public Square posts/comments/votes,
galleries, photos, recipes, kiln readings, firings and their notes and photos,
the house fly kill count, recorded dj sets and their cover images, the live room chat and who holds
each chat name this session, and who wants an email when the stream goes live.
"""

from sqlalchemy import Boolean, Column, Float, Integer, String, Table, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from app.schemas import MAX_DJ_CHAT_MESSAGE_LENGTH, MAX_DJ_CHAT_NICKNAME_LENGTH, MAX_EMAIL_LENGTH


class User(Base):
    """
    User model for authentication and profile.

    In practice the only account that ever gets created is the single site
    admin (see auth.py) -- Public Square posts/comments are anonymous and
    don't link back to this table.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Custom fields
    username = Column(String(50), unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Post(Base):
    """
    Post model representing a Public Square forum thread.

    Anonymous by design -- no author FK. Anyone can post; an optional
    free-text nickname is stored for display only (not verified, not
    unique).

    Attributes:
        id: Unique identifier
        title: Post title
        content: Post body content
        nickname: Optional free-text display name chosen by the poster
        score: Denormalized net vote count (upvotes minus downvotes), kept
            in sync by the public_square router whenever a PostVote changes
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
        is_published: Whether post is visible to public
    """
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    content = Column(Text, nullable=False)
    nickname = Column(String(50), nullable=True)
    score = Column(Integer, default=0, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_published = Column(Boolean, default=True, nullable=False)

    # Relationships
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    votes = relationship("PostVote", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    """
    Comment model representing a reply to a Public Square post.

    Flat/top-level only in v1 -- comments reply to a post, not to each
    other. Anonymous by design, same as Post.

    Attributes:
        id: Unique identifier
        content: Comment text
        post_id: Foreign key to Post
        nickname: Optional free-text display name chosen by the commenter
        score: Denormalized net vote count, kept in sync by the
            public_square router whenever a CommentVote changes
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    nickname = Column(String(50), nullable=True)
    score = Column(Integer, default=0, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    post = relationship("Post", back_populates="comments")
    votes = relationship("CommentVote", back_populates="comment", cascade="all, delete-orphan")


class PostVote(Base):
    """
    One anonymous vote on a Post, keyed by hashed visitor IP.

    Raw IPs are never stored -- ip_hash is sha256(ip + IP_HASH_SALT). The
    unique constraint on (post_id, ip_hash) is what makes one IP = one vote
    per post, and lets the router detect "voting again" as a toggle/flip
    instead of a duplicate.

    Attributes:
        id: Unique identifier
        post_id: Foreign key to Post
        ip_hash: Hashed visitor IP this vote belongs to
        value: 1 for upvote, -1 for downvote
        created_at: Timestamp of the (most recent) vote
    """
    __tablename__ = "post_votes"
    __table_args__ = (UniqueConstraint("post_id", "ip_hash", name="uq_post_votes_post_ip"),)

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    ip_hash = Column(String(64), nullable=False, index=True)
    value = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    post = relationship("Post", back_populates="votes")


class CommentVote(Base):
    """
    One anonymous vote on a Comment, keyed by hashed visitor IP.

    Same shape and semantics as PostVote -- see that docstring for details
    on the IP hashing and unique-constraint-based toggle behavior.

    Attributes:
        id: Unique identifier
        comment_id: Foreign key to Comment
        ip_hash: Hashed visitor IP this vote belongs to
        value: 1 for upvote, -1 for downvote
        created_at: Timestamp of the (most recent) vote
    """
    __tablename__ = "comment_votes"
    __table_args__ = (UniqueConstraint("comment_id", "ip_hash", name="uq_comment_votes_comment_ip"),)

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("comments.id"), nullable=False, index=True)
    ip_hash = Column(String(64), nullable=False, index=True)
    value = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    comment = relationship("Comment", back_populates="votes")


class Gallery(Base):
    """
    Gallery model representing a photo album or collection.
    
    Attributes:
        id: Unique identifier
        name: Gallery name
        description: Gallery description
        slug: URL-friendly identifier
        is_public: Whether gallery is visible to public
        display_order: Sort order — higher values shown first; new galleries auto-get max+10
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    __tablename__ = "galleries"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    is_public = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    photos = relationship("GalleryPhoto", back_populates="gallery", cascade="all, delete-orphan")


class GalleryPhoto(Base):
    """
    GalleryPhoto model representing a photo within a gallery.
    
    Attributes:
        id: Unique identifier
        gallery_id: Foreign key to Gallery
        filename: Original uploaded filename
        file_path: Path to stored file on disk
        thumbnail_path: Path to thumbnail file
        title: Photo title
        description: Photo description
        width: Image width in pixels
        height: Image height in pixels
        file_size: File size in bytes
        mime_type: File MIME type
        display_order: Order of photo in gallery
        created_at: Timestamp of upload
    """
    __tablename__ = "gallery_photos"
    
    id = Column(Integer, primary_key=True, index=True)
    gallery_id = Column(Integer, ForeignKey("galleries.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    title = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    gallery = relationship("Gallery", back_populates="photos")


class EventRsvp(Base):
    """
    RSVP submission for an event.

    Captures one contact (phone or email), how many friends they're bringing,
    and which follow-ups they opted into. Public-facing form writes these;
    admin panel reads them back.

    Attributes:
        id: Unique identifier
        event_slug: Slug of the event this RSVP is for (matches frontend EVENTS data)
        name: Optional name they provided
        contact_type: Either "phone" or "email" — tells you how to reach them
        contact_value: The phone number or email address itself
        friends_count: How many extra people they're bringing (0 = just them)
        wants_address: They want the exact address sent the day before
        wants_reminder: They're ok getting a reminder a week or two ahead
        created_at: Timestamp of submission
    """
    __tablename__ = "event_rsvps"

    id = Column(Integer, primary_key=True, index=True)
    event_slug = Column(String(200), nullable=False, index=True)
    name = Column(String(200), nullable=True)
    contact_type = Column(String(10), nullable=False)
    contact_value = Column(String(255), nullable=False)
    friends_count = Column(Integer, default=0, nullable=False)
    wants_address = Column(Boolean, default=False, nullable=False)
    wants_reminder = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Video(Base):
    """
    Video model representing a hosted video file.
    
    Attributes:
        id: Unique identifier
        filename: Original uploaded filename
        file_path: Path to stored video file on disk
        thumbnail_path: Path to video thumbnail/poster image
        title: Video title
        description: Video description
        width: Video width in pixels
        height: Video height in pixels
        duration: Video duration in seconds
        file_size: File size in bytes
        mime_type: Video MIME type (e.g., video/mp4)
        is_public: Whether video is publicly accessible
        slug: URL-friendly identifier for the video
        created_at: Timestamp of upload
    """
    __tablename__ = "videos"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# Many-to-many join between recipes and tags. A plain association table (no
# extra columns needed) rather than a mapped class, per SQLAlchemy convention.
recipe_tags = Table(
    "recipe_tags",
    Base.metadata,
    Column("recipe_id", Integer, ForeignKey("recipes.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


class Recipe(Base):
    """
    Recipe model for The Kitchen recipe box.

    Submitted from the public "add a recipe" form -- every field but the
    id/timestamps is optional, since the form is meant to be filled out
    quickly from a phone. Anonymous by design (no author FK), same as
    Public Square posts; only admin can edit/delete via the JWT-gated
    endpoints.

    Attributes:
        id: Unique identifier
        name: Recipe name
        description: Recipe description/instructions
        link: Optional URL to an external source for the recipe
        created_at: Timestamp of submission
        updated_at: Timestamp of last edit
    """
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=True, index=True)
    description = Column(Text, nullable=True)
    link = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    photos = relationship(
        "RecipePhoto", back_populates="recipe", cascade="all, delete-orphan",
        order_by="RecipePhoto.display_order",
    )
    tags = relationship("Tag", secondary=recipe_tags, back_populates="recipes")


class Tag(Base):
    """
    Freeform tag usable across recipes (e.g. "breakfast", "quick", "vegan").

    Created on the fly when a recipe is submitted with a tag name that
    doesn't exist yet -- see recipes.py's `_get_or_create_tags`.

    Attributes:
        id: Unique identifier
        name: Tag label, unique (case-insensitive matching handled by the router)
        created_at: Timestamp the tag was first created
    """
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    recipes = relationship("Recipe", secondary=recipe_tags, back_populates="tags")


class RecipePhoto(Base):
    """
    RecipePhoto model representing a photo attached to a recipe.

    Same shape as GalleryPhoto -- see that model's docstring for field
    semantics. Stored under settings.RECIPE_PHOTOS_DIR instead of
    settings.PHOTOS_DIR so recipe photos don't mix into the gallery's
    directory tree.

    Attributes:
        id: Unique identifier
        recipe_id: Foreign key to Recipe
        filename: Original uploaded filename
        file_path: Path to stored file on disk (relative to RECIPE_PHOTOS_DIR)
        thumbnail_path: Path to thumbnail file (relative to RECIPE_PHOTOS_DIR)
        width: Image width in pixels
        height: Image height in pixels
        file_size: File size in bytes
        mime_type: File MIME type
        display_order: Order of photo within the recipe
        created_at: Timestamp of upload
    """
    __tablename__ = "recipe_photos"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    recipe = relationship("Recipe", back_populates="photos")


class KilnReading(Base):
    """
    KilnReading model: one temperature reading from the kiln logger on castpi.

    boot_id + seq identify a reading, so a retried batch can't store it twice.

    Attributes:
        id: Unique identifier
        boot_id: The logger Pi's boot id when it took the reading
        seq: The reading's number within that boot
        recorded_at: When it was taken, naive UTC, worked out by the backend from the
            reading's age because the logger Pi has no real-time clock
        thermocouple_c: Kiln temperature, null when the amp reports a fault
        cold_junction_c: The amp's own temperature
        fault_status: The amp's raw fault register, 0 means no fault
    """
    __tablename__ = "kiln_readings"
    __table_args__ = (UniqueConstraint("boot_id", "seq", name="uq_kiln_readings_boot_seq"),)

    id = Column(Integer, primary_key=True, index=True)
    boot_id = Column(String(36), nullable=False)
    seq = Column(Integer, nullable=False)
    recorded_at = Column(DateTime, nullable=False, index=True)
    thermocouple_c = Column(Float, nullable=True)
    cold_junction_c = Column(Float, nullable=False)
    fault_status = Column(Integer, nullable=False)


class KilnFiring(Base):
    """
    KilnFiring model: one firing, as a time range plus a summary.

    Detected automatically from readings (see app/kiln_firings.py). The curve itself comes
    from the kiln_readings in this time range. All times are naive UTC.

    Attributes:
        id: Unique identifier
        started_at: The first reading above the start temperature
        ended_at: When it finished, null while in progress
        last_reading_at: The newest reading with a temperature so far
        peak_c: The hottest reading
        peak_at: When that was
    """
    __tablename__ = "kiln_firings"

    id = Column(Integer, primary_key=True, index=True)
    started_at = Column(DateTime, nullable=False, index=True)
    ended_at = Column(DateTime, nullable=True, index=True)
    last_reading_at = Column(DateTime, nullable=False)
    peak_c = Column(Float, nullable=False)
    peak_at = Column(DateTime, nullable=False)


class KilnEditor(Base):
    """
    KilnEditor model: a login that can only write kiln notes and photos (Jude's).

    Kept out of the users table so a kiln login can never be mistaken for the admin
    account. These logins get tokens with the "kiln" scope, which require_admin turns
    away (see app/dependencies.py). Created with scripts/create_kiln_editor.py.

    Attributes:
        id: Unique identifier
        username: What they log in with
        hashed_password: bcrypt hash, never the password itself
        created_at: When the login was made
    """
    __tablename__ = "kiln_editors"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class KilnNote(Base):
    """
    KilnNote model: a note on a firing, either about the whole firing or pinned to a moment.

    Attributes:
        id: Unique identifier
        firing_id: The firing it's about
        body: The note's text
        noted_at: The moment in the firing it's pinned to, naive UTC. Null for a general note
        is_public: Whether people who aren't logged in can see it
        created_at: When it was written
        updated_at: When it was last changed
    """
    __tablename__ = "kiln_notes"

    id = Column(Integer, primary_key=True, index=True)
    firing_id = Column(Integer, ForeignKey("kiln_firings.id"), nullable=False, index=True)
    body = Column(Text, nullable=False)
    noted_at = Column(DateTime, nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class KilnPhoto(Base):
    """
    KilnPhoto model: a photo of what came out of a firing.

    Files live under settings.KILN_PHOTOS_DIR, in a folder per firing.

    Attributes:
        id: Unique identifier
        firing_id: The firing it's from
        filename: The uploaded file's original name
        file_path: Path to the image, relative to KILN_PHOTOS_DIR
        thumbnail_path: Path to its thumbnail, null if making one failed
        width: Width in pixels
        height: Height in pixels
        file_size: Size in bytes
        mime_type: Its content type, like image/jpeg
        is_public: Whether people who aren't logged in can see it
        created_at: When it was uploaded
    """
    __tablename__ = "kiln_photos"

    id = Column(Integer, primary_key=True, index=True)
    firing_id = Column(Integer, ForeignKey("kiln_firings.id"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class FlyKill(Base):
    """
    FlyKill model: one fly someone in the house killed.

    A person's count is how many rows they have, and taking one back deletes their
    newest row, so the table doubles as a log of when each fly went down.

    Attributes:
        id: Unique identifier
        killer: Who got it, one of FLY_KILLERS in schemas.py
        killed_at: When it was logged
    """
    __tablename__ = "fly_kills"

    id = Column(Integer, primary_key=True, index=True)
    killer = Column(String(32), nullable=False, index=True)
    killed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DjSet(Base):
    """
    DjSet model: one recorded session from the live dj stream.

    The recorder (app/dj_stream.py) adds the row when a session starts and fills in
    ended_at when it stops, so a row with no ended_at is still being recorded. Too-short
    sessions are deleted instead of finished. All times are naive UTC.

    Attributes:
        id: Unique identifier
        title: Optional name set from the admin page; the site shows the date without one
        description: Optional notes set from the admin page (tracklist, vibe, whatever)
        started_at: When the recording started
        ended_at: When it stopped, null while recording
        duration_s: Length in seconds, null while recording
        size_bytes: File size, null while recording
        file_path: The mp3, as a container path under DJ_SETS_DIR
        image: Its cover image (DjSetImage), None until one's uploaded
    """
    __tablename__ = "dj_sets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=False, index=True)
    ended_at = Column(DateTime, nullable=True)
    duration_s = Column(Integer, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    file_path = Column(String(500), nullable=False)

    image = relationship("DjSetImage", uselist=False, cascade="all, delete-orphan")

    @property
    def image_id(self) -> int | None:
        """the cover image's id, or None. it changes with every upload, so it doubles as a cache buster."""
        return self.image.id if self.image else None


class DjSetImage(Base):
    """
    DjSetImage model: a recorded set's cover image, uploaded from the admin page.

    Its own table rather than columns on dj_sets, since create_all makes new tables on
    startup but never adds columns to existing ones. One per set: uploading another
    replaces it (new row, new id). Files live under DJ_SETS_DIR/images, a folder per set.

    Attributes:
        id: Unique identifier, new for every upload
        set_id: The set it's the cover of
        file_path: The image, relative to the images folder
        thumbnail_path: Its thumbnail, null if making one failed
        width: Width in pixels
        height: Height in pixels
        mime_type: Its content type, like image/jpeg
        created_at: When it was uploaded
    """
    __tablename__ = "dj_set_images"
    # the site caches an image by its id for good, so an id must never come back. plain
    # sqlite rowids reuse the top one after it's deleted, which replacing an image does
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True, index=True)
    set_id = Column(Integer, ForeignKey("dj_sets.id"), nullable=False, unique=True, index=True)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DjChatMessage(Base):
    """
    DjChatMessage model: one message in the opium den's live room chat.

    Anonymous like the public square: a nickname the chatter picks, no account. Messages
    can only be sent while the stream's live (routers/dj_chat.py). The live room reads
    back a recent window, so each session's chat reads as its own room. They're kept for
    good: a recorded set's chat is the messages sent while it was on, matched by time
    (GET /dj/sets/{id}/chat), with no column linking them. Times are naive UTC like the
    dj sets they sit next to.

    Attributes:
        id: Unique identifier, increasing, so clients poll for anything after the last one
        nickname: The display name the chatter picked
        content: The message, one line
        created_at: When it was sent
    """
    __tablename__ = "dj_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    nickname = Column(String(MAX_DJ_CHAT_NICKNAME_LENGTH), nullable=False)
    content = Column(String(MAX_DJ_CHAT_MESSAGE_LENGTH), nullable=False)
    created_at = Column(DateTime, nullable=False, index=True)


class DjAlertSubscriber(Base):
    """
    DjAlertSubscriber model: someone who wants an email when the dj stream goes live.

    Signing up only sends a confirmation email; alerts go only to confirmed rows, so
    nobody gets alerts for an address someone else typed in. The admin sends each alert
    by hand from the admin page (routers/dj_alerts.py), nothing goes out automatically.
    Unsubscribing deletes the row. Times are naive UTC.

    Attributes:
        id: Unique identifier
        email: The address, lowercased
        token: Random secret in the confirm and unsubscribe links
        created_at: When they first signed up
        confirm_sent_at: When the last confirmation email went out
        confirmed_at: When they clicked the confirmation link, null until then
    """
    __tablename__ = "dj_alert_subscribers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(MAX_EMAIL_LENGTH), unique=True, index=True, nullable=False)
    token = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, nullable=False)
    confirm_sent_at = Column(DateTime, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)


class DjChatName(Base):
    """
    DjChatName model: a live room chat name, held by one browser for one live session.

    The first message sent with a name during a session claims it for that browser's
    secret key; for the rest of that session only that key can send as it
    (routers/dj_chat.py). The next session starts with every name free, and the old
    session's claims are deleted then. Names match ignoring case, so "KYLE" can't pass
    for "kyle". Only a hash of the key is stored.

    Attributes:
        id: Unique identifier
        session_started_at: When the live session the claim belongs to started (the
            stream watcher's started_at), naive UTC
        name_key: The name lowercased, what matching is done on
        owner_key_hash: sha256 hex of the owning browser's key
        created_at: When it was claimed, naive UTC
    """
    __tablename__ = "dj_chat_names"
    __table_args__ = (UniqueConstraint("session_started_at", "name_key", name="uq_dj_chat_names_session_name"),)

    id = Column(Integer, primary_key=True, index=True)
    session_started_at = Column(DateTime, nullable=False, index=True)
    name_key = Column(String(MAX_DJ_CHAT_NICKNAME_LENGTH), nullable=False)
    owner_key_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, nullable=False)


class DjRoomVisit(Base):
    """
    DjRoomVisit model: someone being in the opium den's live room during a live set, so
    the set's page can show who was there as it replays.

    One row from when a browser comes into the room (or changes its name) until it leaves
    or stops checking in; last_seen_at moves along with each check-in
    (routers/dj_room.py). Like the chat, visits aren't linked to a set: a set's visitors
    are the visits overlapping its time (GET /dj/sets/{id}/people). Times are naive UTC.

    Attributes:
        id: Unique identifier
        nickname: Their chat name
        avatar: Their character number in the room, 0 up
        joined_at: When they came in
        last_seen_at: Their latest check-in, or when they left
    """
    __tablename__ = "dj_room_visits"

    id = Column(Integer, primary_key=True, index=True)
    nickname = Column(String(MAX_DJ_CHAT_NICKNAME_LENGTH), nullable=False)
    avatar = Column(Integer, nullable=False)
    joined_at = Column(DateTime, nullable=False, index=True)
    last_seen_at = Column(DateTime, nullable=False, index=True)
