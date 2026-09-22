# Maintenance Plan

Working document. Each task below is self-contained and independently
verifiable. Delete this file once every task is checked off — per the repo
docs policy, docs describe how the system works today, not planned changes.

Tasks are ordered so that earlier ones make later ones safer. Do them in
order unless a task says otherwise.

---

## Ground rules for whoever executes this

Read this whole section before touching a file.

1. **Line numbers in this doc will drift.** They were accurate when written.
   Once you edit a file, every line number below it shifts. Always locate
   code by searching for the quoted anchor text, never by jumping to a line
   number.
2. **Read the entire file before editing it.** Repo rule. Non-negotiable for
   the larger files (`PacTylerMapClient.tsx` is 1437 lines).
3. **One task per change set.** Finish a task, verify it, then start the
   next. Do not batch unrelated edits.
4. **Never run git commands.** No commit, no push, no branch, no stash. Make
   the edits and stop. All git operations belong to Tyler.
5. **Verify before marking done.** Every task has a "Verify" block. Run it.
   If it fails, fix it before moving on.
6. **If a task's anchor text is not found**, or the code looks materially
   different from what's quoted here, stop and report it rather than
   improvising. The file changed since this plan was written.
7. **Do not "fix" anything not listed here.** No opportunistic refactors, no
   reformatting, no renaming. Scope creep on a plan like this is how
   regressions get in.
8. **No emojis** anywhere in code, comments, or docs. Repo rule.
9. Comments explain *why*, not *what*. Casual lowercase, contractions fine.
10. Constants carrying units get unit suffixes: `_s`, `_ms`, `_px`, `_m`.

### Baseline commands

Run from `website/`:

```bash
npx tsc --noEmit     # must exit 0, and did at plan time
npx eslint           # 19 errors / 11 warnings at plan time
```

There is no Python test suite and no Python linter configured yet
(see T14). For backend changes, verify by importing the app:

```bash
cd pi/services/website-backend
python -c "from app.main import app; print('ok')"
```

That requires the backend deps installed. If they aren't available locally,
say so in your report rather than skipping verification silently.

---

## Phase 1 — Correctness and guardrails

Do this phase first. T2 is what stops the next T1 from going unnoticed.

### T1. Fix the conditional `useState` crash

**File:** `website/components/PacTylerMapClient.tsx`
**Severity:** high — this can crash the Pac-Tyler page at runtime.

`MonthlyDistanceChart` returns early when `data` is empty, then calls
`useState` after that return. When `data` flips between empty and non-empty
across renders, React throws "Rendered more hooks than during the previous
render" and the page dies. Hooks must run in the same order every render.

Find this block (anchor: `function MonthlyDistanceChart({`):

```tsx
}: MonthlyDistanceChartProps) {
  if (data.length === 0) {
    return null;
  }

  const maxMiles = Math.max(...data.map((point) => point.miles));
  const points = buildChartPoints(data, maxMiles);
  const path = buildChartPath(points);
  const tickIndices = buildTickIndices(data.length);
  const yTickStep = maxMiles / CHART_Y_TICK_COUNT;
  const [hoveredPoint, setHoveredPoint] = useState<{
    key: string;
    label: string;
    miles: number;
    x: number;
    y: number;
  } | null>(null);
```

Replace with — note the `useState` now sits above the early return, and the
derived values move below it:

```tsx
}: MonthlyDistanceChartProps) {
  // must run before any early return -- hooks have to be called in the same
  // order on every render, and this component renders nothing when empty
  const [hoveredPoint, setHoveredPoint] = useState<{
    key: string;
    label: string;
    miles: number;
    x: number;
    y: number;
  } | null>(null);

  if (data.length === 0) {
    return null;
  }

  const maxMiles = Math.max(...data.map((point) => point.miles));
  const points = buildChartPoints(data, maxMiles);
  const path = buildChartPath(points);
  const tickIndices = buildTickIndices(data.length);
  const yTickStep = maxMiles / CHART_Y_TICK_COUNT;
```

**Verify:** `npx eslint components/PacTylerMapClient.tsx` reports no
`react-hooks/rules-of-hooks` error. `npx tsc --noEmit` exits 0.

---

### T2. Make CI actually check the code

**File:** `.github/workflows/deploy.yml`

The workflow installs deps, builds, and deploys. It never type-checks or
lints, which is how 19 lint errors accumulated unnoticed. Add both steps
between "Install dependencies" and "Build with Next.js".

Find the anchor `- name: Install dependencies` and insert after that step's
`run:` line:

```yaml
      - name: Type check
        working-directory: ./website
        run: npm run type-check

      - name: Lint
        working-directory: ./website
        run: npm run lint
```

Keep the existing indentation (6 spaces before `- name`). Do not change any
other step.

Note this gates deploys: once merged, a type error or lint *error* fails the
build and the site does not deploy. That is the point. Warnings do not fail
the build.

**Verify:** the file is valid YAML —
`python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('ok')"`.
Confirm the two new steps sit inside the `build` job's `steps:` list, at the
same indent level as the steps around them.

---

### T3. Triage the `set-state-in-effect` lint errors

**File:** `website/eslint.config.mjs`

**Read this reasoning before acting — do not skip to the edit.**

Of the 19 lint errors, 18 are `react-hooks/set-state-in-effect` (the other is
T1). This rule ships with the React 19 compiler and it is flagging two
patterns here that are *not* actually bugs:

- `components/Footer.tsx` picks a random fun fact in a mount effect. Doing
  that during render instead would produce a server/client hydration
  mismatch. The effect is the correct pattern.
- The fetch effects in `app/gallery/page.tsx`, `app/garden/page.tsx`,
  `app/public-square/page.tsx`, `app/public-square/thread/page.tsx`, and
  `app/projects/ribbit-radar/page.tsx` call `setLoading(true)` before an
  async fetch. Restructuring these properly means moving to a data-fetching
  library or `use()` + Suspense, which is a real refactor, not a lint fix.

So: **do not rewrite these components.** Downgrade the rule to a warning so
CI (T2) gates on genuine errors, and leave the refactor as future work.

Find the anchor `const eslintConfig = defineConfig([` and change the array
so the rule override comes after the two spread configs:

```js
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // the react compiler flags every setState-in-effect, including two
      // patterns we want: Footer's random fact (doing it during render
      // would cause a hydration mismatch) and the setLoading(true) that
      // precedes each page's async fetch. warn so CI still gates on real
      // errors; revisit if we ever move fetching to Suspense.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
```

**Verify:** `npx eslint` exits with **0 errors**. Warnings are expected and
fine. If any error remains, it is a real one — report it, do not silence it.

---

### T4. Clear the unused-variable warnings

Mechanical cleanup. Delete each unused binding, or prefix it with `_` if it's
a deliberately-ignored destructured value. Do not delete anything that turns
out to be referenced elsewhere in the file — check first.

| File | Anchor |
| --- | --- |
| `website/app/events/data.ts` | `RSVP_NOTE_COMING_SOON`, `LOCATION_TBD`, `LOCATION_FLIER` |
| `website/app/events/techno/page.tsx` | unused import on line ~5, plus two unused consts |
| `website/app/gallery/page.tsx` | unused `Image` import on line 1 |
| `website/app/mallard/confirm/page.tsx` | unused destructured value ~line 5 |
| `website/app/projects/others/page.tsx` | two unused imports ~lines 4-5 |

Run `npx eslint <file>` on each to see the exact name and line.

For `app/events/data.ts` specifically: those three consts look like they were
written for event entries that no longer use them. Confirm with
`grep -n "RSVP_NOTE_COMING_SOON\|LOCATION_TBD\|LOCATION_FLIER" app/events/data.ts`
— if the only hit is the declaration, delete it.

**Verify:** `npx eslint` shows no `@typescript-eslint/no-unused-vars`
warnings. `npx tsc --noEmit` exits 0.

---

## Phase 2 — Shared frontend API module

### T5. Create `website/lib/api.ts`

`API_BASE = "https://api.tyler-schwenk.com"` is currently declared in seven
files and inlined in two more. Changing the API host means nine edits, and
it makes pointing the frontend at a local backend impossible.

Create a new file `website/lib/api.ts`:

```ts
/**
 * Shared base URL and URL builders for the fart-pi backend API.
 *
 * Everything that talks to the backend imports from here so the host lives
 * in exactly one place. Set NEXT_PUBLIC_API_BASE at build time to point a
 * local dev build at a local backend.
 */

/** Backend API origin. Overridable for local development. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://api.tyler-schwenk.com";

/**
 * Build the URL for a gallery photo file.
 * @param photoId - Gallery photo ID.
 * @param thumbnail - Request the thumbnail instead of the original.
 * @returns Absolute URL to the image.
 */
export function photoUrl(photoId: number, thumbnail = false): string {
  const params = thumbnail ? "?thumbnail=true" : "";
  return `${API_BASE}/galleries/photos/${photoId}/file${params}`;
}

/**
 * Build the URL for a recipe photo file.
 * @param photoId - Recipe photo ID.
 * @param thumbnail - Request the thumbnail instead of the original.
 * @returns Absolute URL to the image.
 */
export function recipePhotoUrl(photoId: number, thumbnail = false): string {
  const params = thumbnail ? "?thumbnail=true" : "";
  return `${API_BASE}/recipes/photos/${photoId}/file${params}`;
}

/**
 * Build the streaming URL for a video.
 * @param videoId - Video ID.
 * @returns Absolute URL to the video stream.
 */
export function videoStreamUrl(videoId: number): string {
  return `${API_BASE}/videos/${videoId}/stream`;
}

/**
 * Build the thumbnail URL for a video.
 * @param videoId - Video ID.
 * @returns Absolute URL to the video thumbnail.
 */
export function videoThumbnailUrl(videoId: number): string {
  return `${API_BASE}/videos/${videoId}/thumbnail`;
}
```

The `@/*` path alias already maps to the website root, so imports are
`import { API_BASE } from "@/lib/api";`.

**Verify:** `npx tsc --noEmit` exits 0.

---

### T6. Migrate every caller to the shared module

Replace the local declarations with imports. **One file at a time**, running
`npx tsc --noEmit` after each. Do not change any fetch logic, error
handling, or URL paths — this is a pure move.

| File | Remove | Replace with |
| --- | --- | --- |
| `app/gallery/page.tsx` | `const API_BASE = ...` and the local `photoUrl` function | `import { API_BASE, photoUrl, videoStreamUrl, videoThumbnailUrl } from "@/lib/api";` |
| `app/gallery/people/[category]/page.tsx` | `const API_BASE = ...` | `import { API_BASE, photoUrl } from "@/lib/api";` |
| `app/garden/page.tsx` | `const API_BASE = ...` | `import { API_BASE, photoUrl, videoStreamUrl } from "@/lib/api";` |
| `app/public-square/page.tsx` | `const API_BASE = ...` | `import { API_BASE } from "@/lib/api";` |
| `app/public-square/thread/page.tsx` | `const API_BASE = ...` | `import { API_BASE } from "@/lib/api";` |
| `components/EventRsvpForm.tsx` | `const API_BASE = ...` | `import { API_BASE } from "@/lib/api";` |
| `components/kitchen/types.ts` | `export const API_BASE = ...` and the local `recipePhotoUrl` | re-export from `@/lib/api` (see below) |
| `components/BikeQuiver.tsx` | `const ACTIVITIES_API_URL = "https://api.tyler-schwenk.com/pac-tyler/activities";` | `` const ACTIVITIES_API_URL = `${API_BASE}/pac-tyler/activities`; `` plus the import |
| `components/PacTylerMapClient.tsx` | `const ACTIVITY_DATASET_URL = "https://api.tyler-schwenk.com/pac-tyler/activities";` and the inlined `"https://api.tyler-schwenk.com/pac-tyler/geojson"` in `loadGeoJSON` | named constants built from `API_BASE` (see below) |

Notes on the two awkward ones:

**`components/kitchen/types.ts`** — several kitchen components import
`API_BASE` and `recipePhotoUrl` from `./types`. Don't touch those importers.
Keep the names working by re-exporting:

```ts
export { API_BASE, recipePhotoUrl } from "@/lib/api";
```

Delete the old `const API_BASE` and the old `recipePhotoUrl` function from
that file. Leave `ADMIN_TOKEN_STORAGE_KEY` and the type definitions alone.

**`components/PacTylerMapClient.tsx`** — this file already keeps a tidy block
of named constants at the top. Follow that existing style:

```ts
const ACTIVITY_DATASET_URL = `${API_BASE}/pac-tyler/activities`;
const ACTIVITY_GEOJSON_URL = `${API_BASE}/pac-tyler/geojson`;
```

Then in `loadGeoJSON`, replace the inline fetch URL:

```tsx
        const response = await fetch(ACTIVITY_GEOJSON_URL);
```

**Verify after each file:** `npx tsc --noEmit` exits 0.
**Verify at the end:**

```bash
grep -rn "api.tyler-schwenk.com" --include="*.tsx" --include="*.ts" app components lib
```

The only hit should be the fallback inside `lib/api.ts`. Then run
`npm run build` and confirm it succeeds.

---

## Phase 3 — Backend cleanup

### T7. Add logging to the videos router

**File:** `pi/services/website-backend/app/routers/videos.py`

This is the only router with no logger, and it swallows every exception
silently. When ffprobe fails on the Pi you get a video with no dimensions
and no trace of why. Repo rule: always catch and log errors with context.

Add after the existing imports:

```python
import logging

logger = logging.getLogger(__name__)
```

Add a named constant next to `SUPPORTED_VIDEO_TYPES` — the bare `timeout=30`
appears twice:

```python
# ffprobe/ffmpeg can hang on a corrupt file, so cap how long we wait
FFMPEG_TIMEOUT_S = 30
```

Then in `extract_video_metadata`, replace `timeout=30` with
`timeout=FFMPEG_TIMEOUT_S` and replace:

```python
    except Exception:
        return {}
```

with:

```python
    except Exception as e:
        logger.warning("ffprobe failed for %s: %s", video_path.name, e)
        return {}
```

Also log the non-zero exit path in the same function:

```python
        if result.returncode != 0:
            logger.warning(
                "ffprobe exited %s for %s: %s",
                result.returncode, video_path.name, result.stderr.strip(),
            )
            return {}
```

In `generate_video_thumbnail`, replace `timeout=30` with
`timeout=FFMPEG_TIMEOUT_S` and replace:

```python
    except Exception:
        return False
```

with:

```python
    except Exception as e:
        logger.warning("thumbnail generation failed for %s: %s", video_path.name, e)
        return False
```

**Verify:** `python -c "from app.routers import videos; print('ok')"` from
`pi/services/website-backend`.

---

### T8. Remove the duplicated `save_upload_file`

**File:** `pi/services/website-backend/app/routers/videos.py`

`videos.py` defines `save_upload_file` identically to the one already
exported by `app/image_utils.py`. Delete the local copy and import the
shared one.

Delete this whole function from `videos.py`:

```python
def save_upload_file(upload_file: UploadFile, destination: Path) -> None:
    """
    Save uploaded file to destination path.
    
    Args:
        upload_file: The uploaded file object
        destination: Path where file should be saved
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
```

Add to the imports:

```python
from app.image_utils import save_upload_file
```

Then check whether `shutil` is still used anywhere in `videos.py`
(`grep -n "shutil" app/routers/videos.py`). If the only remaining reference
was in the deleted function, remove the `import shutil` line too.

**Verify:** `python -c "from app.routers import videos; print('ok')"` and
`grep -c "def save_upload_file" app/routers/videos.py` returns 0.

---

### T9. Drop the dead `fastapi-users` dependency

**Files:** `pi/services/website-backend/app/models.py`,
`pi/services/website-backend/requirements.txt`

`User` inherits `SQLAlchemyBaseUserTable[int]` and then redefines every
column that base class provides — `id`, `email`, `hashed_password`,
`is_active`, `is_superuser`, `is_verified`. The base contributes nothing.
Auth is hand-rolled with bcrypt and jose in `routers/auth.py`.

**Before editing, capture the current schema so you can prove it doesn't
change.** From `pi/services/website-backend`:

```bash
python -c "from app.models import User; print(sorted(User.__table__.columns.keys()))"
```

Save that output.

In `models.py`, remove the import:

```python
from fastapi_users.db import SQLAlchemyBaseUserTable
```

and change the class declaration:

```python
class User(Base):
```

Update the docstring, which currently says "Extends FastAPI-Users base
table with additional fields" — that stops being true:

```python
    """
    User model for authentication and profile.

    In practice the only account that ever gets created is the single site
    admin (see auth.py) -- Public Square posts/comments are anonymous and
    don't link back to this table.
    """
```

In `requirements.txt`, delete these two lines:

```
fastapi-users[sqlalchemy]==12.1.3
fastapi-users-db-sqlalchemy==6.0.1
```

Leave the `# Authentication` comment and the `python-jose` / `bcrypt` lines
in place.

**Verify:** re-run the column dump above. **The sorted column list must be
byte-identical to what you captured.** If it differs, revert the change and
report what changed — do not try to patch the difference.

---

### T10. Remove the unused `alembic` dependency

**File:** `pi/services/website-backend/requirements.txt`

There is no `alembic/` directory, no `alembic.ini`, and no import anywhere.
Schema comes from `Base.metadata.create_all` in `app/database.py` plus the
ad-hoc scripts in `scripts/`.

Delete the line:

```
alembic==1.13.1
```

**Do not remove** `email-validator` (used via `EmailStr` in `app/schemas.py`)
or `httpx` (used by `scripts/migrate_photos.py`, which runs inside the
container via the mounted `scripts/` volume). Both are load-bearing.

**Verify:** `grep -rn "alembic" pi/services/website-backend/` returns
nothing.

---

### T11. Fix the deprecated APIs

Three calls that still work but are deprecated and will break on the next
major upgrade.

**`app/main.py`** — `datetime.utcnow()` is deprecated as of Python 3.12. The
rest of the codebase already uses the timezone-aware form.

Change the import:

```python
from datetime import datetime, timezone
```

and in `health_check`:

```python
        timestamp=datetime.now(timezone.utc)
```

**`app/database.py`** — legacy import path on SQLAlchemy 2.0 (pinned 2.0.25).

Replace:

```python
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
```

with:

```python
from sqlalchemy.orm import declarative_base, sessionmaker
```

**`app/config.py`** — pydantic-settings v2 wants `SettingsConfigDict`.

Replace:

```python
    class Config:
        env_file = ".env"
        case_sensitive = True
```

with a `model_config` assignment. Put it at the **top** of the class body,
directly under the class docstring (not at the bottom where `class Config`
sits now):

```python
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)
```

and update the import at the top of the file:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
```

**Verify:** `python -c "from app.main import app; from app.config import settings; print(settings.API_VERSION)"`
prints `1.0.0`. Confirm `settings.cors_origins_list` still parses by running
`CORS_ORIGINS=a,b python -c "from app.config import Settings; ..."` or just
eyeball that the property is untouched.

---

### T12. Pull the JPEG quality magic number into settings

**Files:** `pi/services/website-backend/app/config.py`,
`pi/services/website-backend/app/image_utils.py`

`image_utils.py` hardcodes `{"quality": 90}` for the JPEG re-encode while
`THUMBNAIL_QUALITY` already exists as a setting right beside it.

In `config.py`, under the `# Photo Storage` block, add:

```python
    # quality for re-encoding HEIC/rotated uploads to JPEG (distinct from
    # THUMBNAIL_QUALITY -- this one is the full-size image, so it's higher)
    UPLOAD_JPEG_QUALITY: int = 90
```

In `image_utils.py`, replace:

```python
                save_kwargs = {"quality": 90} if target_format == "JPEG" else {}
```

with:

```python
                save_kwargs = (
                    {"quality": settings.UPLOAD_JPEG_QUALITY}
                    if target_format == "JPEG"
                    else {}
                )
```

While in this file, also fix the type hint on `create_thumbnail` — `size:
tuple = None` is not valid under strict typing:

```python
def create_thumbnail(
    image_path: Path, thumbnail_path: Path, size: Optional[tuple[int, int]] = None
) -> None:
```

and add `from typing import Optional` to the imports.

**Verify:** `python -c "from app.image_utils import create_thumbnail; from app.config import settings; print(settings.UPLOAD_JPEG_QUALITY)"` prints `90`.

---

### T13. Fix the N+1 query in `list_galleries`

**File:** `pi/services/website-backend/app/routers/gallery.py`

`list_galleries` runs a separate `COUNT` query per gallery inside a Python
loop. `app/routers/public_square.py` already solves the identical problem
correctly in `_attach_comment_counts` — read that function first and mirror
its approach.

Replace the loop (anchor: `# Add photo count to each gallery`):

```python
    # Add photo count to each gallery
    result = []
    for gallery in galleries:
        gallery_dict = GalleryRead.model_validate(gallery).model_dump()
        photo_count = db.query(func.count(GalleryPhoto.id)).filter(
            GalleryPhoto.gallery_id == gallery.id
        ).scalar()
        gallery_dict["photo_count"] = photo_count
        result.append(GalleryRead(**gallery_dict))
    
    return result
```

with one grouped count for the whole page:

```python
    # one grouped COUNT for the whole page instead of one query per gallery
    gallery_ids = [gallery.id for gallery in galleries]
    counts = dict(
        db.query(GalleryPhoto.gallery_id, func.count(GalleryPhoto.id))
        .filter(GalleryPhoto.gallery_id.in_(gallery_ids))
        .group_by(GalleryPhoto.gallery_id)
        .all()
    )

    result = []
    for gallery in galleries:
        gallery_dict = GalleryRead.model_validate(gallery).model_dump()
        gallery_dict["photo_count"] = counts.get(gallery.id, 0)
        result.append(GalleryRead(**gallery_dict))

    return result
```

Note `counts.get(gallery.id, 0)` — galleries with no photos are absent from
the grouped result and must still report 0.

**Verify:** `python -c "from app.routers import gallery; print('ok')"`. If
you can run the API locally, `GET /galleries` should return the same
`photo_count` values as before, including `0` for any empty gallery.

---

## Phase 4 — Pac-Tyler archive mode

Strava restricted API access to premium accounts in June 2026, so the
free-tier token this project used no longer works. `website/docs/PAC_TYLER_GUIDE.md`
and `pi/services/pac-tyler-updater/README.md` already document the pause —
**read both before starting this phase.**

The goal is to stop the repo from re-enabling a daily job that cannot
succeed, and to make the archived state obvious in code rather than only in
prose. The serving path (backend router + frontend fetch) is independent of
the updater and keeps working against the frozen files on the Pi, so
**do not touch the frontend map or the API endpoints.** The data stays live
at `/pac-tyler/geojson` and `/pac-tyler/activities`.

Tyler still plans one final manual run when he leaves San Diego, so
**do not delete `main.py`, `auth_setup.py`, `config.py`, or `utils/`.** The
updater must remain runnable by hand.

### T14. Neutralize the systemd timer in the repo

**File:** `pi/services/pac-tyler-updater/pac-tyler-updater.timer`

The timer on fart-pi is already disabled, but the repo still ships
`OnCalendar=*-*-* 03:00:00` with `Persistent=true`. Anyone re-provisioning
from this repo silently restores a daily job that will fail every night and
fill the journal with errors.

Replace the file's contents entirely:

```ini
# ARCHIVED -- do not enable.
#
# Strava restricted API access to premium accounts in June 2026, so the
# free-tier token this service used no longer authenticates. The timer is
# disabled on fart-pi and this unit is kept only as a record of the schedule
# it used to run on. Re-enabling it just produces a nightly auth failure.
#
# The updater is still runnable by hand for the final data capture:
#   systemctl start pac-tyler-updater.service
# or directly:
#   /home/tyler/pac-tyler-venv/bin/python main.py
#
# See README.md in this directory for the full status.

[Unit]
Description=Run Pac-Tyler updater daily (ARCHIVED -- disabled, see README)

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Leave `pac-tyler-updater.service` alone — it's what the manual run uses.

**Verify:** the file still parses as an INI-style unit (comments with `#` at
line start are valid). Confirm `pac-tyler-updater.service` is unmodified.

---

### T15. Make `main.py` fail fast with a useful message

**File:** `pi/services/pac-tyler-updater/main.py`

Right now a run with a dead token logs "No valid token at ..., run
auth_setup.py once to authorize" — which sends whoever runs it down a path
that cannot work any more, since re-authorizing requires a premium Strava
account.

In `main()`, find the anchor `if not strava.authenticate_from_token_file(TOKEN_FILE):`
and replace the error message:

```python
    if not strava.authenticate_from_token_file(TOKEN_FILE):
        logging.error(
            "No valid Strava token at %s. Note that as of June 2026 Strava "
            "restricts API access to premium accounts, so re-running "
            "auth_setup.py only works if the account has premium. This "
            "project is archived -- see README.md. Existing data on the site "
            "is served from the last successful run and is unaffected.",
            TOKEN_FILE,
        )
        return None
```

Do not change any other logic in `main.py`. The fetch path must stay intact
for the final manual run.

**Verify:** `python -c "import ast; ast.parse(open('main.py').read()); print('ok')"`
from the `pac-tyler-updater` directory.

---

### T16. Correct the stale "daily" language in the backend router

**File:** `pi/services/website-backend/app/routers/pac_tyler.py`

The module docstring says the updater writes the files "daily", and the 503
message says "The updater may not have run yet" — both misleading now.

Replace the module docstring:

```python
"""
Pac-Tyler router for serving Strava activity data.

Serves the GeoJSON track file and derived activity dataset produced by the
pac-tyler-updater. That updater is archived (Strava cut off free-tier API
access in June 2026), so these files are a frozen snapshot rather than a
daily feed. Data lives at PAC_TYLER_DATA_DIR on the host, mounted into the
container as a read-only volume.
"""
```

And in `_get_data_file`, replace the 503 detail:

```python
        raise HTTPException(
            status_code=503,
            detail=(
                f"{filename} is not available on the server. This data is an "
                "archived snapshot -- check that PAC_TYLER_DATA_DIR is mounted."
            ),
        )
```

Update the docstring's `Raises:` line to match:

```
        HTTPException: 503 if the archived data file is missing from disk.
```

**Verify:** `python -c "from app.routers import pac_tyler; print('ok')"` from
`pi/services/website-backend`.

---

### T17. Clean up the stale pac-tyler doc lines

**File:** `website/docs/PAC_TYLER_GUIDE.md`

The status note at the top is accurate and current. Three lines further down
still contradict it:

- Line ~19: `- **Service**: pi/services/pac-tyler-updater/ — daily Python script on fart-pi`
  → change "daily Python script" to "archived Python script, run manually"
- Line ~154: `- Data updates daily without any website rebuild or deployment`
  → reword to describe how it works today, e.g. "Data is served from the API
  at runtime, so refreshing it needs no website rebuild or deployment (the
  dataset is currently frozen — see Status above)"
- Line ~328: `*Last Updated: December 2025*` → this contradicts the June 2026
  status note. Either update it to the current date or delete the line.
  Prefer deleting it; the repo docs policy says not to track change history.

Do not rewrite the rest of the guide.

**Verify:** `grep -niE "updates daily|daily python script|Last Updated" website/docs/PAC_TYLER_GUIDE.md`
returns nothing.

---

### T18. Delete the orphaned activity snapshot

**File:** `website/data/pac-tyler-activities.json` (131 KB)

This is a snapshot generated 2026-01-28 that nothing imports — the map
fetches live from the API instead. It's stale by months and misleading to
anyone who finds it.

**Confirm it's genuinely unreferenced before deleting:**

```bash
cd website
grep -rn "pac-tyler-activities" --include="*.tsx" --include="*.ts" --include="*.json" app components lib data
```

If the only hit is the file itself, delete it. **If anything imports it,
stop and report** — do not delete.

**Verify:** `npm run build` succeeds after the deletion.

---

## Phase 5 — Repo hygiene

### T19. Remove stray files

Each of these is independent. Confirm the check before each deletion.

1. **`website/app/retro/`** — empty directory, leftover. Next.js App Router
   treats directories as routes, so an empty one is pure noise. Confirm
   `ls -A website/app/retro` shows nothing, then remove the directory.

2. **`website/convert_gallery_heic.py`** — a one-off Python script sitting in
   the Next.js project root. Move it to `scripts/convert_gallery_heic.py`.
   Note its `gallery_dir = Path("public/images/gallery")` is relative to the
   old location — update it to `Path("website/public/images/gallery")` and
   add a line to its module docstring saying it's run from the repo root.

3. **`!!!!!!!!!!!!!ideas.txt`** — a scratch notes file committed at the repo
   root. Do not delete it; it's Tyler's notes. Leave it and flag it in your
   report as something he may want to move into a doc or a gitignored file.

**Verify:** `npm run build` from `website/` still succeeds after (1) and (2).

---

### T20. Pin the unpinned Python service dependencies

**Files:** `pi/services/mallard-counter/requirements.txt`,
`pi/services/pac-tyler-updater/requirements.txt`,
`pi/services/trash-reminder/requirements.txt`

Only `website-backend` pins versions. The other three are bare package
names, so a rebuild on the Pi can pull anything — which conflicts with the
repo rule that code be deterministic and reproducible.

**This task needs the actual installed versions from fart-pi, which you
cannot reach from here.** Do not guess version numbers.

Instead: leave the files unchanged and write the exact commands Tyler needs
to run on the Pi into your final report, so he can paste the output back:

```bash
# on fart-pi, for each service venv
/home/tyler/pac-tyler-venv/bin/pip freeze | grep -iE "stravalib|requests|geopy|python-dotenv"
```

Then the pinning can be done in a follow-up with real numbers.

---

## Phase 6 — Tooling foundation

### T21. Add a ruff config for the Python code

`CLAUDE.md` mandates running `ruff` or `mypy` on changed Python files, but
neither is configured anywhere in the repo, so the rule can't be followed.

Create `pi/pyproject.toml`:

```toml
[tool.ruff]
line-length = 100
target-version = "py311"
exclude = [".venv", "__pycache__"]

[tool.ruff.lint]
# E/F = pycodestyle + pyflakes, I = import sorting, B = common bugs,
# UP = flag deprecated syntax for the python version above
select = ["E", "F", "I", "B", "UP"]
ignore = [
    # long lines are caught by the formatter, not worth failing on
    "E501",
]
```

`target-version = "py311"` matches the backend Dockerfile's
`FROM python:3.11-slim`.

Then run `ruff check pi/` and **report the findings without fixing them** —
that's a separate task with its own review. Do not run `ruff check --fix`.

**Verify:** `ruff check pi/ --statistics` runs without a config error.

---

## Out of scope

Deliberately not in this plan. Do not attempt these.

- **Rewriting the fetch effects to Suspense / a data library.** T3 explains
  why these are deferred. It's a real refactor needing design decisions.
- **Adding a test suite.** There are currently zero tests. Worth doing, but
  it's a project, not a cleanup task, and it needs Tyler's call on framework
  and what to cover first.
- **Replacing `python-jose`.** The pinned 3.3.0 has open advisories and the
  project is lightly maintained; `pyjwt` is the usual migration. It touches
  auth, so it needs testing against a real login flow, not a blind swap.
- **Running the backend as non-root in Docker.** The Dockerfile has no
  `USER` directive. Reasonable hardening, but it interacts with the volume
  mounts and file ownership on the Pi — needs testing on hardware.
- **Any git operation.** Not yours to run.

---

## Final report

When you've worked through the phases, report:

1. Which tasks you completed, and which you skipped or couldn't verify.
2. The output of `npx tsc --noEmit` and `npx eslint` from `website/`.
3. Anything where the code didn't match this plan's anchors.
4. The `pip freeze` commands from T20 for Tyler to run on the Pi.
5. Any `ruff` findings from T21, unfixed.

Then stop. Do not commit.
