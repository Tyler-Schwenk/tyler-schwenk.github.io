# Photo Upload Workflow

After a trip, add photos to your website gallery.

## Quick Steps

### 1. Copy Photos to Pi

From your laptop:
```bash
# Create folder for trip
ssh tyler@192.168.1.116 "mkdir -p /media/tyler/FE645A9A645A558D/public-gallery/trip-name"

# Copy photos
scp -r "C:\path\to\photos\*" tyler@192.168.1.116:/media/tyler/FE645A9A645A558D/public-gallery/trip-name/
```

### 2. Register in Database

On Pi:
```bash
ssh tyler@192.168.1.116
cd ~/tyler-schwenk.github.io/pi/services/website-backend
docker exec website-backend-api python scripts/migrate_photos.py
```

Done! Photos are now accessible via API with automatic thumbnails.

## Customize Gallery Metadata

Before running migration script, edit gallery titles/descriptions:

```bash
nano ~/tyler-schwenk.github.io/pi/services/website-backend/scripts/migrate_photos.py
```

Find `GALLERY_CONFIG` and add your trip:
```python
"trip-name": {
    "title": "Display Name",
    "description": "Trip description"
}
```

## Verify Upload

```bash
# List galleries
curl http://localhost:8000/galleries

# Get specific gallery
curl http://localhost:8000/galleries/slug/trip-name

# Test thumbnail
curl http://localhost:8000/galleries/photos/PHOTO_ID/file?thumbnail=true --output test.jpg
```

## Notes

- Script skips already-migrated galleries
- Thumbnails auto-generated (400x400px)
- Original photos preserved
- Can re-run migration script safely
