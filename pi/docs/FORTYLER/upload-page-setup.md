# Admin Panel Setup

Web interface for managing galleries, photos, and videos.

## Features

- JWT authentication (secure, only you can upload)
- **Galleries tab**: reorder galleries, edit name/slug/description/visibility, expand to see and delete photos, drop zone to add photos to any gallery, delete entire galleries
- **Upload tab**: upload photos to existing or new gallery, upload videos with metadata
- Drag-and-drop file upload with progress tracking
- Mobile-friendly dark theme
- Works from any browser (phone, tablet, laptop)

## Access

The admin panel lives at `https://tyler-schwenk.com/admin/` (served from `website/public/admin/index.html`).

No setup needed — it's deployed as part of the website. Login with your API credentials. Token stays active for 30 days (stored in localStorage).

## How to Use

### Upload Photos After a Trip

1. Open `https://tyler-schwenk.com/admin/` on your phone or laptop
2. Login if prompted
3. Go to the **Upload** tab
4. Select **"New Gallery"**, fill in name, slug, and description
5. Select photos and hit Upload
6. Push to `main` to trigger a redeploy — the gallery auto-appears on the website
6. Click **"Upload"**
7. Done! New gallery is created and photos are uploaded

### Add More Photos to Existing Gallery

1. Open upload page
2. Select **"Photos"** radio button
3. Select **"Existing Gallery"** radio button
4. Choose gallery from dropdown
5. Select photos
6. Click **"Upload"**

### Upload a Video

1. Go to the **Upload** tab
2. Select video, fill in title and description
3. Click **"Upload"** (videos are larger — give it a minute)

## Security

- Requires JWT authentication
- Token stored in browser localStorage, expires after 30 days
- API validates all requests — no public upload access

## Troubleshooting

### Can't Login
- Check the backend is up: https://api.tyler-schwenk.com/health
- Verify credentials
- Check browser console (F12) for error details

### Upload Fails
- Check file format (photos: jpg, png, webp, etc. / videos: mp4, webm)
- Large videos take longer — keep page open
- Ensure the Pi has storage space
- Check browser console for error details

### Gallery Already Exists Error
- Slug must be unique — change it or select "Existing Gallery" to add photos to it
