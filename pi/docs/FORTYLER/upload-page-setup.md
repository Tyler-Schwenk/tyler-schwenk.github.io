# Admin Upload Page Setup

Web interface for uploading photos and videos to your website galleries.

## Features

- JWT authentication (secure, only you can upload)
- **Create new galleries** or upload to existing ones
- Drag-and-drop file upload
- Video upload with metadata
- Upload progress tracking
- Mobile-friendly design
- Works from any browser (phone, tablet, laptop)

## Setup Instructions

### Recommended: Host on GitHub Pages

Add this page to your website so you can access it from anywhere.

1. **Copy the HTML file** to your website repository:
   ```bash
   # From this repo
   cp docs/FORTYLER/admin-upload-page.html <your-website-repo>/admin/upload.html
   ```

2. **Push to GitHub**:
   ```bash
   cd <your-website-repo>
   git add admin/upload.html
   git commit -m "Add admin upload page"
   git push
   ```

3. **Access from anywhere**:
   - URL: `https://tyler-schwenk.com/admin/upload.html`
   - Bookmark on your phone for easy access
   - Login stays active for 30 days

## How to Use

### First Time Setup

1. Open `https://tyler-schwenk.com/admin/upload.html` on your phone/laptop
2. Login with your API credentials
3. Token is saved - you won't need to login again for 30 days

### Upload Photos After a Trip

**Scenario: Just got back from Iceland, want to create a new gallery**

1. Open upload page on your phone
2. Select **"Photos"** radio button
3. Select **"New Gallery"** radio button
4. Fill in:
   - Gallery Name: `Iceland Adventure`
   - URL Slug: `iceland-adventure` (auto-generates)
   - Description: `Amazing trip to Iceland. March 2026`
   - Check "Make gallery public"
5. Select photos from your phone
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

1. Open upload page
2. Select **"Video"** radio button
3. Fill in:
   - Title: `Epic Climbing Video`
   - URL Slug: `epic-climbing-video` (auto-generates)
   - Description: Optional
4. Select video file
5. Click **"Upload"**
6. Wait (videos are larger and take longer)

## Security

**This page is secure because:**
- Requires JWT authentication
- Token stored in browser localStorage
- API validates all requests
- No public upload access

**Keep secure:**
- Don't share your login credentials
- Logout when done (optional)
- Token expires after 30 days

## Troubleshooting

### Can't Login
- Check your backend API is running: https://api.tyler-schwenk.com/health
- Verify credentials are correct
- Check browser console for errors (F12)

### Upload Fails
- Check file format (photos: jpg, png, etc. / videos: mp4, webm)
- Check file size (large videos may take time)
- Ensure backend has storage space
- Check browser console for error details

### Gallery Already Exists Error
- Slug must be unique
- Change the slug to something different
- Or select "Existing Gallery" to add to it

### Slow Upload on Mobile
- Normal for large files on cellular/WiFi
- Keep page open until complete
- Progress bar shows status

## Mobile Tips

**Best practices for phone usage:**
- Use WiFi for faster uploads
- Bookmark the page for quick access
- Select multiple photos at once (faster than one-by-one)
- Login persists for 30 days
- Works great on iPhone and Android

**Photo selection:**
- iOS: Tap file selector, choose from Photos app
- Android: Similar, choose from Gallery
- Can select multiple at once

## Workflow After a Trip

1. **On your phone**: Open upload page
2. **Create gallery**: Enter trip name and description
3. **Select photos**: Choose your best shots from camera roll
4. **Upload**: Hit upload and wait
5. **Done**: Photos are live at `tyler-schwenk.com/galleries/{slug}`

No need to touch your laptop or Pi - everything happens from your phone!

## What Happens Behind the Scenes

When you create a new gallery and upload:

1. Page creates gallery via API
2. Gallery stored in Pi database
3. Photos uploaded one-by-one to Pi
4. Pi generates thumbnails automatically
5. Photos stored on external SSD
6. Gallery immediately visible on your website

## Security Notes

**This page is secure because:**
- Requires JWT authentication
- Token stored in browser localStorage
- API validates all requests
- No public upload access
- HTTPS encryption via Cloudflare

**Keep secure:**
- Don't share your login credentials
- Token expires after 30 days (automatic re-login needed)
- Logout button available if using shared device

## Next Steps

**You're all set!** The workflow is:

Phone → Upload Page → Pi → Your Website

Everything automated, no SSH or scripts needed.
