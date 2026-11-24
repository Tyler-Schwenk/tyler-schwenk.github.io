"""
Pydantic schemas for request/response validation.

Defines data structures for API endpoints including users, posts, comments,
galleries, and photos with comprehensive validation rules.
"""

from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from datetime import datetime, timezone
from typing import Annotated, Optional, Literal, get_args
import re


# User Schemas
class UserRead(BaseModel):
    """User data returned in API responses."""
    id: int
    email: str
    username: Optional[str] = None
    is_active: bool
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Public Square Schemas
#
# Posts and comments are anonymous -- there's no author FK, just an
# optional free-text nickname. Length limits keep the SQLite file and the
# UI sane; they're not a security control (that's the rate limiter's job).
MAX_POST_TITLE_LENGTH = 200
MAX_POST_CONTENT_LENGTH = 10000
MAX_COMMENT_CONTENT_LENGTH = 5000
MAX_NICKNAME_LENGTH = 50


class PostBase(BaseModel):
    """Base post fields for creation."""
    title: str = Field(..., min_length=1, max_length=MAX_POST_TITLE_LENGTH, description="Post title")
    content: str = Field(..., min_length=1, max_length=MAX_POST_CONTENT_LENGTH, description="Post content")
    nickname: Optional[str] = Field(None, max_length=MAX_NICKNAME_LENGTH, description="Optional display name")


class PostCreate(PostBase):
    """Schema for creating a new post. No auth -- anyone can post."""
    pass


class PostRead(PostBase):
    """Post data returned in API responses."""
    id: int
    score: int
    comment_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


PostSortLiteral = Literal["top", "new"]


class PostList(BaseModel):
    """Paginated list of posts."""
    posts: list[PostRead]
    total: int
    page: int
    page_size: int
    total_pages: int


class CommentBase(BaseModel):
    """Base comment fields for creation."""
    content: str = Field(..., min_length=1, max_length=MAX_COMMENT_CONTENT_LENGTH, description="Comment content")
    nickname: Optional[str] = Field(None, max_length=MAX_NICKNAME_LENGTH, description="Optional display name")


class CommentCreate(CommentBase):
    """Schema for creating a new comment. No auth -- anyone can comment."""
    pass


class CommentRead(CommentBase):
    """Comment data returned in API responses."""
    id: int
    post_id: int
    score: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class VoteRequest(BaseModel):
    """Schema for casting a vote on a post or comment."""
    value: Literal[1, -1] = Field(..., description="1 to upvote, -1 to downvote")


class VoteResult(BaseModel):
    """Schema returned after a vote is applied."""
    score: int = Field(..., description="Updated net score after this vote")
    your_vote: Literal[1, -1, 0] = Field(..., description="This visitor's current vote state; 0 means no vote (retracted)")


# Gallery Schemas
class GalleryBase(BaseModel):
    """Base gallery fields for creation and updates."""
    name: str = Field(..., min_length=1, max_length=200, description="Gallery name")
    description: Optional[str] = Field(None, max_length=5000, description="Gallery description")
    slug: str = Field(..., min_length=1, max_length=200, description="URL-friendly identifier")
    is_public: bool = Field(default=True, description="Whether gallery is publicly visible")


class GalleryCreate(GalleryBase):
    """Schema for creating a new gallery."""
    pass


class GalleryUpdate(BaseModel):
    """Schema for updating an existing gallery. All fields optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    slug: Optional[str] = Field(None, min_length=1, max_length=200)
    is_public: Optional[bool] = None
    display_order: Optional[int] = None


class GalleryPhotoBase(BaseModel):
    """Base gallery photo fields."""
    title: Optional[str] = Field(None, max_length=200, description="Photo title")
    description: Optional[str] = Field(None, max_length=5000, description="Photo description")
    display_order: int = Field(default=0, description="Display order in gallery")


class GalleryPhotoCreate(GalleryPhotoBase):
    """Schema for creating a new photo (metadata only, file uploaded separately)."""
    gallery_id: int


class GalleryPhotoUpdate(BaseModel):
    """Schema for updating photo metadata."""
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    display_order: Optional[int] = None


class GalleryPhotoRead(GalleryPhotoBase):
    """Gallery photo data returned in API responses."""
    id: int
    gallery_id: int
    filename: str
    file_path: str
    thumbnail_path: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class GalleryRead(GalleryBase):
    """Gallery data returned in API responses."""
    id: int
    display_order: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    photo_count: Optional[int] = Field(None, description="Number of photos in gallery")
    
    model_config = ConfigDict(from_attributes=True)


class GalleryWithPhotos(GalleryRead):
    """Gallery with all photos included."""
    photos: list[GalleryPhotoRead] = []
    
    model_config = ConfigDict(from_attributes=True)


# Health Check Schema
class HealthCheck(BaseModel):
    """Health check response schema."""
    status: str
    version: str
    timestamp: datetime


# Mallard Count Schema
class MallardCount(BaseModel):
    """Current mallard count, proxied from the external counter API."""
    count: int


# Fly Kill Schemas

# everyone in the house, in the order the page shows them
FlyKiller = Literal["jude", "dax", "tyler", "joel"]
FLY_KILLERS: tuple[str, ...] = get_args(FlyKiller)


class FlyKillerCount(BaseModel):
    """One person's fly kills."""
    killer: FlyKiller
    kills: int


class FlyKillTally(BaseModel):
    """Everyone's fly kills, in FLY_KILLERS order, plus the size of the pile."""
    killers: list[FlyKillerCount]
    total: int


# Event RSVP Schemas

# a contact is reachable by exactly one of these
CONTACT_TYPE_PHONE = "phone"
CONTACT_TYPE_EMAIL = "email"

# phone: digits only after stripping common separators, 7-15 digits per E.164
MIN_PHONE_DIGITS = 7
MAX_PHONE_DIGITS = 15
PHONE_SEPARATORS_PATTERN = re.compile(r"[\s\-\(\)\.]")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# keep friend counts sane so the form can't be used to spam huge numbers
MAX_FRIENDS_COUNT = 50


class RsvpCreate(BaseModel):
    """Schema for submitting an RSVP from the public event page."""
    event_slug: str = Field(..., min_length=1, max_length=200, description="Event slug being RSVP'd to")
    name: Optional[str] = Field(None, max_length=200, description="Submitter's name")
    contact_type: Literal["phone", "email"] = Field(..., description="Whether contact_value is a phone or email")
    contact_value: str = Field(..., min_length=1, max_length=255, description="Phone number or email address")
    friends_count: int = Field(default=0, ge=0, le=MAX_FRIENDS_COUNT, description="Extra people they're bringing")
    wants_address: bool = Field(default=False, description="Wants the exact address sent the day before")
    wants_reminder: bool = Field(default=False, description="Ok with a reminder a week or two ahead")

    @field_validator("contact_value")
    @classmethod
    def _strip_contact(cls, v: str) -> str:
        """Trim whitespace so validation and storage use a clean value."""
        return v.strip()

    def validate_contact(self) -> None:
        """
        Check contact_value matches contact_type.

        Pydantic validates each field in isolation, so this cross-field check
        runs in the router after parsing. Raises ValueError with a fixable
        message when the value doesn't look like the chosen type.
        """
        if self.contact_type == CONTACT_TYPE_EMAIL:
            if not EMAIL_PATTERN.match(self.contact_value):
                raise ValueError("that doesn't look like a valid email — check for typos")
            return
        digits = PHONE_SEPARATORS_PATTERN.sub("", self.contact_value).lstrip("+")
        if not digits.isdigit() or not (MIN_PHONE_DIGITS <= len(digits) <= MAX_PHONE_DIGITS):
            raise ValueError("that doesn't look like a valid phone number — include the area code")


class RsvpRead(BaseModel):
    """RSVP data returned to the admin panel."""
    id: int
    event_slug: str
    name: Optional[str] = None
    contact_type: str
    contact_value: str
    friends_count: int
    wants_address: bool
    wants_reminder: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Video Schemas
class VideoBase(BaseModel):
    """Base video fields for creation and updates."""
    title: str = Field(..., min_length=1, max_length=200, description="Video title")
    description: Optional[str] = Field(None, max_length=5000, description="Video description")
    slug: str = Field(..., min_length=1, max_length=200, description="URL-friendly identifier")
    is_public: bool = Field(default=True, description="Whether video is publicly accessible")


class VideoCreate(VideoBase):
    """Schema for creating a new video."""
    pass


class VideoUpdate(BaseModel):
    """Schema for updating an existing video. All fields optional."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    slug: Optional[str] = Field(None, min_length=1, max_length=200)
    is_public: Optional[bool] = None


class VideoRead(VideoBase):
    """Video data returned in API responses."""
    id: int
    filename: str
    file_path: str
    thumbnail_path: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[int] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Recipe Schemas
#
# Recipes are submitted anonymously from a public form (no author FK, same
# pattern as Public Square) -- every field is optional so the form can be
# filled out quickly from a phone. Create is public + rate-limited; edit and
# delete require admin auth (see recipes.py).
MAX_RECIPE_NAME_LENGTH = 200
MAX_RECIPE_DESCRIPTION_LENGTH = 10000
MAX_RECIPE_LINK_LENGTH = 500
MAX_TAG_NAME_LENGTH = 50
MAX_TAGS_PER_RECIPE = 20
MAX_PHOTOS_PER_RECIPE = 12

LINK_SCHEME_PATTERN = re.compile(r"^https?://", re.IGNORECASE)


def normalize_recipe_link(link: Optional[str]) -> Optional[str]:
    """
    Clean up a recipe link so it's always a clickable, absolute URL.

    Trims whitespace and prepends `https://` if the user typed a bare
    domain (e.g. "allrecipes.com/..." instead of "https://allrecipes.com/...")
    -- otherwise it'd render as a broken relative link on the frontend.
    Used by both recipe creation (multipart form field, no pydantic model)
    and RecipeUpdate's validator below, so the behavior stays identical
    however the link was set.

    Args:
        link: Raw link text as submitted, or None.

    Returns:
        A normalized absolute URL, or None if link was empty/None.
    """
    if link is None:
        return None
    trimmed = link.strip()
    if not trimmed:
        return None
    if not LINK_SCHEME_PATTERN.match(trimmed):
        trimmed = f"https://{trimmed}"
    return trimmed


class TagRead(BaseModel):
    """Tag data returned in API responses."""
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class TagWithCount(TagRead):
    """Tag data with how many recipes currently use it, for the filter UI."""
    recipe_count: int = Field(..., description="Number of recipes tagged with this tag")


class RecipePhotoRead(BaseModel):
    """Recipe photo data returned in API responses."""
    id: int
    recipe_id: int
    filename: str
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    display_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecipeRead(BaseModel):
    """Recipe data returned in API responses, including tags and photos."""
    id: int
    name: Optional[str] = None
    description: Optional[str] = None
    link: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    tags: list[TagRead] = []
    photos: list[RecipePhotoRead] = []

    model_config = ConfigDict(from_attributes=True)


class RecipeUpdate(BaseModel):
    """
    Schema for editing an existing recipe. Admin-only.

    `tags`, when provided, is a full replacement of the recipe's tag list
    (not a merge) -- the router diffs it against the current tags.
    """
    name: Optional[str] = Field(None, max_length=MAX_RECIPE_NAME_LENGTH)
    description: Optional[str] = Field(None, max_length=MAX_RECIPE_DESCRIPTION_LENGTH)
    link: Optional[str] = Field(None, max_length=MAX_RECIPE_LINK_LENGTH)
    tags: Optional[list[str]] = Field(
        None, max_length=MAX_TAGS_PER_RECIPE, description="Full replacement tag list"
    )

    @field_validator("link")
    @classmethod
    def _normalize_link(cls, v: Optional[str]) -> Optional[str]:
        """Reuses normalize_recipe_link so edits get the same https:// prepend as creation."""
        return normalize_recipe_link(v)



# Display Kiosk Remote Control Schemas
#
# Key names must match what pi/services/surfcam-agent/kiosk_control.py accepts
# (CONTROL_KEYS, plus REMOTE_KEY_PATTERN: preset-<n> jumps to a milkdrop preset,
# preset-next/prev/hold/auto, and top-same/tempo/<n> for bpm mode's top screen),
# which is what the display page's state machine understands, plus the two bpm
# calibration nudges the agent forwards to the bpm agent instead of its log.
DISPLAY_KEY_PATTERN = (
    r"^(tab|escape|backspace|next|prev|b|[1-9]|beat-earlier|beat-later"
    r"|preset-(\d{1,4}|next|prev|hold|auto)|top-(same|tempo|[1-9]))$"
)
DisplayKey = Annotated[str, Field(pattern=DISPLAY_KEY_PATTERN)]

# one remote button sends at most a couple of keys (e.g. escape then a shortcut)
MAX_KEYS_PER_PRESS = 4

# a day of button mashing is nowhere near this (the agent caps its own log at 1000)
MAX_KIOSK_LOG_EVENTS = 1000

# the agent cuts preset names to this too
MAX_PRESET_NAME_LENGTH = 200


class EntranceStatus(BaseModel):
    """Where the entrance song is. All times are ms from the start of the song."""
    playing: bool
    position_ms: int
    drop_at_ms: int
    duration_ms: int


class DisplayKeysRequest(BaseModel):
    """One remote press: keys the kiosk applies in order, as one change."""
    keys: list[DisplayKey] = Field(..., min_length=1, max_length=MAX_KEYS_PER_PRESS)


class DisplayKeysQueued(BaseModel):
    """Acknowledges a queued press."""
    id: int


class DisplayControlEvent(BaseModel):
    """One key press in the kiosk's log. `at_ms` is epoch ms on the kiosk's clock."""
    key: str
    at_ms: int


class DisplayControlLog(BaseModel):
    """
    The kiosk's key log since its last reset, as the surfcam agent keeps it,
    plus the milkdrop preset the display page says is playing (null when it's
    not on screen).
    """
    session_ms: int
    version: int
    events: list[DisplayControlEvent] = Field(..., max_length=MAX_KIOSK_LOG_EVENTS)
    preset: Optional[str] = Field(None, max_length=MAX_PRESET_NAME_LENGTH)


class DisplayControlState(BaseModel):
    """
    What the admin page shows: the kiosk's latest log and whether it's online.

    `now_ms` is the backend's clock, so the page can correct for its own
    clock being off when working out where the rotation is.
    """
    revision: int
    online: bool
    kiosk_seen_ms: Optional[int] = None
    now_ms: int
    log: Optional[DisplayControlLog] = None


class DisplayCommand(BaseModel):
    """A queued remote press for the agent to add to its log."""
    id: int
    keys: list[str]


class DisplayCommandBatch(BaseModel):
    """The agent's long-poll answer: commands to run, and the cursor to send next."""
    cursor: int
    commands: list[DisplayCommand]


# Presence Schemas
# names come from people.json on fart-pi. these just keep a broken push from being huge
MAX_PRESENCE_PEOPLE = 50
MAX_PRESENCE_NAME_LENGTH = 50


class PresencePersonIn(BaseModel):
    """One person in the agent's snapshot. last_seen_ms is null until their phone answers."""
    name: str = Field(..., min_length=1, max_length=MAX_PRESENCE_NAME_LENGTH)
    last_seen_ms: Optional[int] = None


class PresenceSnapshot(BaseModel):
    """Everyone the presence agent watches, in the order its people.json lists them."""
    people: list[PresencePersonIn] = Field(..., max_length=MAX_PRESENCE_PEOPLE)


class PresencePerson(BaseModel):
    """
    One person on the admin page: when their phone last answered, when they last
    arrived (null if the backend hasn't seen an arrival since it started), and if
    they count as home.
    """
    name: str
    last_seen_ms: Optional[int] = None
    arrived_at_ms: Optional[int] = None
    home: bool


class PresenceState(BaseModel):
    """
    Who's home, for the admin page.

    `now_ms` is the backend's clock, for working out how long ago someone was seen.
    `away_after_ms` is how long a phone can be silent before its owner counts as away.
    """
    agent_online: bool
    agent_seen_ms: Optional[int] = None
    now_ms: int
    away_after_ms: int
    people: list[PresencePerson]


# Kiln Schemas
# most readings the logger sends at once. matches MAX_BATCH_SIZE in kiln_logger.py
MAX_KILN_BATCH_SIZE = 500
BOOT_ID_LENGTH = 36
# type k's range is about -270 to 1372 c, so anything outside these isn't a real reading
MIN_KILN_TEMP_C = -273.15
MAX_KILN_TEMP_C = 1500
MAX_KILN_FAULT_STATUS = 255


def as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """
    Marks a naive UTC time from the kiln tables as UTC, so responses say so.

    Args:
        value: A naive UTC datetime, or None.

    Returns:
        Optional[datetime]: The same moment with its timezone set, or None.
    """
    return None if value is None else value.replace(tzinfo=timezone.utc)


class KilnReadingIn(BaseModel):
    """One reading from the kiln logger. Carries its age, since the logger has no real clock."""
    seq: int = Field(ge=0)
    age_s: float = Field(ge=0)
    thermocouple_c: Optional[float] = Field(default=None, ge=MIN_KILN_TEMP_C, le=MAX_KILN_TEMP_C)
    cold_junction_c: float = Field(ge=MIN_KILN_TEMP_C, le=MAX_KILN_TEMP_C)
    fault_status: int = Field(ge=0, le=MAX_KILN_FAULT_STATUS)


class KilnReadingBatch(BaseModel):
    """A batch of readings from one boot of the kiln logger."""
    boot_id: str = Field(min_length=BOOT_ID_LENGTH, max_length=BOOT_ID_LENGTH)
    readings: list[KilnReadingIn] = Field(min_length=1, max_length=MAX_KILN_BATCH_SIZE)


class KilnBatchResult(BaseModel):
    """How a batch went: readings newly stored, and ones already stored by an earlier try."""
    stored: int
    duplicates: int


class KilnReadingRead(BaseModel):
    """A stored kiln reading. thermocouple_c is null when the amp reported a fault."""
    model_config = ConfigDict(from_attributes=True)

    recorded_at: datetime
    thermocouple_c: Optional[float] = None
    cold_junction_c: float
    fault_status: int

    @field_validator("recorded_at")
    @classmethod
    def mark_as_utc(cls, value: datetime) -> datetime:
        """The table stores naive UTC, so this says so in the response."""
        return as_utc(value)


class KilnFiringRead(BaseModel):
    """A firing's summary. ended_at is null while it's in progress."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    last_reading_at: datetime
    peak_c: float
    peak_at: datetime

    @field_validator("started_at", "ended_at", "last_reading_at", "peak_at")
    @classmethod
    def mark_as_utc(cls, value: Optional[datetime]) -> Optional[datetime]:
        """The table stores naive UTC, so this says so in the response."""
        return as_utc(value)


class KilnCurvePoint(BaseModel):
    """A point on a firing's curve. thermocouple_c is null when the probe had a fault."""
    recorded_at: datetime
    thermocouple_c: Optional[float] = None

    @field_validator("recorded_at")
    @classmethod
    def mark_as_utc(cls, value: datetime) -> datetime:
        """The table stores naive UTC, so this says so in the response."""
        return as_utc(value)


class KilnFiringCurve(BaseModel):
    """A firing and its curve. bucket_s is how much time each point averages over."""
    firing: KilnFiringRead
    bucket_s: int
    points: list[KilnCurvePoint]


class KilnStatus(BaseModel):
    """
    The kiln page's live readout.

    Temperature and rates are null while the logger's offline or the probe has a fault.
    The rates are degrees C per hour, negative when cooling. With no reading at the start
    of a rate's window, it uses what's inside the window, and it's null if that's under
    a third of the window. outdoor_forecast_c is the average outdoor temperature forecast
    for the next 12 hours. It's null with no firing in progress, or with no recent forecast.
    """
    online: bool
    last_reading_at: Optional[datetime] = None
    thermocouple_c: Optional[float] = None
    fault_status: Optional[int] = None
    rise_30m_c_per_h: Optional[float] = None
    rise_60m_c_per_h: Optional[float] = None
    outdoor_forecast_c: Optional[float] = None
    firing: Optional[KilnFiringRead] = None

    @field_validator("last_reading_at")
    @classmethod
    def mark_as_utc(cls, value: Optional[datetime]) -> Optional[datetime]:
        """The table stores naive UTC, so this says so in the response."""
        return as_utc(value)


# Kiln journal schemas: notes and photos on a firing, written by the kiln editor login
MAX_KILN_NOTE_LENGTH = 5000


def clean_note_body(value: Optional[str]) -> Optional[str]:
    """
    Trims a note's text and makes sure something's left.

    Args:
        value: The note text as sent, or None when it's left out.

    Returns:
        Optional[str]: The trimmed text, or None when it was left out.

    Raises:
        ValueError: If the text is only whitespace.
    """
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("the note is empty -- write something, or delete the note instead")
    return trimmed


class KilnNoteCreate(BaseModel):
    """A new note. Leave noted_at out for a general note about the whole firing."""
    body: str = Field(max_length=MAX_KILN_NOTE_LENGTH)
    noted_at: Optional[datetime] = None
    is_public: bool = False

    @field_validator("body")
    @classmethod
    def check_body(cls, value: str) -> str:
        """Trims the text and rejects an empty note."""
        return clean_note_body(value)


class KilnNoteUpdate(BaseModel):
    """
    Changes to a note. Only the fields sent change. Sending noted_at as null makes it a
    general note, but body and is_public can't be null.
    """
    body: Optional[str] = Field(default=None, max_length=MAX_KILN_NOTE_LENGTH)
    noted_at: Optional[datetime] = None
    is_public: Optional[bool] = None

    @field_validator("body")
    @classmethod
    def check_body(cls, value: Optional[str]) -> str:
        """Trims the text and rejects an empty or null note."""
        if value is None:
            raise ValueError("body can't be null -- leave it out to keep the current text")
        return clean_note_body(value)

    @field_validator("is_public")
    @classmethod
    def check_is_public(cls, value: Optional[bool]) -> bool:
        """Rejects null, since a note is always either public or private."""
        if value is None:
            raise ValueError("is_public can't be null -- send true or false, or leave it out")
        return value


class KilnNoteRead(BaseModel):
    """A note on a firing. noted_at is null for a general note."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    firing_id: int
    body: str
    noted_at: Optional[datetime] = None
    is_public: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_validator("noted_at", "created_at", "updated_at")
    @classmethod
    def mark_as_utc(cls, value: Optional[datetime]) -> Optional[datetime]:
        """The table stores naive UTC, so this says so in the response."""
        return as_utc(value)


class KilnPhotoUpdate(BaseModel):
    """Changes to a photo. Right now that's just who can see it."""
    is_public: bool


class KilnPhotoRead(BaseModel):
    """A photo from a firing. Its image is at /kiln/photos/{id}/file."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    firing_id: int
    width: Optional[int] = None
    height: Optional[int] = None
    is_public: bool
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def mark_as_utc(cls, value: datetime) -> datetime:
        """The table stores naive UTC, so this says so in the response."""
        return as_utc(value)


# Monitor Schemas
# limits only keep a broken report from being huge. the house has a handful of machines
MAX_MONITOR_NAME_LENGTH = 64
MAX_MONITOR_TEXT_LENGTH = 128
MAX_MONITOR_DISKS = 16
MAX_MONITOR_VOLUMES = 32

MonitorVolumeKind = Literal["filesystem", "swap", "unmounted", "unallocated", "unpartitioned"]


class MonitorVolume(BaseModel):
    """
    One part of a disk. used/available are only set for a mounted filesystem, and only
    when the agent could read them; they don't add up to size_bytes (ext4 keeps ~5% back).
    For unallocated/unpartitioned space, name is what the space is inside of.
    """
    name: str = Field(..., max_length=MAX_MONITOR_TEXT_LENGTH)
    kind: MonitorVolumeKind
    size_bytes: int = Field(..., ge=0)
    fstype: Optional[str] = Field(default=None, max_length=MAX_MONITOR_TEXT_LENGTH)
    mount: Optional[str] = Field(default=None, max_length=MAX_MONITOR_TEXT_LENGTH)
    used_bytes: Optional[int] = Field(default=None, ge=0)
    available_bytes: Optional[int] = Field(default=None, ge=0)


class MonitorDisk(BaseModel):
    """One physical disk and everything on it, in partition order."""
    name: str = Field(..., max_length=MAX_MONITOR_TEXT_LENGTH)
    model: Optional[str] = Field(default=None, max_length=MAX_MONITOR_TEXT_LENGTH)
    transport: Optional[str] = Field(default=None, max_length=MAX_MONITOR_TEXT_LENGTH)
    size_bytes: int = Field(..., ge=0)
    volumes: list[MonitorVolume] = Field(..., max_length=MAX_MONITOR_VOLUMES)


class MonitorCpu(BaseModel):
    """Cpu load. usage_pct is over the agent's last report interval, null on its first report."""
    cores: int = Field(..., ge=1)
    usage_pct: Optional[float] = Field(default=None, ge=0, le=100)
    load_1m: float = Field(..., ge=0)
    load_5m: float = Field(..., ge=0)
    load_15m: float = Field(..., ge=0)


class MonitorMemory(BaseModel):
    """Ram and swap. available counts reclaimable cache, so it's the real "free"."""
    total_bytes: int = Field(..., ge=0)
    available_bytes: int = Field(..., ge=0)
    swap_total_bytes: int = Field(..., ge=0)
    swap_free_bytes: int = Field(..., ge=0)


class MonitorBattery(BaseModel):
    """A laptop's battery. status is the kernel's word for it, like "Charging" or "Full"."""
    percent: Optional[int] = Field(default=None, ge=0, le=100)
    status: Optional[str] = Field(default=None, max_length=MAX_MONITOR_TEXT_LENGTH)
    on_power: bool


class MonitorReport(BaseModel):
    """What a monitor agent pushes every 30 s. name is the machine's hostname."""
    name: str = Field(..., min_length=1, max_length=MAX_MONITOR_NAME_LENGTH)
    model: Optional[str] = Field(default=None, max_length=MAX_MONITOR_TEXT_LENGTH)
    uptime_s: int = Field(..., ge=0)
    cpu: MonitorCpu
    temperature_c: Optional[float] = None
    memory: MonitorMemory
    battery: Optional[MonitorBattery] = None
    disks: list[MonitorDisk] = Field(..., max_length=MAX_MONITOR_DISKS)


class MonitorDevice(MonitorReport):
    """
    One machine on the monitor page: its last report, when that came in, and whether
    that's recent enough to count as online. Stats from an offline machine are stale.
    """
    online: bool
    reported_ms: int


class MonitorState(BaseModel):
    """Every machine that's reported since the backend started, in name order."""
    now_ms: int
    devices: list[MonitorDevice]


# DJ Stream Schemas
MAX_DJ_SET_TITLE_LENGTH = 200
MAX_DJ_SET_DESCRIPTION_LENGTH = 5000


class DjStreamStatus(BaseModel):
    """
    Whether the dj stream is on air. started_at is when butt connected (naive UTC),
    listeners is how many people the public relay is serving right now. set_id is the set
    being recorded, and image_id its cover image if one's been uploaded yet.
    """
    live: bool
    started_at: Optional[datetime] = None
    listeners: int
    set_id: Optional[int] = None
    image_id: Optional[int] = None


class DjSetRead(BaseModel):
    """A finished recorded set."""
    id: int
    title: Optional[str] = None
    description: Optional[str] = None
    started_at: datetime
    ended_at: datetime
    duration_s: int
    size_bytes: int
    image_id: Optional[int] = Field(None, description="its cover image, changes with every upload")

    model_config = ConfigDict(from_attributes=True)


class DjSetImageRead(BaseModel):
    """A set's cover image, as uploading one answers."""
    id: int
    set_id: int
    width: Optional[int] = None
    height: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class DjSetUpdate(BaseModel):
    """
    Editing a set's title and description. Only the fields sent are changed. Blank or
    null clears one: no title shows the date, no description shows nothing.
    """
    title: Optional[str] = Field(None, max_length=MAX_DJ_SET_TITLE_LENGTH)
    description: Optional[str] = Field(None, max_length=MAX_DJ_SET_DESCRIPTION_LENGTH)


# DJ live room chat. short on purpose: it's a chat next to a stream, not a forum
MAX_DJ_CHAT_NICKNAME_LENGTH = 24
MAX_DJ_CHAT_MESSAGE_LENGTH = 280
# the browser's secret key that owns its chat name (a uuid, 36 characters). bounds leave
# room for other random formats without letting anyone post a novel
MIN_DJ_CHAT_OWNER_KEY_LENGTH = 16
MAX_DJ_CHAT_OWNER_KEY_LENGTH = 128


def _one_line(value: str) -> str:
    """
    Squashes whitespace runs (newlines included) to single spaces and trims the ends.

    Args:
        value: Raw text from the client.

    Returns:
        str: The text on one line.
    """
    return " ".join(value.split())


class DjChatMessageCreate(BaseModel):
    """
    A chat message from the live room. The nickname and message are squashed onto one line
    and trimmed before the length checks, so a message of only spaces is rejected as
    empty. owner_key is the random secret the browser keeps, which owns the nickname once
    it's used (see routers/dj_chat.py).
    """
    nickname: str = Field(..., max_length=MAX_DJ_CHAT_NICKNAME_LENGTH)
    content: str = Field(..., max_length=MAX_DJ_CHAT_MESSAGE_LENGTH)
    owner_key: str = Field(..., min_length=MIN_DJ_CHAT_OWNER_KEY_LENGTH, max_length=MAX_DJ_CHAT_OWNER_KEY_LENGTH)

    @field_validator("nickname", "content", mode="before")
    @classmethod
    def squash_to_one_line(cls, value: object) -> object:
        """trims and flattens strings; anything else is left for the type check to reject."""
        return _one_line(value) if isinstance(value, str) else value

    @field_validator("nickname", "content")
    @classmethod
    def not_blank(cls, value: str) -> str:
        """rejects fields that were empty or only whitespace."""
        if not value:
            raise ValueError("can't be empty -- type something first")
        return value


# how many characters there are to pick from in the live room (app/dj_room.py's ROOM_CHARACTER_COUNT)
DJ_ROOM_CHARACTER_COUNT = 12


class DjRoomCheckIn(BaseModel):
    """
    A browser saying it's in the live room, under this chat name and look. Sent every few
    seconds while the room's open (see routers/dj_room.py). The name's squashed and
    trimmed like a chat message's. avatar asks for a character, photo_id for one of this
    browser's uploaded photos (it wins over avatar); with neither they keep whatever
    they had, or get the lowest free character.
    """
    nickname: str = Field(..., max_length=MAX_DJ_CHAT_NICKNAME_LENGTH)
    owner_key: str = Field(..., min_length=MIN_DJ_CHAT_OWNER_KEY_LENGTH, max_length=MAX_DJ_CHAT_OWNER_KEY_LENGTH)
    avatar: Optional[int] = Field(None, ge=0, lt=DJ_ROOM_CHARACTER_COUNT)
    photo_id: Optional[int] = Field(None, ge=1)

    @field_validator("nickname", mode="before")
    @classmethod
    def squash_to_one_line(cls, value: object) -> object:
        """trims and flattens strings; anything else is left for the type check to reject."""
        return _one_line(value) if isinstance(value, str) else value

    @field_validator("nickname")
    @classmethod
    def not_blank(cls, value: str) -> str:
        """rejects a name that was empty or only whitespace."""
        if not value:
            raise ValueError("can't be empty -- pick a name first")
        return value


class DjRoomLeave(BaseModel):
    """A browser leaving the live room."""
    owner_key: str = Field(..., min_length=MIN_DJ_CHAT_OWNER_KEY_LENGTH, max_length=MAX_DJ_CHAT_OWNER_KEY_LENGTH)


class DjRoomPerson(BaseModel):
    """Someone in the live room."""
    nickname: str
    avatar: int = Field(..., description="unique in the room. under 12 it's their character; photos get 12 up")
    photo_id: Optional[int] = Field(None, description="the photo they're standing in as, null for a character")

    model_config = ConfigDict(from_attributes=True)


class DjRoom(BaseModel):
    """Who's in the live room right now, in the order they came in."""
    people: list[DjRoomPerson]


class DjRoomPhotoRead(BaseModel):
    """A photo someone uploaded to stand in the live room as."""
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DjSetVisit(BaseModel):
    """
    Someone's stay in the live room during a recorded set, placed on the set's timeline
    like its chat, so the set's page can show who was there as it replays.
    """
    nickname: str
    avatar: int = Field(..., description="their number in the room. under 12 it's their character")
    photo_id: Optional[int] = Field(None, description="the photo they stood in as, null for a character (or if it's been removed)")
    from_s: float = Field(..., description="when they came in, seconds into the recording")
    to_s: float = Field(..., description="when they left, seconds into the recording")


class DjChatMessageRead(BaseModel):
    """A chat message as the room shows it. created_at is naive UTC."""
    id: int
    nickname: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DjSetChatMessage(DjChatMessageRead):
    """
    A chat message from during a recorded set, placed on the set's timeline. offset_s is
    how far into the recording it belongs: when it was sent, less the set's start and the
    few seconds listeners hear the stream behind the decks.
    """
    offset_s: float


class DjSetWaveform(BaseModel):
    """A recorded set's loudness over time, for drawing its waveform."""
    peaks: list[float] = Field(..., description="evenly spread over the set, each 0 to 1 (1 is the loudest moment)")


class DjLiveTrace(BaseModel):
    """
    The live set's loudness so far, measured as it streams, for drawing it while it's on.
    The first bar starts when the recording did (a few seconds after started_at in
    /dj/status), and they run back to back from there.
    """
    live: bool
    interval_s: float = Field(..., description="how many seconds of the set each bar covers")
    peaks: list[float] = Field(..., description="oldest first, each 0 to 1 (1 is the loudest moment so far). empty off air")


# DJ live alerts: emails the admin sends by hand when going live
# the longest an email address can be (RFC 5321's limit on a forward path)
MAX_EMAIL_LENGTH = 254
MAX_DJ_ALERT_SUBJECT_LENGTH = 120
MAX_DJ_ALERT_BODY_LENGTH = 2000


class DjAlertSignup(BaseModel):
    """Signing up for live alerts from the live room."""
    email: EmailStr = Field(..., max_length=MAX_EMAIL_LENGTH)


class DjAlertSignupResult(BaseModel):
    """
    The same answer whether the address is new, waiting on its confirmation or already
    signed up, so the form can't be used to check who's on the list.
    """
    email: str


class DjAlertSubscriberRead(BaseModel):
    """A subscriber as the admin page lists them. Times are naive UTC."""
    id: int
    email: str
    created_at: datetime
    confirmed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DjAlertSend(BaseModel):
    """
    An alert from the admin page. The subject is squashed onto one line (an email header
    can't hold a line break); blank or missing means the default. The body keeps its
    line breaks, trimmed at the ends, and can't be blank.
    """
    subject: Optional[str] = Field(None, max_length=MAX_DJ_ALERT_SUBJECT_LENGTH)
    body: str = Field(..., max_length=MAX_DJ_ALERT_BODY_LENGTH)

    @field_validator("subject", mode="before")
    @classmethod
    def subject_on_one_line(cls, value: object) -> object:
        """trims and flattens the subject; anything else is left for the type check."""
        return _one_line(value) if isinstance(value, str) else value

    @field_validator("body", mode="before")
    @classmethod
    def trim_body(cls, value: object) -> object:
        """trims the body's ends, keeping its line breaks."""
        return value.strip() if isinstance(value, str) else value

    @field_validator("body")
    @classmethod
    def body_not_blank(cls, value: str) -> str:
        """rejects a body that was empty or only whitespace."""
        if not value:
            raise ValueError("can't be empty -- write what the email should say")
        return value


class DjAlertSendResult(BaseModel):
    """
    How an alert went: how many took it, any address the mail server refused, and the
    live set it labelled (its subject and message became that set's title and
    description), if one was recording.
    """
    sent: int
    failed: list[str]
    labelled_set_id: Optional[int] = None
