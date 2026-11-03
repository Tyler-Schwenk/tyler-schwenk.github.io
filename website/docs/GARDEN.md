# Garden Documentation

## Overview

The garden page (`/garden`) has a masthead with a herbarium-style label (date range and
day count derived from the timelapse dates), the timelapse player, notes (tomato of the year, further reading), and a photographs
section at the bottom fed by the `garden-photos` gallery.

The video and gallery photos are both served from the Pi backend and fetched client-side
by slug — new uploads show up on page load without a website rebuild. The date-tracking
data for the timelapse is the one exception: it's compiled into a TypeScript module at
build time and shipped with the static site, so a new timelapse video still needs a
`git push` to update the date labels (see "Adding New Footage" below).

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `website/app/garden/page.tsx` | Garden page — fetches video + gallery metadata by slug, renders masthead + herbarium label, player, photographs (balanced columns, natural proportions), and notes |
| `website/app/garden/TimelapsePlayer.tsx` | Custom timelapse player (ruler scrubber, large date readout, day/frame stepping, speed, fullscreen, keyboard) |
| `website/app/garden/timelapse-utils.ts` | Date lookups over the timestamps: date at a time, day number, month chapters, adjacent day, span + range, label splitting |
| `website/app/garden/timelapse-timestamps.ts` | Auto-generated timestamp map (video seconds → calendar date) |
| `scripts/timelapse/compile_timelapse.py` | Pulls footage off the memory card into the archive, compiles it into one MP4, and regenerates the timestamps module |
| `website/components/PhotoLightbox.tsx` | Shared fullscreen lightbox opened when a photograph is clicked |

### Data Flow

```
memory card (FAT32)
  | compile_timelapse.py --card     copies new clips, verifies each by SHA-256
  v
data/time lapse/raw/                permanent archive, append-only
  | compile_timelapse.py
  |   before/ JPEGs -> 2s still clips, pillarboxed to the camera's 1920x1080
  |   raw/ clips    -> clips with no decodable frames are skipped, dusk noise is cut
  |   all of it     -> one output frame per source frame, 1280x720, 30 fps
  v
garden-timelapse.mp4  (upload to Pi)
timelapse-timestamps.ts  (committed to repo)
  |
  v
garden page fetches video ID by slug from Pi, streams via /videos/{id}/stream
player polls currentTime each animation frame while playing -> lookup in
TIMELAPSE_TIMESTAMPS -> date + day number shown in the readout under the ruler
```

### Raw Data Location

Everything lives next to the repo, outside of git:

```
Tylers Website/data/
├── garden-timelapse.mp4     latest compiled video
└── time lapse/
    ├── before/              JPEGs from before the camera was set up
    └── raw/                 every clip ever pulled
        ├── 2026-04-13_134112_TLC00001.AVI
        ├── ...
        └── SHA256SUMS       checks out with `sha256sum -c SHA256SUMS`
```

Filenames are `<capture time>_<camera name>`, with the capture time being the camera's
own clock. That prefix is the source of truth for a clip's date and order:

- File mtimes aren't reliable. FAT32 stores local time with no zone and Windows converts
  it using today's UTC offset, so the same file reads an hour different depending on
  whether it's pulled during daylight time.
- The camera can restart its `TLC00001` numbering on a formatted card. The prefix keeps
  those clips from colliding with old ones and sorts them in the right place.

Clips with no decodable frames stay in the archive but are skipped during compilation.
Their headers still claim a normal length, so counting them would add a freeze to the
video.

Dusk noise gets cut at compile time too, the archive keeps every frame. The camera raises
its gain as the light fades, which turns the last frames of the day into colored static
while keeping them bright, so a brightness check misses them. That noise barely compresses
though: daylight JPEG frames top out around 700 KB and dusk ones reach 1.4 MB. So the
compile drops the unbroken run of frames at or above `NOISY_FRAME_MIN_BYTES` at the end of
each clip, plus `DUSK_MARGIN_FRAMES` before it. Busy frames earlier in the day aren't
touched. The cut moves earlier as the days get shorter, so day lengths in the video vary.

---

## Timelapse Player

`TimelapsePlayer` is a custom control set over a plain `<video>` (poster comes from
`/videos/{id}/thumbnail`). Everything date-related is derived from
`TIMELAPSE_TIMESTAMPS`, so it updates automatically when the timestamps are regenerated.

- **Ruler scrubber** — sits directly under the video. One short tick per timestamp entry
  (so gaps in the footage show up as empty stretches), a longer tick at each month start,
  and month labels underneath. Labels closer than `MIN_MONTH_LABEL_GAP_PCT` drop the
  earlier one so they don't collide on phones; labels past `RIGHT_ALIGN_LABEL_PCT` hang
  left of their tick. Pointer-captured, so it works for mouse and touch; the date under
  the cursor shows above it while hovering or dragging. The red playhead marks the
  current position.
- **Readout** — the current date set large ("Apr 22") with the year, "day N of M"
  (day 1 = first timestamp entry) and the clock underneath.
- **Control strip** — Play/Pause/Replay, speed (cycles `PLAYBACK_SPEEDS`), full screen,
  and previous/next day (jumps to that day's first frame) and frame (`FRAME_DURATION_S`,
  30 fps). On phones it's a 4-column grid (play/speed/full screen on top, steppers below);
  from `md` up it's one row.
- **Keyboard** (when the player is focused): space/k play-pause, left/right step a
  frame, shift+left/right jump a day, f full screen. The hint line only shows on wide
  screens with a hover-capable pointer.
- **Full screen** — the whole player (video, ruler, readout, controls) goes full screen,
  on the paper background. iOS Safari falls back to native video full screen.

The date is read every animation frame while playing rather than from `timeupdate`,
which only fires a few times a second and would skip the short early days.

---

## Page Design

The page borrows from seed catalogs and herbarium sheets rather than app UI: uncoated
paper, near-black ink, hairline rules, a single tomato-red accent, square corners and
no shadows.

- **Masthead** — two-line "The / Garden" title next to a herbarium-style
  specimen label (locality, habitat, collected date range, duration) instead of stat tiles.
  The range and duration come from `TIMELAPSE_SPAN`.
- **Running heads** — each section opens with a full-width ink rule and a mono label.
- **Notes** — a two-column ruled table: tomato of the year and further reading.
- **Photographs** — shown at their natural proportions (width/height from the gallery
  API) in balanced columns: 2 below `lg`, 3 above. Each photo is dealt to the currently
  shortest column so plate numbers ("Pl. 01") read left to right. Both layouts are
  rendered and swapped with CSS. Clicking opens `PhotoLightbox`.

### Theme tokens

Scoped `.garden-theme` in `website/app/globals.css`, tokens prefixed `--g-` (`paper`,
`paper-raised`, `ink`, `ink-soft`, `ink-faint`, `rule`, `tomato`, `on-ink`), with
dark-mode overrides via `prefers-color-scheme`.

Fonts (loaded in `app/layout.tsx`): Libre Caslon Display for the title, date readout and
tomato name (`.garden-display`); Libre Caslon Text for running text (the theme default);
IBM Plex Mono for labels and data (`.garden-mono`). They're declared with `preload: false`
so other pages don't download them; they load once the garden page renders text in them.

---

## Adding New Footage

Do this every time you pull the memory card. The date labels are off between steps 2 and
3, so do those two back to back.

### 1. Pull and compile

```
python scripts/timelapse/compile_timelapse.py --card D:\DCIM\100TLC3C
```

Use whatever drive letter the card mounted as. This needs `ffmpeg` and `ffprobe` on PATH
(`winget install Gyan.FFmpeg`). It's safe to re-run: clips already in the archive are just
re-verified against the card.

Add `--pull-only` to stop after the copy, or leave off `--card` to recompile from what's
already archived. Check the "skipping" lines in the output: an occasional damaged clip is
normal, a whole run of them isn't.

Encoding takes a while and scales with the footage. If anything fails, the previous video
and timestamps are left alone. The video is only replaced after its frame count matches
what the timestamps expect.

It outputs:
- `data/garden-timelapse.mp4` — the new compiled video
- `website/app/garden/timelapse-timestamps.ts` — updated with new date entries

### 2. Replace the video on the Pi

The video is well over Cloudflare's 100 MB request limit, so it can't go through
`api.tyler-schwenk.com` or the admin page's Upload tab (the admin page talks to that same
URL). Swap the file on the Pi's SSD over SSH instead, from the home network. The new file
is checked and moved into place atomically, so the page never goes down and the video
keeps its ID and thumbnail. The database row only needs its size and duration updated.

Run from Git Bash in the `Tylers Website/data` folder:

```bash
PI=tyler@192.168.1.116
VIDEOS=/mnt/ssd/videos
LOCAL_HASH=$(sha256sum garden-timelapse.mp4 | cut -d' ' -f1)
SIZE_BYTES=$(stat -c %s garden-timelapse.mp4)
DURATION_S=$(ffprobe -v error -show_entries format=duration -of csv=p=0 garden-timelapse.mp4 | cut -d. -f1)

scp garden-timelapse.mp4 "$PI:$VIDEOS/.garden-timelapse.new.mp4"
ssh "$PI" "echo '$LOCAL_HASH  $VIDEOS/.garden-timelapse.new.mp4' | sha256sum -c - \
  && chmod 644 $VIDEOS/.garden-timelapse.new.mp4 \
  && mv -f $VIDEOS/.garden-timelapse.new.mp4 $VIDEOS/garden-timelapse.mp4 \
  && docker exec website-backend-api python -c \"import sqlite3; db = sqlite3.connect('/app/data/website_backend.db'); db.execute('update videos set duration=$DURATION_S, file_size=$SIZE_BYTES where slug=\\\"garden-timelapse\\\"'); db.commit()\""
```

If the `garden-timelapse` video doesn't exist on the Pi yet (fresh database), upload it once
to `http://192.168.1.116:8000/videos` instead, see `pi/docs/api/video-api-reference.md`.

### 3. Deploy the website

```
git add website/app/garden/timelapse-timestamps.ts
git commit -m "update garden timelapse timestamps"
git push
```

The GitHub Actions deploy will pick it up automatically.

### 4. Clear the card when it's getting full

The camera writes up to about 100 MB a day to a 16 GB card, so it needs clearing every few
months. A finished pull means everything on the card at that moment is in the archive and
checksummed. Pull once more right before formatting if the camera has kept recording.

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

1. Copy the JPEG to `data/time lapse/before/` and name it sequentially (`4.jpg`, etc.).
   Photos play in filename order, so keep the names in date order.
2. Add an entry to `BEFORE_PHOTO_DATES` in the script. The script stops with an error if
   a photo has no entry.
   ```python
   BEFORE_PHOTO_DATES: dict[str, str] = {
       "1.jpg": "Mar 8, 2026",
       "2.jpg": "Apr 5, 2026",
       "3.jpg": "Apr 11, 2026",
       "4.jpg": "Apr 12, 2026",  # add new entries here
   }
   ```
3. Re-run the script without `--card` and follow the publish steps above.

---

## Garden Photos Gallery

A regular Pi gallery (slug `garden-photos`) feeds the photo grid below the timelapse.
Unlike the timelapse video, this needs no compile step or redeploy — upload a photo via
the admin panel and it shows up on the next page load.

### One-time setup

The gallery only needs to be created once:

1. Go to `https://tyler-schwenk.com/admin` → **Galleries** tab → **+ New Gallery**
2. Name: `Garden Photos`, Slug: `garden-photos` (must match `GARDEN_GALLERY_SLUG` in
   `website/app/garden/page.tsx` exactly)

### Adding photos

1. **Upload** tab → **Photos** → **Existing Gallery** → select `Garden Photos`
2. Select photos and hit Upload

No slug field to fill in for photos — which gallery they land in is controlled entirely
by the "Existing Gallery" dropdown selection, same as any other gallery.

### Why it's not on the main `/gallery` page

Both `garden-photos` and `garden-timelapse` are excluded from the general `/gallery`
page (`EXCLUDED_GALLERY_SLUGS` / `EXCLUDED_VIDEO_SLUGS` in `website/app/gallery/page.tsx`)
so they only appear once, on their dedicated `/garden` page.

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

## Pi Gallery Endpoint

The garden page fetches the photo gallery by slug:
```
GET https://api.tyler-schwenk.com/galleries/slug/garden-photos
```
Returns `{ id, photos: [...], ... }`. Each photo is rendered via:
```
GET https://api.tyler-schwenk.com/galleries/photos/{id}/file             (full size)
GET https://api.tyler-schwenk.com/galleries/photos/{id}/file?thumbnail=true  (grid thumbnail)
```

If the gallery doesn't exist yet or has no photos, the page shows a "coming soon" placeholder.
