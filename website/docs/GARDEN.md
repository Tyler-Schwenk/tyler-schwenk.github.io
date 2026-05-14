# Garden Documentation

## Overview

The garden page (`/garden`) shows a timelapse of the home garden with a live date label
that tracks which day is currently on screen. Below the video is a static Gardening
Inspiration section with links to San Diego Seed Company.

The video is served from the Pi backend. The date-tracking data is compiled into a
TypeScript module at build time and shipped with the static site.

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `website/app/garden/page.tsx` | Garden page — fetches video metadata by slug, renders player + date label |
| `website/app/garden/timelapse-timestamps.ts` | Auto-generated timestamp map (video seconds → calendar date) |
| `scripts/timelapse/compile_timelapse.py` | Compiles the raw footage into one MP4 and regenerates the timestamps module |

### Data Flow

```
compile_timelapse.py
  ├── before/ JPEGs  → converted to 3s still clips (1920x1080, pillarboxed)
  └── timelapse/ AVIs → concatenated as-is
        ↓
  garden-timelapse.mp4  (upload to Pi)
  timelapse-timestamps.ts  (committed to repo)
        ↓
  garden page fetches video ID by slug from Pi, streams via /videos/{id}/stream
  timeupdate events → lookup in TIMELAPSE_TIMESTAMPS → date label shown below player
```

### Raw Data Location

```
C:\Users\tyler\important\projects\WebDev\Tylers Website\data\time lapse\
├── before/     JPEGs taken before the camera was set up (dates from EXIF)
├── 1/          First memory card pull (Apr 13–28) — superseded by folder 2
└── 2/          Second memory card pull (Apr 13–May 9) — complete dataset used by script
```

New card pulls go in a new numbered folder (`3/`, `4/`, etc.).

---

## Adding New Footage

Do this every time you pull the memory card.

### 1. Copy card data to a new folder

Copy the AVI files from the camera's memory card to a new numbered folder:
```
C:\Users\tyler\important\projects\WebDev\Tylers Website\data\time lapse\3\
```

### 2. Update the script

Open `scripts/timelapse/compile_timelapse.py` and update `TIMELAPSE_DIR` to point to
the newest complete folder (the one with all clips from the start through today):

```python
TIMELAPSE_DIR = Path(r"C:\Users\tyler\...\data\time lapse\3")
```

> Each new card pull should contain all days from the beginning, not just new ones.
> Always use the most recent folder as `TIMELAPSE_DIR` — it replaces the old one entirely.

### 3. Run the script

```
python scripts/timelapse/compile_timelapse.py
```

This takes a few minutes. It outputs:
- `data/garden-timelapse.mp4` — the new compiled video
- `website/app/garden/timelapse-timestamps.ts` — updated with new date entries

### 4. Replace the video on the Pi

The existing video needs to be replaced since the timing has changed. Do this via the
admin API (or admin upload page):

```bash
# delete the old video (get the ID first from GET /videos/slug/garden-timelapse)
DELETE https://api.tyler-schwenk.com/videos/{id}

# re-upload
POST https://api.tyler-schwenk.com/videos
  file: garden-timelapse.mp4
  slug: garden-timelapse
  title: Garden Timelapse
  is_public: true
```

### 5. Deploy the website

```
git add website/app/garden/timelapse-timestamps.ts
git commit -m "update garden timelapse timestamps"
git push
```

The GitHub Actions deploy will pick it up automatically.

---

## Adding More Before Photos

Before photos are JPEGs taken before the timelapse camera was set up. Their dates come
from EXIF metadata (file mtimes aren't reliable since files get copied around).

### How to get the EXIF date from a photo

Run this in PowerShell:
```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("C:\path\to\photo.jpg")
$prop = $img.GetPropertyItem(36867)  # 36867 = DateTimeOriginal
[System.Text.Encoding]::ASCII.GetString($prop.Value).Trim([char]0)
$img.Dispose()
```

### Add the photo and update the script

1. Copy the JPEG to `data/time lapse/before/` and name it sequentially (`4.jpg`, etc.)
2. Add an entry to `BEFORE_PHOTO_DATES` in the script:
   ```python
   BEFORE_PHOTO_DATES: dict[str, str] = {
       "1.jpg": "Mar 8, 2026",
       "2.jpg": "Apr 5, 2026",
       "3.jpg": "Apr 11, 2026",
       "4.jpg": "Feb 20, 2026",  # add new entries here
   }
   ```
   Keep filenames sorted by date for the correct visual order.
3. Re-run the script and follow the deploy steps above.

---

## Pi Video Endpoint

The garden page fetches video metadata by slug:
```
GET https://api.tyler-schwenk.com/videos/slug/garden-timelapse
```
Returns `{ id, title, ... }`. The page then streams via:
```
GET https://api.tyler-schwenk.com/videos/{id}/stream
```

If the video hasn't been uploaded yet, the page shows a "coming soon" placeholder.
