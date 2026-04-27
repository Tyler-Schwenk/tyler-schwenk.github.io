# Website Backend API Documentation

**Version:** 1.0.0  
**Base URL (public):** `https://api.tyler-schwenk.com`  
**Base URL (local/NetBird):** `http://100.124.76.27:8000`

Backend API for tyler-schwenk.com providing:
- **Public Square Forum**: User authentication, posts, comments, and discussions
- **Photo Galleries**: Album management with automatic thumbnails and image serving
- **Video Hosting**: Video upload, streaming, and thumbnail generation

**Database:** Single SQLite file (`website_backend.db`) with separate tables for forum, gallery, and video features.

## Authentication

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

## Posts

### List Posts

Get a paginated list of all published posts.

**Endpoint:** `GET /posts`

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `page_size` (integer, default: 20, max: 100): Items per page

**Example:** `GET /posts?page=1&page_size=10`

**Response:** `200 OK`
```json
{
  "posts": [
    {
      "id": 1,
      "title": "Welcome to Public Square",
      "content": "This is the first post...",
      "author_id": 1,
      "author": {
        "id": 1,
        "username": "johndoe"
      },
      "created_at": "2026-03-03T10:00:00Z",
      "updated_at": null,
      "is_published": true
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10,
  "total_pages": 1
}
```

### Get Single Post

Get a specific post by ID.

**Endpoint:** `GET /posts/{id}`

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "Welcome to Public Square",
  "content": "This is the first post...",
  "author_id": 1,
  "author": {
    "id": 1,
    "username": "johndoe"
  },
  "created_at": "2026-03-03T10:00:00Z",
  "updated_at": null,
  "is_published": true
}
```

**Response:** `404 Not Found` if post doesn't exist

### Create Post

Create a new post (requires authentication).

**Endpoint:** `POST /posts`

**Headers:**
```http
Authorization: Bearer <your-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "My New Post",
  "content": "This is the content of my post...",
  "is_published": true
}
```

**Validation:**
- `title`: 1-200 characters
- `content`: 1-50,000 characters
- `is_published`: boolean (default: true)

**Response:** `201 Created`
```json
{
  "id": 2,
  "title": "My New Post",
  "content": "This is the content of my post...",
  "author_id": 1,
  "author": {
    "id": 1,
    "username": "johndoe"
  },
  "created_at": "2026-03-03T11:00:00Z",
  "updated_at": null,
  "is_published": true
}
```

**Rate Limit:** 10 posts per minute

### Update Post

Update an existing post (requires authentication, must be author).

**Endpoint:** `PUT /posts/{id}`

**Headers:**
```http
Authorization: Bearer <your-token>
Content-Type: application/json
```

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "is_published": true
}
```

**Response:** `200 OK` (same structure as Get Single Post)

**Response:** `403 Forbidden` if not the author

### Delete Post

Delete a post (requires authentication, must be author).

**Endpoint:** `DELETE /posts/{id}`

**Headers:**
```http
Authorization: Bearer <your-token>
```

**Response:** `204 No Content`

**Response:** `403 Forbidden` if not the author

## Comments

### List Comments

Get all comments for a specific post.

**Endpoint:** `GET /posts/{post_id}/comments`

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "content": "Great post!",
    "post_id": 1,
    "author_id": 2,
    "author": {
      "id": 2,
      "username": "janedoe"
    },
    "created_at": "2026-03-03T10:30:00Z",
    "updated_at": null
  }
]
```

### Create Comment

Add a comment to a post (requires authentication).

**Endpoint:** `POST /posts/{post_id}/comments`

**Headers:**
```http
Authorization: Bearer <your-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "This is my comment..."
}
```

**Validation:**
- `content`: 1-10,000 characters

**Response:** `201 Created`
```json
{
  "id": 1,
  "content": "This is my comment...",
  "post_id": 1,
  "author_id": 1,
  "author": {
    "id": 1,
    "username": "johndoe"
  },
  "created_at": "2026-03-03T11:00:00Z",
  "updated_at": null
}
```

**Rate Limit:** 20 comments per minute

### Update Comment

Update a comment (requires authentication, must be author).

**Endpoint:** `PUT /comments/{id}`

**Headers:**
```http
Authorization: Bearer <your-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "Updated comment text..."
}
```

**Response:** `200 OK` (same structure as comment object)

**Response:** `403 Forbidden` if not the author

### Delete Comment

Delete a comment (requires authentication, must be author).

**Endpoint:** `DELETE /comments/{id}`

**Headers:**
```http
Authorization: Bearer <your-token>
```

**Response:** `204 No Content`

**Response:** `403 Forbidden` if not the author

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

### Get Posts

```javascript
async function getPosts(page = 1, pageSize = 20) {
  const response = await fetch(
    `${API_URL}/posts?page=${page}&page_size=${pageSize}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch posts');
  }
  
  return await response.json();
}
```

### Create Post

```javascript
async function createPost(title, content) {
  const response = await fetch(`${API_URL}/posts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content, is_published: true })
  });
  
  if (!response.ok) {
    throw new Error('Failed to create post');
  }
  
  return await response.json();
}
```

### Add Comment

```javascript
async function addComment(postId, content) {
  const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ content })
  });
  
  if (!response.ok) {
    throw new Error('Failed to add comment');
  }
  
  return await response.json();
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

- **Registration:** 3 requests/hour per IP
- **Login:** 5 requests/minute per IP
- **Create Post:** 10 requests/minute per user
- **Create Comment:** 20 requests/minute per user

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

