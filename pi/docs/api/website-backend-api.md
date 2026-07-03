# Website Backend API Documentation

**Version:** 1.0.0  
**Base URL (public):** `https://api.tyler-schwenk.com`  
**Base URL (local/NetBird):** `http://100.124.76.27:8000`

Backend API for tyler-schwenk.com providing:
- **Public Square**: Anonymous forum — anyone can post, comment, and vote; no account needed
- **Photo Galleries**: Album management with automatic thumbnails and image serving
- **Video Hosting**: Video upload, streaming, and thumbnail generation
- **Pac-Tyler**: GeoJSON activity tracks and analytics dataset from Strava
- **Recipes (The Kitchen)**: Anonymous, rate-limited recipe submission with tags and photos; admin-only edit/delete

**Database:** Single SQLite file (`website_backend.db`) with separate tables for Public Square, gallery, video, and recipe features.

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

Used only to protect admin-only write endpoints (gallery/video/RSVP management, Public Square moderation) — there's a single admin account (Tyler), not general user registration. Public Square posting/commenting/voting is anonymous and needs no token at all; see the Public Square section below.

All authenticated endpoints require a JWT bearer token in the `Authorization` header.

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

Public recipe box: anyone can submit a recipe (name, description, tags, and photos, all optional) from the site's `/kitchen` page. Creating a recipe is public and rate-limited per IP, same pattern as Public Square and Event RSVPs. Editing and deleting a recipe requires the admin JWT, same as gallery photo management. Tags are freeform — submitting an unknown tag name creates it on the fly (matched case-insensitively so "Breakfast" and "breakfast" reuse the same tag).

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
- `tags` (string, optional): comma-separated tag names, e.g. `"dinner,quick,vegan"` — max 20 tags, unknown ones are created
- `files` (file[], optional): photo uploads — max 12 per recipe

**Example with JavaScript:**
```javascript
const formData = new FormData();
formData.append('name', "Grandma's Lasagna");
formData.append('description', 'Layer noodles, sauce, cheese...');
formData.append('tags', 'dinner,italian');
for (const file of photoFiles) formData.append('files', file);

const response = await fetch(`${API_URL}/recipes`, { method: 'POST', body: formData });
```

**Response:** `201 Created` — the created recipe (same shape as Get Recipe)

**Response:** `400 Bad Request` if more than 12 photos are attached, or if a file isn't a decodable image

**Rate Limit:** 10 per hour per IP

### Update Recipe

Edit a recipe's name, description, and/or tags. Admin only.

**Endpoint:** `PATCH /recipes/{recipe_id}`

**Headers:** `Authorization: Bearer <your-token>`

**Request Body:** (all fields optional)
```json
{
  "name": "Grandma's Lasagna (updated)",
  "description": "New instructions...",
  "tags": ["dinner", "italian", "freezer-friendly"]
}
```
`tags`, if provided, **fully replaces** the recipe's tag list rather than merging with it.

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

### Delete a Recipe Photo

Admin only.

**Endpoint:** `DELETE /recipes/{recipe_id}/photos/{photo_id}`

**Headers:** `Authorization: Bearer <your-token>`

**Response:** `204 No Content`

### Get Recipe Photo File

**Endpoint:** `GET /recipes/photos/{photo_id}/file`

**Query Parameters:** `thumbnail` (boolean, default: false)

**Response:** Image file with appropriate `Content-Type`

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

