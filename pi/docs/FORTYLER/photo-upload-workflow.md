# Photo Upload Workflow

After a trip, add photos to your website gallery from your phone or laptop.

## Quick Steps

1. Open `https://tyler-schwenk.com/admin/` on your phone or browser
2. Login with your credentials (stays logged in for 30 days)
3. Select **Photos**, choose **New Gallery** or an existing one
4. Fill in gallery name, slug, and description if creating a new one
5. Drag or select your photos and hit Upload
6. Redeploy the site (push to `main`) — the gallery auto-appears on the website

No SSH, no scripts, no config changes needed.

## Gallery Name and Description

Whatever you type in the upload UI is what shows on the website. The frontend pulls name and description directly from the API, so there's no hardcoded config to update.

The URL slug should be lowercase with hyphens (e.g., `iceland-trip-2026`). It auto-generates from the name.

## Verify Upload

```bash
# List galleries (from Pi or via API)
curl https://api.tyler-schwenk.com/galleries

# Get specific gallery with photos
curl https://api.tyler-schwenk.com/galleries/slug/trip-name
```

## Notes

- Thumbnails are auto-generated (400x400px)
- Original photos preserved
- Gallery is public by default — uncheck if you want to hide it temporarily
