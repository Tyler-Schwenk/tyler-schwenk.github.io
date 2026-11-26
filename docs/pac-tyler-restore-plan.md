# Pac-Tyler Restore Plan

Working document. Not built yet. Delete this file once it's done and the real
docs (`pi/services/pac-tyler-updater/README.md`, `website/docs/PAC_TYLER_GUIDE.md`)
describe the new setup -- per the repo docs policy, docs describe how the
system works today, not planned changes.

## Goal

Get Pac-Tyler updating again without the Strava API. Same page, same map,
same two files, same two endpoints. The only thing that changes is where the
ride data comes from: GPX files recorded on Tyler's phone instead of a
Strava pull.

Out of scope for now: live position tracking, new pages, new features. Rides
are only handled after the fact.

## Why the Strava API route is dead

Strava put its whole developer API behind a paid subscription in June 2026
(new apps June 1, existing apps by June 30). That covers reading activities
and uploading them, so a free account can't pull rides and can't push them
either. Device makers (Garmin etc.) are exempt, which is what makes the
Garmin option below interesting.

## How Pac-Tyler works today

```
Strava API --> pac-tyler-updater (main.py, systemd timer, now disabled)
           --> /home/tyler/pac-tyler-data/cleaned_output.geojson
           --> /home/tyler/pac-tyler-data/pac-tyler-activities.json
           --> website-backend serves them (read-only mount at /app/pac-tyler)
               GET /pac-tyler/geojson, GET /pac-tyler/activities
           --> PacTylerMapClient.tsx and BikeQuiver.tsx on the site
```

Data is frozen at activities through 2026-06-30.

## New flow

```
GPSLogger on Tyler's Android phone records the ride, saves a GPX file
  --> phone auto-sends the GPX to fart-pi (SFTP over Tailscale)
  --> lands in /home/tyler/pac-tyler-data/inbox/
  --> pac-tyler-updater (timer re-enabled) ingests new files from the inbox
  --> same cleaned_output.geojson + pac-tyler-activities.json as before
  --> backend and website unchanged
```

Why this shape:

- The backend stays untouched. It keeps its read-only mount and doesn't need
  an upload endpoint, a writable volume or new auth.
- The updater already does the hard part: dedupe, split at pauses, clean,
  write both files. Only the source of activities changes, from
  `strava_client.iter_detailed_activities()` to "parse the GPX files in the
  inbox".
- Nothing to do by hand after a ride. Finish the ride in GPSLogger and it
  shows up on the site at the next timer run.

## Phone: GPSLogger

GPSLogger (https://gpslogger.app) is open source, on F-Droid and the Play
Store, and runs in the background with the screen off. Nothing to sideload.

Settings to use:

- Log to GPX, one file per session (start/stop logging = one ride).
- Time-based logging around 1 s with a small distance filter, so the track
  looks like Strava's and not like a sparse breadcrumb trail. Check battery
  on a long ride and loosen it if needed.
- Auto send: SFTP to fart-pi via its Tailscale name
  (`fart-pi.taila4ff35.ts.net`), into `/home/tyler/pac-tyler-data/inbox/`,
  "send when logging stops". The phone needs to be on the tailnet. Use a
  dedicated SSH key for the phone. Fallback if SFTP is a pain: drop files
  into the inbox by hand with `scp`, or add an upload box to `/admin` later.

## Updater changes (`pi/services/pac-tyler-updater/`)

1. **New `utils/gpx_source.py`.** Reads `.gpx` files from the inbox and
   returns the same activity dicts `activities_to_geojson()` already takes
   (`id`, `name`, `date`, `distance`, `type`, `coordinates` as [lat, lon]):
   - `id`: a stable ID per file, for example `gpx-<start time UTC>`, so a file
     dropped twice dedupes through the existing `build_activity_key()`.
   - `name`: Strava-style from the start time ("Morning Ride", "Afternoon
     Ride", ...), so the popups look like the old ones.
   - `distance`: summed haversine over the points, in meters (`geopy` is
     already a dependency).
   - `type`: "Ride" by default. GPX from GPSLogger has no activity type.
   - Use `gpxpy` to parse instead of hand-rolling XML.
2. **Processed files move to `inbox/processed/`** after a successful merge, so
   reruns are cheap and idempotent. Files that fail to parse go to
   `inbox/failed/` with a logged reason instead of blocking the run.
3. **`main.py`** drops the Strava auth and fetch, and runs the inbox
   ingest through the existing `process_activity_batch()` path. Keep the
   "always re-clean and re-save" step.
4. **Remove the Strava-only code** once the new path works: `auth_setup.py`,
   `utils/oauth_server.py`, `utils/strava_client.py` (move
   `activities_to_geojson()` and `is_valid_coordinate()` somewhere neutral
   first), Strava constants in `config.py`, `stravalib` in
   `requirements.txt`.
5. **Re-enable `pac-tyler-updater.timer`.** Daily like before, or more often
   now that runs are cheap.
6. **Docs:** rewrite the updater README and the "Data Updates Paused"
   section of `website/docs/PAC_TYLER_GUIDE.md`, update the router docstring
   in `website-backend/app/routers/pac_tyler.py` (it says the data is a
   frozen snapshot), and update the site copy that says the data comes from
   Strava.

## Backfilling July to November 2026

Rides recorded on Strava after 2026-06-30 never got pulled. The API can't get
them, but Strava's free account data export can: strava.com > Settings > My
Account > Download or Delete Your Account > "Download Request". It emails a
zip with `activities.csv` and an `activities/` folder of the original files
(`.gpx`, `.fit`, `.fit.gz`).

- Make the ingest also read `.fit` / `.fit.gz` (`fitdecode` or `fitparse`),
  since most Strava originals are FIT.
- For backfill files, use the Strava activity ID from `activities.csv` as
  `id`, and the name and type from the same row. Then the keys match the
  features already in the GeoJSON and anything already there dedupes
  instead of doubling up.
- One-off script or a `--backfill <export dir>` flag. Run it once.

This also replaces the old "run main.py one last time when moving out of San
Diego" plan, which can't work without a paid account anyway.

## Getting rides onto Strava too

The phone already has the original GPX, so Pac-Tyler doesn't need to export
anything. Two options, starting with the first:

### Option A: upload by hand on strava.com (now)

Strava's website still takes file uploads for free: strava.com > "+" >
Upload activity > File (on a phone, use the browser's desktop-site mode).
Pick the GPX GPSLogger saved and set the type to Ride. About 20 seconds per
ride and it can't break. If Strava ever gets a paid subscription, this can
become an automatic upload through the API from the updater.

### Option B: Garmin Connect as a free bridge (later, maybe)

Idea: upload the file to a free Garmin Connect account, and Garmin's own
Strava link (exempt from the paywall) forwards it to Strava. Fully
automatic, no Strava subscription.

What's known (researched 2026-11-25):

- Garmin's Strava link forwards new activities automatically. Nobody clearly
  confirms that files *imported* on connect.garmin.com get forwarded the
  same way as watch recordings. Probably yes, but unproven.
- Garmin has no free personal upload API (its official API is for business
  partners), so automating means the unofficial `python-garminconnect`
  library, which logs in like the app does. Garmin changed its login in March
  2026: `garth` broke and is deprecated, and `python-garminconnect` broke and
  then got workarounds (`curl_cffi`, multiple login strategies). There's a
  maintained fork, `garth-ng`. Some users got their logins rate-limited for
  48+ hours. Expect it to break again now and then.
- Scripted logins are against Garmin's and Strava's terms. Low stakes for a
  personal account, but it's a grey area. Scripting Strava's own upload page
  in a headless browser is worse on both counts (captcha, more fragile, more
  clearly against the rules), so it's not an option.

Steps if trying it:

1. **Manual test first, no code.** Make a free Garmin account, link Strava
   in Garmin Connect, import one GPSLogger GPX on connect.garmin.com, and see
   whether it appears on Strava. If it doesn't, Option B is dead -- stop.
2. If it works, add an optional step after ingest: upload each newly
   ingested file to Garmin with `python-garminconnect`, and record what's
   been sent in a small `garmin_sent.json` in the data dir so reruns don't
   double-post. Credentials go in the updater's `.env`, never in the repo.
3. A failed Garmin upload must never block the Pac-Tyler update. Log it
   with a clear reason, leave the file unsent, retry next run, and fall back
   to Option A.
4. Use a Garmin account where a lockout doesn't matter.

## Order

1. GPSLogger set up on the phone, test ride, look at the GPX.
2. `gpx_source.py` + `main.py` changes, run locally against a copy of the
   data dir.
3. Phone-to-Pi SFTP auto-send over Tailscale.
4. Deploy to fart-pi, re-enable the timer.
5. Backfill July to November from the Strava export.
6. Remove Strava code, update docs and site copy.
7. Option A from now on. Option B test whenever.

## Open questions

- Is the Pac-Tyler challenge itself (every street in San Diego) still the
  framing after the move, or does the map just keep collecting every ride?
  The map is San Diego-centered today.
- Strava hid the start and end near home on public views. Pac-Tyler never
  did (the API gave the owner full tracks), so this restore keeps it that
  way. Adding a privacy zone around home is easy later if wanted.
