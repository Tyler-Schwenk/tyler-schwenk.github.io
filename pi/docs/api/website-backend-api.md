# Website Backend API Documentation

**Version:** 1.0.0  
**Base URL (public):** `https://api.tyler-schwenk.com`  
**Base URL (home LAN):** `http://192.168.1.116:8000`

Backend API for tyler-schwenk.com providing:
- **Public Square**: Anonymous forum — anyone can post, comment, and vote; no account needed
- **Photo Galleries**: Album management with automatic thumbnails and image serving
- **Video Hosting**: Video upload, streaming, and thumbnail generation
- **Pac-Tyler**: GeoJSON activity tracks and analytics dataset from Strava
- **Recipes (The Kitchen)**: Anonymous, rate-limited recipe submission with tags and photos; admin-only edit/delete
- **Mallard Count**: Server-side proxy for the external mallard counter API (sidesteps that API's missing CORS headers)
- **Display Control**: In-memory relay between the admin page's remote and the display kiosk's surfcam agent
- **Entrance Song**: Plays an intro song on the big speakers from the admin page
- **Presence**: Who's home, pushed by the presence agent on fart-pi, for the admin page
- **Fly Kills**: The house fly kill counter on `/flies`. No login, rate limited per IP
- **DJ Stream**: Live DJ stream relayed from icecast on fart-pi, plus every recorded set and its cover, for the Opium Den's live section

**Database:** Single SQLite file (`website_backend.db`) with separate tables for Public Square, gallery, video, recipe, kiln, fly kill, and dj set features.

## Pac-Tyler

No authentication required. Data is written by the `pac-tyler-updater` systemd service and served as static files. Returns `503` if the updater hasnt run yet.

### Get GeoJSON tracks

**Endpoint:** `GET /pac-tyler/geojson`

**Response:** `200 OK` — GeoJSON FeatureCollection with all recorded Strava routes. Each feature is a LineString with properties: `name`, `date` (ISO 8601), `distance` (meters), `type` (e.g. "Ride"), and optionally `activity_id`.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "LineString", "coordinates": [[...]] },
      "properties": {
        "name": "Morning Ride",
        "date": "2026-05-09T08:00:00",
        "distance": 24000,
        "type": "Ride",
        "activity_id": 123456789
      }
    }
  ]
}
```

### Get activity dataset

**Endpoint:** `GET /pac-tyler/activities`

**Response:** `200 OK` — Flat activity list for frontend charts. No coordinate data.

```json
{
  "generated_at": "2026-05-10T03:01:00+00:00",
  "activity_count": 42,
  "activities": [
    {
      "activity_id": "123456789",
      "name": "Morning Ride",
      "date": "2026-05-09T08:00:00",
      "distance_m": 24000,
      "distance_mi": 14.91,
      "type": "Ride"
    }
  ]
}
```

## Authentication

Used only to protect admin-only endpoints (gallery/video/RSVP management, Public Square moderation, display kiosk remote control) — there's a single admin account (Tyler), not general user registration. Public Square posting/commenting/voting is anonymous and needs no token at all; see the Public Square section below.

All authenticated endpoints require a JWT bearer token in the `Authorization` header.

There are two kinds of token. The admin's has no `scope` claim and works everywhere. The kiln
editor's (Jude's, from `POST /kiln/auth/login`) has `"scope": "kiln"`, and only works on the
[Kiln Journal](#kiln-journal) endpoints. Admin-only endpoints answer a scoped token with 403.

### Register

Create a new user account.

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "johndoe"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "is_active": true,
  "is_verified": false,
  "created_at": "2026-03-03T10:00:00Z"
}
```

**Rate Limit:** 3 requests per hour per IP

### Login

Authenticate and receive a JWT token.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "username": "user@example.com",
  "password": "securePassword123"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Rate Limit:** 5 requests per minute per IP

Store the `access_token` in your application (e.g., localStorage) and include it in subsequent requests:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Get Current User

Get information about the currently authenticated user.

**Endpoint:** `GET /auth/me`

**Headers:**
```http
Authorization: Bearer <your-token>
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "is_active": true,
  "is_verified": false,
  "created_at": "2026-03-03T10:00:00Z"
}
```

## Public Square

Anonymous reddit-like forum. Anyone can create posts and comments and vote on them — no account, no login. Votes are deduped per post/comment by a salted hash of the visitor's IP (`sha256(ip + IP_HASH_SALT)`); raw IPs are never stored. Comments are flat (they reply to a post, not to each other) — there's no nested reply-to-reply threading in v1.

Creating posts/comments/votes is public and rate-limited per IP. Deleting posts/comments is admin-only (JWT) and is a hard delete — there's no soft-delete or edit history, it's meant as a moderation kill switch, not a full moderation queue.

### List Posts

Get a page of posts, sorted by top score or most recent.

**Endpoint:** `GET /public-square/posts`

**Query Parameters:**
- `sort` (`top` | `new`, default: `top`): `top` orders by score desc then newest; `new` orders by newest first
- `page` (integer, default: 1): Page number
- `page_size` (integer, default: 20, max: 100): Items per page

Each post includes `comment_count`, the number of comments on it (computed per request; not a stored column).

**Example:** `GET /public-square/posts?sort=new&page=1&page_size=10`

**Response:** `200 OK`
```json
{
  "posts": [
    {
      "id": 1,
      "title": "Welcome to Public Square",
      "content": "This is the first post...",
      "nickname": "tyler",
      "score": 3,
      "comment_count": 2,
      "created_at": "2026-03-03T10:00:00Z",
      "updated_at": null
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10,
  "total_pages": 1
}
```

### Get Single Post

**Endpoint:** `GET /public-square/posts/{id}`

**Response:** `200 OK` — same shape as a list item above.

**Response:** `404 Not Found` if post doesn't exist

### Create Post

No auth — anyone can post.

**Endpoint:** `POST /public-square/posts`

**Request Body:**
```json
{
  "title": "My New Post",
  "content": "This is the content of my post...",
  "nickname": "optional display name"
}
```

**Validation:**
- `title`: 1-200 characters
- `content`: 1-10,000 characters
- `nickname`: optional, up to 50 characters, free text (not unique, not verified) — omit or leave blank to show as "Anonymous"

**Response:** `201 Created` — the created post (same shape as list item)

**Rate Limit:** 5 per hour per IP. Loose on purpose for a low-traffic site — meant to be tightened only if abuse actually shows up.

### Delete Post

Admin only — deletes the post along with its comments and votes.

**Endpoint:** `DELETE /public-square/posts/{id}`

**Headers:**
```http
Authorization: Bearer <your-token>
```

**Response:** `204 No Content`

**Response:** `404 Not Found` if post doesn't exist

### List Comments

Get a post's comments (flat, no nesting), sorted by top score or most recent.

**Endpoint:** `GET /public-square/posts/{post_id}/comments`

**Query Parameters:**
- `sort` (`top` | `new`, default: `top`)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "content": "Great post!",
    "post_id": 1,
    "nickname": null,
    "score": 1,
    "created_at": "2026-03-03T10:30:00Z",
    "updated_at": null
  }
]
```

### Create Comment

No auth — anyone can comment.

**Endpoint:** `POST /public-square/posts/{post_id}/comments`

**Request Body:**
```json
{
  "content": "This is my comment...",
  "nickname": "optional display name"
}
```

**Validation:**
- `content`: 1-5,000 characters
- `nickname`: optional, up to 50 characters

**Response:** `201 Created` — the created comment

**Rate Limit:** 20 per hour per IP

**Response:** `404 Not Found` if the post doesn't exist

### Delete Comment

Admin only.

**Endpoint:** `DELETE /public-square/comments/{id}`

**Headers:**
```http
Authorization: Bearer <your-token>
```

**Response:** `204 No Content`

**Response:** `404 Not Found` if comment doesn't exist

### Vote on a Post

No auth — votes are deduped per post by hashed visitor IP, not accounts. Voting the same direction again retracts the vote; voting the opposite direction flips it.

**Endpoint:** `POST /public-square/posts/{id}/vote`

**Request Body:**
```json
{ "value": 1 }
```
`value` must be `1` (upvote) or `-1` (downvote).

**Response:** `200 OK`
```json
{ "score": 4, "your_vote": 1 }
```
`your_vote` is `0` if this click retracted a previous vote.

**Rate Limit:** 60 per minute per IP

### Vote on a Comment

Same semantics as voting on a post.

**Endpoint:** `POST /public-square/comments/{id}/vote`

**Request Body / Response:** same shape as Vote on a Post.

**Rate Limit:** 60 per minute per IP

## Galleries

Photo galleries for displaying curated images on the website.

### List Galleries

Get all galleries, sorted by `display_order` descending (higher = shown first).

**Endpoint:** `GET /galleries`

**Query Parameters:**
- `skip` (integer, default: 0): Number of galleries to skip (pagination)
- `limit` (integer, default: 100): Maximum galleries to return
- `public_only` (boolean, default: true): Only show public galleries

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Summer 2026",
    "description": "Photos from summer vacation",
    "slug": "summer-2026",
    "is_public": true,
    "display_order": 150,
    "created_at": "2026-03-15T10:00:00Z",
    "updated_at": null,
    "photo_count": 12
  }
]
```

### Get Gallery by ID

Get a specific gallery with all photos.

**Endpoint:** `GET /galleries/{gallery_id}`

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Summer 2026",
  "description": "Photos from summer vacation",
  "slug": "summer-2026",
  "is_public": true,
  "created_at": "2026-03-15T10:00:00Z",
  "updated_at": null,
  "photos": [
    {
      "id": 1,
      "gallery_id": 1,
      "filename": "beach.jpg",
      "file_path": "gallery_1/abc-123.jpg",
      "thumbnail_path": "gallery_1/thumbnails/abc-123.jpg",
      "title": "Beach Day",
      "description": "Sunset at the beach",
      "width": 3000,
      "height": 2000,
      "file_size": 1245678,
      "mime_type": "image/jpeg",
      "display_order": 0,
      "created_at": "2026-03-15T10:30:00Z"
    }
  ]
}
```

**Response:** `404 Not Found` if gallery doesn't exist

### Get Gallery by Slug

Get a gallery by URL-friendly slug.

**Endpoint:** `GET /galleries/slug/{slug}`

**Example:** `GET /galleries/slug/summer-2026`

**Response:** Same as Get Gallery by ID

### Create Gallery

Create a new photo gallery.

**Endpoint:** `POST /galleries`

**Request Body:**
```json
{
  "name": "Summer 2026",
  "description": "Photos from summer vacation",
  "slug": "summer-2026",
  "is_public": true
}
```

**Validation:**
- `name`: 1-200 characters, required
- `description`: 0-5,000 characters, optional
- `slug`: 1-200 characters, required, unique, URL-friendly
- `is_public`: boolean (default: true)

**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "Summer 2026",
  "description": "Photos from summer vacation",
  "slug": "summer-2026",
  "is_public": true,
  "created_at": "2026-03-15T10:00:00Z",
  "updated_at": null
}
```

### Update Gallery

Update gallery metadata.

**Endpoint:** `PATCH /galleries/{gallery_id}`

**Request Body:** (all fields optional)
```json
{
  "name": "Summer 2026 Updated",
  "description": "New description",
  "is_public": false
}
```

**Response:** `200 OK` (same structure as Create Gallery)

### Delete Gallery

Delete a gallery and all its photos (files and database records).

**Endpoint:** `DELETE /galleries/{gallery_id}`

**Response:** `204 No Content`

### Upload Photo

Upload a photo to a gallery.

**Endpoint:** `POST /galleries/{gallery_id}/photos`

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` (file, required): Image file to upload
- `title` (string, optional): Photo title (max 200 chars)
- `description` (string, optional): Photo description (max 5,000 chars)
- `display_order` (integer, default: 0): Display order in gallery

**Example with curl:**
```bash
curl -X POST "https://api.yoursite.com/galleries/1/photos" \
  -F "file=@/path/to/photo.jpg" \
  -F "title=Beach Sunset" \
  -F "description=Beautiful sunset"
```

**Example with JavaScript:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('title', 'Beach Sunset');
formData.append('description', 'Beautiful sunset');

const response = await fetch(`${API_URL}/galleries/1/photos`, {
  method: 'POST',
  body: formData
});
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "gallery_id": 1,
  "filename": "beach.jpg",
  "file_path": "gallery_1/abc-123.jpg",
  "thumbnail_path": "gallery_1/thumbnails/abc-123.jpg",
  "title": "Beach Sunset",
  "description": "Beautiful sunset at the beach",
  "width": 3000,
  "height": 2000,
  "file_size": 1245678,
  "mime_type": "image/jpeg",
  "display_order": 0,
  "created_at": "2026-03-15T10:30:00Z"
}
```

**Response:** `400 Bad Request` if file is not an image

### List Gallery Photos

Get all photos in a gallery.

**Endpoint:** `GET /galleries/{gallery_id}/photos`

**Response:** `200 OK` - Array of photo objects (ordered by display_order, then created_at)

### Get Photo Metadata

Get information about a specific photo (not the file itself).

**Endpoint:** `GET /galleries/photos/{photo_id}`

**Response:** `200 OK` - Photo object

### Get Photo File

Get the actual image file.

**Endpoint:** `GET /galleries/photos/{photo_id}/file`

**Query Parameters:**
- `thumbnail` (boolean, default: false): If true, returns thumbnail instead of original

**Response:** Image file with appropriate `Content-Type`

**Usage in HTML:**
```html
<!-- Full size image -->
<img src="https://api.yoursite.com/galleries/photos/1/file" alt="Photo">

<!-- Thumbnail -->
<img src="https://api.yoursite.com/galleries/photos/1/file?thumbnail=true" alt="Thumb">
```

**Thumbnails:**
- Automatically generated on upload
- Max dimensions: 400x400 pixels
- Maintains aspect ratio
- Optimized for web display

### Update Photo Metadata

Update photo title, description, or display order.

**Endpoint:** `PATCH /galleries/photos/{photo_id}`

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "display_order": 5
}
```

**Response:** `200 OK` - Updated photo object

### Delete Photo

Delete a photo (file and database record).

**Endpoint:** `DELETE /galleries/photos/{photo_id}`

**Response:** `204 No Content`

## Event RSVPs

RSVP submissions for events shown on the website's events pages. Creating an RSVP is public (the form is open to anyone); listing and deleting require admin auth.

Each RSVP captures one contact method (phone or email), how many friends they're bringing, and which follow-ups they opted into.

### Create RSVP

Submit an RSVP from a public event page. No auth.

**Endpoint:** `POST /events/rsvp`

**Request Body:**
```json
{
  "event_slug": "techno-fundraiser",
  "contact_type": "phone",
  "contact_value": "(555) 123-4567",
  "friends_count": 2,
  "wants_address": true,
  "wants_reminder": false
}
```

- `contact_type` must be `"phone"` or `"email"`.
- `contact_value` is validated against `contact_type` — phone must be 7-15 digits after stripping separators; email must look like an address.
- `friends_count` is 0-50.

**Response:** `201 Created` - The stored RSVP object (includes `id` and `created_at`).

**Rate limit:** 5 per minute and 30 per hour, per client IP (resolved via `CF-Connecting-IP` behind the Cloudflare Tunnel). Exceeding it returns `429 Too Many Requests`.

**Errors:** `422 Unprocessable Entity` if `contact_value` doesn't match `contact_type`.

### List RSVPs

List RSVPs newest first, optionally filtered to one event. Admin only.

**Endpoint:** `GET /events/rsvp`

**Headers:**
```
Authorization: Bearer <your-token>
```

**Query Parameters:**
- `event_slug` (optional) - only return RSVPs for this event

**Response:** `200 OK`
```json
[
  {
    "id": 12,
    "event_slug": "techno-fundraiser",
    "contact_type": "email",
    "contact_value": "friend@example.com",
    "friends_count": 1,
    "wants_address": true,
    "wants_reminder": true,
    "created_at": "2026-06-17T20:00:00Z"
  }
]
```

### Delete RSVP

Delete a single RSVP. Admin only.

**Endpoint:** `DELETE /events/rsvp/{rsvp_id}`

**Headers:**
```
Authorization: Bearer <your-token>
```

**Response:** `204 No Content`

**Errors:** `404 Not Found` if no RSVP with that id exists.

## Recipes (The Kitchen)

Public recipe box: anyone can submit a recipe (name, description, link, tags, and photos, all optional) from the site's `/kitchen` page. Creating a recipe is public and rate-limited per IP, same pattern as Public Square and Event RSVPs. Editing and deleting a recipe requires the admin JWT, same as gallery photo management. Tags are freeform — submitting an unknown tag name creates it on the fly (matched case-insensitively so "Breakfast" and "breakfast" reuse the same tag). The "cover photo" (used by the frontend grid) is always whichever photo has the lowest `display_order` — see Set Recipe Thumbnail below to change it.

### List Recipes

**Endpoint:** `GET /recipes`

**Query Parameters:**
- `search` (optional): substring match against name or description (case-insensitive)
- `tags` (optional): comma-separated tag names — a recipe must have *all* of them to match
- `skip` (integer, default: 0), `limit` (integer, default: 200)

**Response:** `200 OK` — array of recipe objects (see Get Recipe), newest first.

### Get Random Recipe

Picks one recipe at random, honoring the same filters as List Recipes. Powers the "Random Recipe" button.

**Endpoint:** `GET /recipes/random`

**Query Parameters:** same as List Recipes (`search`, `tags`)

**Response:** `200 OK` — a single recipe object

**Response:** `404 Not Found` if no recipe matches the filters

### List Tags

All tags currently in use, alphabetically, with how many recipes use each. Powers the filter chips and the add-recipe form's tag suggestions.

**Endpoint:** `GET /recipes/tags`

**Response:** `200 OK`
```json
[
  { "id": 1, "name": "breakfast", "recipe_count": 3 },
  { "id": 2, "name": "quick", "recipe_count": 5 }
]
```

### Get Recipe

**Endpoint:** `GET /recipes/{recipe_id}`

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Grandma's Lasagna",
  "description": "Layer noodles, sauce, cheese...",
  "link": "https://example.com/lasagna-recipe",
  "created_at": "2026-06-01T10:00:00Z",
  "updated_at": null,
  "tags": [{ "id": 1, "name": "dinner" }],
  "photos": [
    {
      "id": 1,
      "recipe_id": 1,
      "filename": "lasagna.jpg",
      "width": 3000,
      "height": 2000,
      "file_size": 1245678,
      "mime_type": "image/jpeg",
      "display_order": 0,
      "created_at": "2026-06-01T10:00:00Z"
    }
  ]
}
```

**Response:** `404 Not Found` if recipe doesn't exist

### Create Recipe

No auth — anyone can submit a recipe. All fields are optional so the form can be filled out quickly from a phone.

**Endpoint:** `POST /recipes`

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `name` (string, optional, max 200 chars)
- `description` (string, optional, max 10,000 chars)
- `link` (string, optional, max 500 chars): URL to an external source for the recipe. A bare domain (no `http(s)://`) gets `https://` prepended automatically.
- `tags` (string, optional): comma-separated tag names, e.g. `"dinner,quick,vegan"` — max 20 tags, unknown ones are created
- `files` (file[], optional): photo uploads — max 12 per recipe. The first photo (by upload order) becomes the cover; see Set Recipe Thumbnail to change it later.

**Example with JavaScript:**
```javascript
const formData = new FormData();
formData.append('name', "Grandma's Lasagna");
formData.append('description', 'Layer noodles, sauce, cheese...');
formData.append('link', 'https://example.com/lasagna-recipe');
formData.append('tags', 'dinner,italian');
for (const file of photoFiles) formData.append('files', file);

const response = await fetch(`${API_URL}/recipes`, { method: 'POST', body: formData });
```

**Response:** `201 Created` — the created recipe (same shape as Get Recipe)

**Response:** `400 Bad Request` if more than 12 photos are attached, or if a file isn't a decodable image

**Rate Limit:** 10 per hour per IP

### Update Recipe

Edit a recipe's name, description, link, and/or tags. Admin only.

**Endpoint:** `PATCH /recipes/{recipe_id}`

**Headers:** `Authorization: Bearer <your-token>`

**Request Body:** (all fields optional)
```json
{
  "name": "Grandma's Lasagna (updated)",
  "description": "New instructions...",
  "link": "https://example.com/lasagna-recipe",
  "tags": ["dinner", "italian", "freezer-friendly"]
}
```
`tags`, if provided, **fully replaces** the recipe's tag list rather than merging with it. `link` is normalized the same way as on creation (bare domains get `https://` prepended); set it to `null` or `""` to clear it.

**Response:** `200 OK` — the updated recipe

### Delete Recipe

Deletes the recipe, its tag associations, and its photo files. Admin only.

**Endpoint:** `DELETE /recipes/{recipe_id}`

**Headers:** `Authorization: Bearer <your-token>`

**Response:** `204 No Content`

### Add Photos to a Recipe

Attach more photos to an existing recipe. Admin only.

**Endpoint:** `POST /recipes/{recipe_id}/photos`

**Content-Type:** `multipart/form-data`

**Form Fields:** `files` (file[], required)

**Response:** `200 OK` — the recipe with its updated photo list

**Response:** `400 Bad Request` if the total photo count would exceed 12

### Set Recipe Thumbnail

Promote a photo to be the recipe's cover image. Admin only. There's no separate "is thumbnail" flag — this works by giving the chosen photo a lower `display_order` than every other photo on the recipe (the cover is always whichever photo sorts first). Calling it again on the current cover is a no-op.

**Endpoint:** `POST /recipes/{recipe_id}/photos/{photo_id}/thumbnail`

**Headers:** `Authorization: Bearer <your-token>`

**Response:** `200 OK` — the recipe with its photos re-ordered

**Response:** `404 Not Found` if the photo doesn't exist under that recipe

### Delete a Recipe Photo

Admin only.

**Endpoint:** `DELETE /recipes/{recipe_id}/photos/{photo_id}`

**Headers:** `Authorization: Bearer <your-token>`

**Response:** `204 No Content`

### Get Recipe Photo File

**Endpoint:** `GET /recipes/photos/{photo_id}/file`

**Query Parameters:** `thumbnail` (boolean, default: false)

**Response:** Image file with appropriate `Content-Type`

## Mallard Count

No authentication required. Proxies the external mallard counter API (`api.traderoutes.cards`) server-side, since that API doesn't send CORS headers and browsers can't fetch it directly from tyler-schwenk.com.

### Get Mallard Count

**Endpoint:** `GET /mallard-count`

**Response:** `200 OK`

```json
{ "count": 764 }
```

**Response:** `502 Bad Gateway` if the external API is unreachable.

## Display Control

Remote control of the display kiosk (displaytop) from the admin page. The kiosk's surfcam agent only listens on its own loopback, so both sides meet here: the admin page queues key presses and the agent long-polls for them; the agent pushes its key log and the admin page long-polls that. Everything is held in memory (it's a relay, not a record), which relies on uvicorn running a single worker. A backend restart drops queued presses and forgets the log until the agent's next push (within 25 s). See `pi/services/surfcam-agent/README.md` ("Remote control") and `website/docs/ADMIN.md`.

Two kinds of auth:
- **Admin** endpoints take the usual JWT bearer token
- **Kiosk** endpoints (`/display-control/kiosk/...`) take the shared secret in an `X-Kiosk-Token` header, which must equal `KIOSK_TOKEN` in the backend's `.env`. With `KIOSK_TOKEN` unset they answer `503`; a wrong token gets `401`

Key names: `tab`, `escape`, `backspace`, `next`, `prev`, `b`, `1`-`9`, `preset-<n>` (jump to milkdrop preset n, up to 4 digits), `preset-next` / `preset-prev` / `preset-hold` / `preset-auto`, and `top-same` / `top-tempo` / `top-1`-`top-9` (bpm mode's top screen) (the kiosk's key log, see `website/docs/DISPLAY.md`), plus `beat-earlier` / `beat-later` (bpm calibration, forwarded by the agent to the bpm agent).

Long-polls wait up to 25 s and then answer anyway, so callers just loop.

### Press Keys

Admin only. Queues one press for the kiosk; its keys are applied in order as one change.

**Endpoint:** `POST /display-control/keys`

**Request Body:** 1-4 keys
```json
{ "keys": ["escape", "5"] }
```

**Response:** `200 OK`
```json
{ "id": 12 }
```

A queued press is dropped if the agent hasn't collected it within 30 s, so a kiosk that's offline doesn't jump screens later. Unknown keys get `422`.

### Get Kiosk State

Admin only. Long-polls the kiosk's key log.

**Endpoint:** `GET /display-control/state?after=<revision>`

`after` is the revision already seen (`-1` answers at once). Waits until the revision differs (not just is newer, so a page holding one from before a backend restart gets the new state straight away).

**Response:** `200 OK`
```json
{
  "revision": 7,
  "online": true,
  "kiosk_seen_ms": 1791221724921,
  "now_ms": 1791221738642,
  "log": {
    "session_ms": 1791221699791,
    "version": 3,
    "events": [{ "key": "escape", "at_ms": 1791221702000 }, { "key": "5", "at_ms": 1791221702000 }],
    "preset": null
  }
}
```

`online` is whether the agent has checked in (polled or pushed) in the last 60 s. `now_ms` is the backend's clock, for working out where the rotation is (the kiosk's log uses the kiosk's clock; both are NTP-synced). `log` is `null` until the agent's first push. `log.preset` is the milkdrop preset playing on the kiosk, or `null` when milkdrop isn't on screen.

### Get Queued Presses (kiosk)

Kiosk only. Long-polled by the surfcam agent.

**Endpoint:** `GET /display-control/kiosk/commands?after=<cursor>`

`after=-1` (agent startup) answers at once with the current cursor and no commands, so presses from before the agent was listening aren't replayed. A cursor above the newest id means the backend restarted, and the agent gets everything queued since.

**Response:** `200 OK`
```json
{ "cursor": 12, "commands": [{ "id": 12, "keys": ["escape", "5"] }] }
```

### Push Key Log (kiosk)

Kiosk only. The surfcam agent sends its whole key log whenever it changes, and every 25 s as a heartbeat.

**Endpoint:** `PUT /display-control/kiosk/log`

**Request Body:** `{ "session_ms", "version", "events": [{ "key", "at_ms" }], "preset" }` (at most 1000 events; `preset` is the milkdrop preset playing, or null, at most 200 characters)

**Response:** `204 No Content`

## Kiln

Temperature readings from the kiln logger on castpi (see
[`pi/docs/services/kiln-logger.md`](../services/kiln-logger.md)), and what the public kiln page
reads (see [`website/docs/KILN.md`](../../../website/docs/KILN.md)).

### POST `/kiln/readings`

Stores a batch of readings. Safe to retry: a reading that's already stored is skipped. The
logger's Pi has no real-time clock, so each reading sends its age, and `recorded_at` is
worked out on arrival.

**Auth:** `X-Kiln-Token` header, matching `KILN_TOKEN` in the backend's `.env`. 401 if it's
wrong, 503 if `KILN_TOKEN` isn't set.

**Body:**

```json
{
  "boot_id": "11111111-2222-3333-4444-555555555555",
  "readings": [
    { "seq": 0, "age_s": 5.0, "thermocouple_c": 190.5, "cold_junction_c": 20.1, "fault_status": 0 }
  ]
}
```

- `boot_id`: the logger's boot id, 36 characters
- `readings`: 1 to 500 readings
- `seq`: the reading's number within that boot
- `age_s`: seconds since the reading was taken
- `thermocouple_c`: kiln temperature, null when the amp reports a fault
- `cold_junction_c`: the amp's own temperature
- `fault_status`: the amp's raw fault register (0 to 255), 0 means no fault

**Response:** `{ "stored": 1, "duplicates": 0 }`

### GET `/kiln/status`

The live readout. **Auth:** none. Rate limited per IP.

```json
{
  "online": true,
  "last_reading_at": "2026-11-02T16:16:16Z",
  "thermocouple_c": 190.5,
  "fault_status": 0,
  "rise_30m_c_per_h": 98.4,
  "rise_60m_c_per_h": 101.2,
  "outdoor_forecast_c": 18.4,
  "firing": { "id": 1, "started_at": "...", "ended_at": null, "last_reading_at": "...", "peak_c": 190.5, "peak_at": "..." }
}
```

- `online`: there's been a reading in the last 60 s
- `thermocouple_c` and the rates: null while offline or while the probe has a fault
- `rise_*_c_per_h`: degrees C per hour over that window, negative when cooling. With no reading at
  the start of the window, like when the probe was out then, it uses what's inside the window. Null
  if that covers under a third of the window
- `outdoor_forecast_c`: the average Open-Meteo forecast for the next 12 hours at `KILN_WEATHER_LATITUDE`
  and `KILN_WEATHER_LONGITUDE`, cached for 30 minutes. Null with no firing in progress, or when there's
  been no successful fetch in 6 hours. A failed fetch doesn't fail the request
- `firing`: the firing in progress, or null

### GET `/kiln/firings`

Firing summaries, newest first, including one in progress. **Auth:** none. Rate limited per IP.

**Query parameters:** `limit` (optional), 1 to 200, default 24.

### GET `/kiln/firings/{id}/curve`

One firing and its temperature curve, oldest first. **Auth:** none. Rate limited per IP. 404 if
there's no firing with that id.

**Query parameters:** `max_points` (optional), 10 to 3000, default 1500. Readings get averaged to fit.

```json
{
  "firing": { "id": 1, "started_at": "...", "ended_at": "...", "last_reading_at": "...", "peak_c": 1285.2, "peak_at": "..." },
  "bucket_s": 60,
  "points": [{ "recorded_at": "2026-11-02T16:16:16Z", "thermocouple_c": 190.5 }]
}
```

`bucket_s` is how much time each point covers, so a bigger jump between points is a hole in the
data. A point's temperature is null when every reading in it had a fault.

### GET `/kiln/readings`

The newest raw readings as a list, oldest first, each with `recorded_at`, `thermocouple_c`,
`cold_junction_c` and `fault_status`. **Auth:** admin JWT.

**Query parameters:**

- `since` (optional): only readings after this ISO 8601 time. Without a timezone it's taken as UTC
- `limit` (optional): the most readings to return, 1 to 20000, default 1000

## Kiln Journal

Jude's notes and photos on firings, shown on the kiln page (see
[`website/docs/KILN.md`](../../../website/docs/KILN.md#notes-and-photos)). Code:
`app/routers/kiln_journal.py`.

A note is general (`noted_at` null) or pinned to a moment in the firing. Notes and photos are
each public or private, and start private. Reads are public and rate limited per IP: without a
token they only return public items, and with a kiln editor or admin token they return
everything. A missing, bad or expired token on a read just gets the public view.

All times are ISO 8601. One sent without a timezone is taken as UTC. Responses are UTC.

**Making a login**: run this on fart-pi. It asks for the password twice, so it never lands in shell
history. Running it again for the same username resets the password. Usernames are lowercase.

```bash
docker exec -it website-backend-api python scripts/create_kiln_editor.py --username jude
```

### POST `/kiln/auth/login`

Swaps a kiln editor's username and password for a 30-day token with the `kiln` scope. Same form
and response as `POST /auth/login` (`username`, `password` as form fields). The username isn't
case sensitive. **Rate limit:** 5 per minute per IP. 401 for a wrong username or password.

### GET `/kiln/firings/{id}/notes`

A firing's notes, general ones first, then pinned ones by time. 404 if there's no such firing.

```json
[
  {
    "id": 3,
    "firing_id": 1,
    "body": "Opened the vents",
    "noted_at": "2026-11-03T04:30:00Z",
    "is_public": true,
    "created_at": "2026-11-03T04:31:12Z",
    "updated_at": null
  }
]
```

### POST `/kiln/firings/{id}/notes`

Adds a note. **Auth:** kiln editor or admin. 404 if there's no such firing.

```json
{ "body": "Opened the vents", "noted_at": "2026-11-02T20:30:00-08:00", "is_public": true }
```

- `body`: up to 5000 characters, trimmed, and can't be blank
- `noted_at` (optional): the moment it's about. Leave it out or send null for a general note
- `is_public` (optional): default false

Answers 201 with the note.

### PATCH `/kiln/notes/{note_id}`

Changes a note. **Auth:** kiln editor or admin. Only the fields sent change. `noted_at: null`
makes it general. `body` and `is_public` can't be null (422). 404 if there's no such note.

### DELETE `/kiln/notes/{note_id}`

Deletes a note. **Auth:** kiln editor or admin. 204, or 404 if there's no such note.

### GET `/kiln/firings/{id}/photos`

A firing's photos, oldest upload first. 404 if there's no such firing.

```json
[{ "id": 7, "firing_id": 1, "width": 3024, "height": 4032, "is_public": false, "created_at": "2026-11-04T18:02:41Z" }]
```

### POST `/kiln/firings/{id}/photos`

Adds one photo, as multipart form data: `file` (the image) and `is_public` (optional, default
false). **Auth:** kiln editor or admin. HEIC and EXIF-rotated photos are converted the same way
gallery uploads are, and a 400x400 thumbnail is made. Stored under `KILN_PHOTOS_DIR`
(`/mnt/ssd/kiln-photos`), in a `firing_<id>` folder.

Answers 201 with the photo. 400 if the file isn't an image, 413 if it's over 40 MB, 404 if
there's no such firing.

### PATCH `/kiln/photos/{photo_id}`

Makes a photo public or private: `{ "is_public": true }`. **Auth:** kiln editor or admin. 404 if
there's no such photo.

### DELETE `/kiln/photos/{photo_id}`

Deletes a photo and its files. **Auth:** kiln editor or admin. 204, or 404 if there's no such photo.

### GET `/kiln/photos/{photo_id}/file`

The photo's image. **Query parameters:** `thumbnail` (optional), true for the thumbnail. A
private photo needs a kiln editor or admin token, and answers 404 without one, the same as a
photo that doesn't exist. Private photos are sent with `Cache-Control: private, no-store`, so
Cloudflare never keeps a copy.

---

## Entrance Song

Plays the entrance song on the big speakers, through the speaker agent on displaytop. See `pi/docs/services/entrance-song.md`. **Auth:** admin JWT on all of them. Each one answers with the song's status:

```json
{"playing": true, "position_ms": 12345, "drop_at_ms": 58000, "duration_ms": 84000}
```

`position_ms` is how far into the song it is, 0 when nothing's playing. All three answer `503` if the speaker agent can't be reached.

### GET `/entrance/status`

The song's status.

### POST `/entrance/start`

Starts the song, or does nothing if it's already playing. **Errors:** `409` if another service is using the speakers, `503` if the rendered wav is missing or the speaker agent can't play it.

### POST `/entrance/stop`

Cuts the song off. Does nothing if it isn't playing.

---

## Presence

Who's home, from whose phone is on the home Wi-Fi. The presence agent on fart-pi pushes, the admin page reads. Kept in memory only. See `pi/docs/services/presence-agent.md`.

### GET `/presence`

**Auth:** admin JWT.

```json
{
  "agent_online": true,
  "agent_seen_ms": 1794165683928,
  "now_ms": 1794165683974,
  "away_after_ms": 5400000,
  "people": [
    {"name": "Sam", "last_seen_ms": 1794165683903, "arrived_at_ms": 1794164100000, "home": true},
    {"name": "Alex", "last_seen_ms": null, "arrived_at_ms": null, "home": false}
  ]
}
```

- `home`: their phone answered within `away_after_ms` (90 min) of `now_ms`
- `last_seen_ms`: epoch ms, null if not seen since the backend started
- `arrived_at_ms`: epoch ms their phone answered after at least `away_after_ms` of silence while the agent was pushing, null if no arrival seen since the backend started
- `agent_online`: the agent pushed in the last 2 min. If not, the times are stale
- `people` is empty until the agent's first push after a backend restart

### PUT `/presence/agent`

**Auth:** `X-Presence-Token` header, matching `PRESENCE_TOKEN` in the backend's `.env`. 401 if it's wrong, 503 if `PRESENCE_TOKEN` isn't set.

Updates everyone's last-seen time and notes arrivals. A `null` keeps what the backend already had. Up to 50 people, names up to 50 characters. Answers `204`.

```json
{"people": [{"name": "Sam", "last_seen_ms": 1794165683903}, {"name": "Alex", "last_seen_ms": null}]}
```

---

## Fly Kills

The house fly kill counter on `/flies`. No auth: anyone can add a kill for anyone or take one back. Each kill is a row in `fly_kills` (`killer`, `killed_at`), so a count is a row count and taking one back deletes that person's newest row. See `website/docs/FLIES.md`.

`{killer}` is one of `jude`, `dax`, `tyler`, `joel` (`FlyKiller` in `app/schemas.py`). Anything else is a `422`.

All three endpoints answer with the tally, everyone in that order plus the total:

```json
{
  "killers": [
    {"killer": "jude", "kills": 24},
    {"killer": "dax", "kills": 13},
    {"killer": "tyler", "kills": 12},
    {"killer": "joel", "kills": 0}
  ],
  "total": 49
}
```

### GET `/fly-kills`

Everyone's kills. `200`.

### POST `/fly-kills/{killer}`

Logs a kill for them. `201` with the new tally.

**Rate limit:** 60 per minute and 1000 per day, per client IP, shared with the DELETE.

### DELETE `/fly-kills/{killer}`

Takes back their newest kill, for misclicks. `200` with the new tally, or `409` if their count is already zero.

**Rate limit:** same as the POST.

---

## DJ Stream

The live DJ stream and its recorded sets, for the Opium Den's live section (`/opium-den/live`). butt on the DJ laptop sends to icecast on fart-pi; the backend watches icecast, records each session into `dj_sets` (mp3s in `/mnt/ssd/dj-sets`), and relays the stream publicly. Sets under 2 minutes are thrown away. All times are naive UTC. See `pi/docs/services/dj-stream.md`.

A set:

```json
{
  "id": 3,
  "title": "first one that didn't trainwreck",
  "description": "warehouse-y stuff, then it falls apart around the hour mark",
  "started_at": "2026-11-18T03:12:09",
  "ended_at": "2026-11-18T04:20:41",
  "duration_s": 4112,
  "size_bytes": 98689024,
  "image_id": 7
}
```

`title` and `description` are null until they're set from the admin page; without a title the site shows the date. `image_id` is the set's cover image (see `PUT /dj/sets/{set_id}/image`), null without one.

### GET `/dj/status`

Whether it's on air. Refreshed every 3 s from icecast, so it's cheap to poll. `200`:

```json
{"live": true, "started_at": "2026-11-18T03:12:05", "listeners": 2, "set_id": 12, "image_id": 9}
```

`started_at` is when butt connected (null when off air). `listeners` counts people on `/dj/live`. `set_id` is the set being recorded and `image_id` its cover, if one's been uploaded yet (both null when nothing's recording), so the live room can show the cover mid-set.

### GET `/dj/live/trace`

The live set's loudness so far, for drawing it while it's on: `{"live": true, "interval_s": 1.0, "peaks": [0.31, 0.42, ...]}`. Oldest first, each bar covering `interval_s` seconds back to back from when the recording started (a few seconds after `/dj/status`'s `started_at`), each 0 to 1 with 1 the loudest moment so far. One level a second, squeezed to at most 600 bars (`MAX_TRACE_BARS`, each the loudest of its stretch) once the set's longer than that, so `interval_s` grows with it. Measured as it streams by the live meter (a second ffmpeg on the icecast stream, RMS like the waveform), so it's cheap to poll. Off air it's `{"live": false, "interval_s": 0, "peaks": []}`, and in a set's first second or two, or while the meter's restarting, `peaks` can be empty or stop short. Code: `app/dj_live_meter.py`. Public. `200`.

### GET `/dj/live`

The live stream itself, `audio/mpeg`, endless until the set ends or the listener leaves. Point an `<audio>` element at it. `503` when it's off air, when 25 people are already listening, or when icecast won't serve it.

### GET `/dj/sets`

Every finished set, newest first. A set still being recorded isn't listed. `200`.

### GET `/dj/sets/{set_id}`

One finished set, for its page on the site (`/opium-den/live/set?id=`). `200` with the set, `404` if there's no finished set with that id.

### GET `/dj/sets/{set_id}/audio`

A set's mp3, with `Range` support for seeking (`206` for a range, `200` whole). `404` if there's no finished set with that id or its file is missing, `416` for a bad range.

### GET `/dj/sets/{set_id}/chat`

The live room's chat from while the set was on, so the set page can replay it as the recording plays. Oldest first, each message with `offset_s`, how far into the recording it belongs:

```json
[{"id": 42, "nickname": "kyle", "content": "this transition is crazy", "created_at": "2026-11-18T03:30:12", "offset_s": 1075.0}]
```

There's no link stored between a message and a set: a set's chat is every message sent between its `started_at` and `ended_at` plus `LISTENER_LAG_S` (8 s), since listeners hear the stream a few seconds behind the decks and can react to the last bit after it's over. For the same reason `offset_s` is the send time less the set's start less that lag, kept between 0 and `duration_s`. Messages deleted from the admin page are gone here too. `200`, `404` if there's no finished set with that id.

### GET `/dj/sets/{set_id}/waveform`

The set's loudness over time, for drawing its waveform: `{"peaks": [0.31, 0.42, ...]}`, about 1000 values (`WAVEFORM_BUCKETS`) evenly spread over the set, each 0 to 1 with 1 the loudest moment. ffmpeg works it out (RMS per slice) when the set finishes recording, and it's cached as `<set>.waveform.json` next to the mp3. A set without one gets it on its first request, which takes a few seconds for a long set. Code: `app/dj_waveform.py`. `200`, `404` if the set or its file is missing, `500` if ffmpeg can't read the mp3.

### PATCH `/dj/sets/{set_id}`

**Auth:** admin JWT.

Edits a set. Body `{"title": "...", "description": "..."}`, either or both; only the fields sent change. Title max 200 characters, description max 5000. Blank or null clears a field. `200` with the set, `404` if there's no finished set with that id.

### DELETE `/dj/sets/{set_id}`

**Auth:** admin JWT.

Deletes the set, its mp3, its cached waveform and its cover image. Its chat stays in `dj_chat_messages`. `204`, or `404` if there's no finished set with that id.

### Set cover images

Each set can have one cover image, in `dj_set_images` (its own table, since startup creates new tables but never adds columns). Files go in `/mnt/ssd/dj-sets/images/set_<id>/` with a ~400 px thumbnail, converted like gallery uploads (HEIC to JPEG, phone rotation baked in). These work on a set that's still recording too, so it can get its cover while it's on air.

Every upload gets a new image id that's never reused (the table's `AUTOINCREMENT`), and the site puts it in the url (`?v=<image_id>`), so a given url always means the same picture and can be cached for good.

#### PUT `/dj/sets/{set_id}/image`

**Auth:** admin JWT.

Multipart form with `file`, the image (max 40 MB). Replaces any cover it had, old files and all. `200` with `{"id": 9, "set_id": 12, "width": 1200, "height": 1200}`, `400` if it isn't an image, `404` if there's no set with that id, `413` if it's too big.

#### DELETE `/dj/sets/{set_id}/image`

**Auth:** admin JWT.

Takes the cover off and deletes its files. `204`, also when it had none. `404` if there's no set with that id.

#### GET `/dj/sets/{set_id}/image`

The cover, or with `?thumbnail=true` its thumbnail. Public, `Cache-Control: public, max-age=31536000, immutable`. The `v` query the site adds is ignored here. `404` if there's no set with that id, it has no cover, or the file's missing.

### Live room chat

The chat in the Opium Den's live room (`/opium-den/live/room`), in `dj_chat_messages`. Anonymous like the Public Square: a nickname, no account, no IP stored. Anyone can read it; sending only works while the stream's live. The room polls `GET /dj/chat` every 3 s and gets the whole recent room each time, so a deleted message drops out for everyone on the next poll. Code: `app/routers/dj_chat.py`.

A message:

```json
{"id": 42, "nickname": "kyle", "content": "this transition is crazy", "created_at": "2026-11-18T03:30:12"}
```

### GET `/dj/chat`

The room's chat, oldest first: the latest 100 messages from the last 6 hours (`MAX_CHAT_MESSAGES`, `CHAT_HISTORY_WINDOW`). Readable off air too, so the last set's chat stays up for a while. `200`. Messages are kept for good either way: older ones are read per set through `GET /dj/sets/{set_id}/chat`.

### POST `/dj/chat`

Sends a message. Body `{"nickname": "...", "content": "...", "owner_key": "..."}`. The nickname and message are squashed onto one line (whitespace runs become single spaces) and trimmed first. Then the nickname must be 1-24 characters and the message 1-280. Rate limited per IP to 8 a minute and 120 an hour (`CHAT_SEND_RATE_LIMIT`). `201` with the stored message. `403` when someone else has the name this set, `409` when the stream's off air, `422` for a blank or too-long field, `429` past the rate limit.

**One person per name per set.** `owner_key` is a random secret the browser makes once and keeps (a uuid, 16-128 characters allowed). The first message sent with a name during a live session claims it for that key, in `dj_chat_names` (the session's start time, the name lowercased, and a sha256 of the key, never the key itself). For the rest of that session, a send with the same name under a different key gets `403`. Names match ignoring case and surrounding spaces, so `KYLE` is the same name as `kyle`. A session is the stream watcher's `started_at` (when butt connected), so the next set starts with every name free, and the first claim in it deletes the last session's. If butt drops and reconnects, that's a new session too. If icecast gives no readable start time, names aren't checked at all (logged as a warning).

### DELETE `/dj/chat/{message_id}`

**Auth:** admin JWT.

Deletes a message (the admin page's DJ tab). `204`, or `404` if there's no message with that id.

### Live alerts

Emails telling people the stream's live, in `dj_alert_subscribers`. Anyone signs up with an address; they get a confirmation email, and only confirmed addresses get alerts. Nothing is sent automatically: the admin writes each alert on the admin page's DJ tab and sends it with `POST /dj/alerts/send`. Mail goes out over SMTP (`SMTP_*` and `MAIL_FROM` in `.env`); with `SMTP_HOST` or `MAIL_FROM` empty, signup and send answer `503`. Setup is in `pi/docs/services/dj-stream.md#live-alerts`. Code: `app/routers/dj_alerts.py`, `app/mailer.py`.

Each subscriber has a random `token` that's in both their confirm and unsubscribe links. The links go to the site's `/opium-den/live/alerts?confirm=<token>` and `?unsubscribe=<token>`, and that page makes the POST below, so a mail scanner opening the link doesn't confirm or unsubscribe anyone.

### POST `/dj/alerts/signup`

Body `{"email": "..."}`. Lowercased, must look like an address, max 254 characters. Emails a confirmation link to a new address, or again to an unconfirmed one if the last went out over 10 minutes ago (`CONFIRM_RESEND_COOLDOWN`). An already confirmed address gets nothing. The answer is the same `202` `{"email": "..."}` either way, so the form can't be used to check who's signed up. A new address is only saved once its confirmation's sent. Rate limited per IP to 5 a minute and 20 an hour (`SIGNUP_RATE_LIMIT`). `422` for a bad address, `429` past the limit, `502` if the mail server refuses the address or can't be reached, `503` when mail isn't configured.

### POST `/dj/alerts/confirm?token=...`

Confirms the signup with that token. `200` `{"email": "..."}`, also when it's already confirmed. `404` if no subscriber has that token (a mistyped link, or they've unsubscribed since).

### POST `/dj/alerts/unsubscribe?token=...`

Deletes the subscriber with that token. Also the target of each alert's `List-Unsubscribe` header (RFC 8058 one-click: mail apps POST `List-Unsubscribe=One-Click` as a form body, which is ignored). `204` whether or not the token matched anyone, so a second click isn't an error.

### GET `/dj/alerts/subscribers`

**Auth:** admin JWT.

Everyone signed up, newest first: `[{"id": 3, "email": "kyle@example.com", "created_at": "2026-11-20T02:10:00", "confirmed_at": "2026-11-20T02:11:42"}]`. `confirmed_at` is null until they click the link. `200`.

### DELETE `/dj/alerts/subscribers/{subscriber_id}`

**Auth:** admin JWT.

Takes someone off the list. `204`, or `404` if there's no subscriber with that id.

### POST `/dj/alerts/send`

**Auth:** admin JWT.

Emails every confirmed subscriber. Body `{"subject": "...", "body": "..."}`. The subject is optional (max 120, squashed onto one line; blank or missing means "Tyler's live in the den"). The body is required, max 2000, trimmed at the ends with its line breaks kept. Each subscriber gets their own plain text copy: the body, a link to the live room, and their unsubscribe link, with `List-Unsubscribe` / `List-Unsubscribe-Post` headers. They go out one at a time over one connection, 0.6 s apart (`SEND_INTERVAL_S`), and the request waits for all of them.

`200` `{"sent": 11, "failed": ["bounced@example.com"]}`: `failed` lists addresses the mail server refused (if the connection drops partway, everyone after that is in it too). `409` with nobody confirmed, `422` for a blank body or too-long field, `502` if the mail server can't be reached or logged in to (nothing was sent), `503` when mail isn't configured.

---

## Monitor

Each house machine's storage, memory, cpu and temperature. The monitor agent on each machine pushes, the `/monitor` page and the display kiosk read. Kept in memory only. See `pi/docs/services/monitor-agent.md`.

### GET `/monitor`

**Auth:** none. Rate limited to 60/minute per IP.

```json
{
  "now_ms": 1794955606420,
  "devices": [
    {
      "name": "fart-pi",
      "model": "Raspberry Pi 5 Model B Rev 1.1",
      "uptime_s": 1376846,
      "cpu": {"cores": 4, "usage_pct": 0.0, "load_1m": 0.18, "load_5m": 0.07, "load_15m": 0.02},
      "temperature_c": 46.9,
      "memory": {"total_bytes": 8454684672, "available_bytes": 7276068864, "swap_total_bytes": 2147467264, "swap_free_bytes": 2147467264},
      "battery": null,
      "disks": [
        {
          "name": "sda", "model": "SSK Portable SSD 500GB", "transport": "usb", "size_bytes": 500107862016,
          "volumes": [
            {"name": "sda1", "kind": "unmounted", "size_bytes": 206975238144, "fstype": "ntfs", "mount": null, "used_bytes": null, "available_bytes": null},
            {"name": "sda2", "kind": "filesystem", "size_bytes": 293131528704, "fstype": "ext4", "mount": "/mnt/ssd", "used_bytes": 5949804544, "available_bytes": 278496681984}
          ]
        }
      ],
      "online": true,
      "reported_ms": 1794955600000
    }
  ]
}
```

- `devices`: every machine that's reported since the backend started, by name. Empty until the first report after a restart
- `online`: reported within 2 min of `now_ms`. If not, its numbers are its last report's
- `volumes[].kind`: `filesystem` (mounted, with `used_bytes`/`available_bytes`), `swap`, `unmounted` (a partition nothing's mounted), `unallocated` (free space in an LVM volume group) or `unpartitioned` (the end of a disk no partition covers). For the last two, `name` is what the space is inside of
- `used_bytes` + `available_bytes` is a bit under `size_bytes` for ext4, which keeps ~5% back. Both are null if the agent couldn't read them
- `cpu.usage_pct`: over the agent's last 30 s, null on its first report
- `temperature_c`: null on a machine with no cpu sensor the agent knows
- `battery`: null without one. `on_power` is whether the charger's in; `status` is the kernel's word, which isn't reliable on displaytop

### PUT `/monitor/report`

**Auth:** `X-Monitor-Token` header, matching `MONITOR_TOKEN` in the backend's `.env`. 401 if it's wrong, 503 if `MONITOR_TOKEN` isn't set.

Replaces that machine's last report (keyed by `name`). Body is one device from `GET /monitor` without `online` and `reported_ms`. Up to 16 disks, 32 volumes per disk, names up to 64 characters. Answers `204`, or `422` if it doesn't fit.

---

## System Endpoints

### Health Check

Check if the API is running.

**Endpoint:** `GET /health`

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-03-03T10:00:00Z"
}
```

### API Information

Get API metadata.

**Endpoint:** `GET /`

**Response:** `200 OK`
```json
{
  "name": "Public Square API",
  "version": "1.0.0",
  "docs": "/docs",
  "health": "/health"
}
```

### Interactive Documentation

Visit `/docs` in your browser for interactive Swagger UI documentation where you can test endpoints.

## Error Responses

### 400 Bad Request
Invalid request body or parameters.
```json
{
  "detail": [
    {
      "loc": ["body", "title"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 401 Unauthorized
Missing or invalid authentication token.
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
Authenticated but not authorized for this action.
```json
{
  "detail": "Not authorized to perform this action"
}
```

### 404 Not Found
Resource not found.
```json
{
  "detail": "Post not found"
}
```

### 422 Unprocessable Entity
Validation error.
```json
{
  "detail": [
    {
      "loc": ["body", "title"],
      "msg": "ensure this value has at most 200 characters",
      "type": "value_error.any_str.max_length"
    }
  ]
}
```

### 429 Too Many Requests
Rate limit exceeded.
```json
{
  "detail": "Rate limit exceeded. Try again in 60 seconds."
}
```

## Example Usage (JavaScript)

### Setup

```javascript
const API_URL = 'https://fart-pi.your-tailnet.ts.net:8000';

// Store token in localStorage after login
function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

function getAuthToken() {
  return localStorage.getItem('authToken');
}

// Helper for authenticated requests
function authHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}
```

### Register User

```javascript
async function register(email, password, username) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username })
  });
  
  if (!response.ok) {
    throw new Error('Registration failed');
  }
  
  return await response.json();
}
```

### Login

```javascript
async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      username: email,  // Note: endpoint calls it 'username' but accepts email
      password 
    })
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  const data = await response.json();
  setAuthToken(data.access_token);
  return data;
}
```

### Get Public Square Posts

```javascript
async function getPosts(sort = 'top', page = 1, pageSize = 20) {
  const response = await fetch(
    `${API_URL}/public-square/posts?sort=${sort}&page=${page}&page_size=${pageSize}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch posts');
  }

  return await response.json();
}
```

### Create Public Square Post

No auth needed — anonymous, rate-limited per IP.

```javascript
async function createPost(title, content, nickname) {
  const response = await fetch(`${API_URL}/public-square/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, nickname: nickname || null })
  });

  if (!response.ok) {
    throw new Error('Failed to create post');
  }

  return await response.json();
}
```

### Add Comment

No auth needed — anonymous, rate-limited per IP.

```javascript
async function addComment(postId, content, nickname) {
  const response = await fetch(`${API_URL}/public-square/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, nickname: nickname || null })
  });

  if (!response.ok) {
    throw new Error('Failed to add comment');
  }

  return await response.json();
}
```

### Vote on a Post

```javascript
async function voteOnPost(postId, value) {
  const response = await fetch(`${API_URL}/public-square/posts/${postId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }) // 1 or -1
  });

  if (!response.ok) {
    throw new Error('Failed to vote');
  }

  return await response.json(); // { score, your_vote }
}
```

### Get Galleries

```javascript
async function getGalleries() {
  const response = await fetch(`${API_URL}/galleries`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch galleries');
  }
  
  return await response.json();
}
```

### Get Gallery by Slug

```javascript
async function getGallery(slug) {
  const response = await fetch(`${API_URL}/galleries/slug/${slug}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch gallery');
  }
  
  return await response.json();
}

// Example: Display gallery with React
function GalleryComponent({ slug }) {
  const [gallery, setGallery] = useState(null);
  
  useEffect(() => {
    getGallery(slug).then(setGallery);
  }, [slug]);
  
  if (!gallery) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{gallery.name}</h1>
      <p>{gallery.description}</p>
      <div className="photo-grid">
        {gallery.photos
          .sort((a, b) => a.display_order - b.display_order)
          .map(photo => (
            <div key={photo.id} className="photo-item">
              <img 
                src={`${API_URL}/galleries/photos/${photo.id}/file?thumbnail=true`}
                alt={photo.title || photo.filename}
                onClick={() => viewFullSize(photo.id)}
              />
              {photo.title && <p>{photo.title}</p>}
            </div>
          ))}
      </div>
    </div>
  );
}

function viewFullSize(photoId) {
  // Open modal with full-size image
  const imageUrl = `${API_URL}/galleries/photos/${photoId}/file`;
  // ... modal logic
}
```

### Upload Photo

```javascript
async function uploadPhoto(galleryId, file, title = '', description = '') {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  if (description) formData.append('description', description);
  
  const response = await fetch(`${API_URL}/galleries/${galleryId}/photos`, {
    method: 'POST',
    body: formData
    // Note: Don't set Content-Type header, browser will set it with boundary
  });
  
  if (!response.ok) {
    throw new Error('Failed to upload photo');
  }
  
  return await response.json();
}

// Example: File input handler
document.getElementById('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      const photo = await uploadPhoto(1, file, 'My Photo', 'Description');
      console.log('Uploaded:', photo);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }
});
```
```

## Rate Limits

- **Login:** 5 requests/minute per IP
- **Create RSVP:** 5/minute and 30/hour per IP
- **Create Public Square Post:** 5 requests/hour per IP
- **Create Public Square Comment:** 20 requests/hour per IP
- **Vote (post or comment):** 60 requests/minute per IP
- **Create Recipe:** 10 requests/hour per IP
- **Add Recipe Photos:** 30 requests/hour per IP
- **Add or take back a fly kill:** 60/minute and 1000/day per IP, both together
- **Send a live room chat message:** 8/minute and 120/hour per IP
- **Sign up for live alerts:** 5/minute and 20/hour per IP

All Public Square and Recipe limits are intentionally loose for a low-traffic personal site — tighten them in `pi/services/website-backend/app/routers/public_square.py` or `pi/services/website-backend/app/routers/recipes.py` only if abuse actually shows up.

Rate limit exceeded responses include a `Retry-After` header indicating seconds until the limit resets.

## CORS

The API supports cross-origin requests from configured frontend domains. If you encounter CORS errors, contact the API administrator to whitelist your domain.

## Support

For issues or questions, check:
- Interactive docs: `/docs`
- Health status: `/health`
- API root: `/`

## See Also

- [Gallery API Reference](./gallery-api-reference.md) - Detailed photo gallery API documentation
- [Video API Reference](./video-api-reference.md) - Video hosting and streaming API documentation

