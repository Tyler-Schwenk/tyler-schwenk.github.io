# DJ Stream

Whatever's playing out of rekordbox on the DJ laptop streams live to the Opium Den's live
section (`tyler-schwenk.com/opium-den/live`), and every session gets recorded and listed
there as a past set. Streaming starts by itself when there's sound and stops after a stretch of
silence, so practicing is all it takes to go live.

## How it fits together

```
rekordbox (DDJ-400 master, also sent to the laptop's own output by PC MASTER OUT)
  -> butt on the laptop: captures that output, mp3 192 kbps, auto start/stop on signal
  -> icecast on fart-pi (dj-stream-icecast, host port 8010, LAN + tailnet only)
  -> website backend (website-backend-api):
       - polls icecast's status every 3 s -> GET /dj/status
       - while live, ffmpeg copies the stream to /mnt/ssd/dj-sets/<start time>.mp3
       - while live, a second ffmpeg (the meter) measures its loudness -> GET /dj/live/trace
       - relays the stream to listeners -> GET /dj/live (through the existing tunnel)
       - serves finished sets -> GET /dj/sets, GET /dj/sets/{id}/audio
       - works out each finished set's waveform (ffmpeg) -> GET /dj/sets/{id}/waveform
       - keeps the room's chat, replayed per set -> GET /dj/sets/{id}/chat
       - keeps who was in the room, replayed per set -> GET /dj/sets/{id}/people
       - keeps each set's cover image -> PUT/GET /dj/sets/{id}/image
       - keeps the live alerts list, and emails it when the admin sends one -> /dj/alerts
  -> the live section (/opium-den/live): past sets, and the way into the live room
     (/opium-den/live/room), which has the stream, a character for everyone in the
     room (POST /dj/room) and a chat (GET/POST /dj/chat). each past set has its own page (/opium-den/live/set?id=)
     with its waveform and its chat replaying
```

Icecast never goes through the Cloudflare tunnel. Listeners only ever reach the backend's
`/dj/live` relay on `api.tyler-schwenk.com`, so icecast's source port and admin pages stay
private and the tunnel config doesn't change.

Cloudflare's CDN terms restrict serving "a disproportionate percentage of... audio files"
without a paid product, and whether tunnel traffic counts is unsettled. At this scale (a
handful of listeners, occasional sessions) that's an accepted risk. If it ever becomes a
problem, the fallback is moving icecast to a small VPS and having the laptop send there.

## Files

| File | Purpose |
|---|---|
| `pi/services/dj-stream/docker-compose.yml` | The icecast container, on the backend's docker network |
| `pi/services/dj-stream/Dockerfile` | Debian's `icecast2` package, run as the `icecast2` user |
| `pi/services/dj-stream/icecast.xml.template` | Icecast config; passwords filled in at start |
| `pi/services/dj-stream/entrypoint.sh` | Checks the passwords are hex, writes the config to `/tmp`, starts icecast |
| `pi/services/dj-stream/.env` | `ICECAST_SOURCE_PASSWORD`, `ICECAST_ADMIN_PASSWORD` (not in git) |
| `pi/services/website-backend/app/dj_stream.py` | The watcher: live state, recording, listener count |
| `pi/services/website-backend/app/routers/dj.py` | The `/dj` endpoints (see `pi/docs/api/website-backend-api.md#dj-stream`) |
| `pi/services/website-backend/app/dj_waveform.py` | Works out and caches each set's waveform with ffmpeg |
| `pi/services/website-backend/app/dj_live_meter.py` | The live meter: the set's loudness while it's on, for the live trace |
| `pi/services/website-backend/app/routers/dj_chat.py` | The live room chat, `/dj/chat` (open only while live, admin can delete) |
| `pi/services/website-backend/app/routers/dj_room.py` | Who's in the live room, `/dj/room` (check-ins and leaving, saved as visits) |
| `pi/services/website-backend/app/dj_room.py` | The live room's people, in memory: timeouts, names, character numbers |
| `pi/services/website-backend/app/routers/dj_alerts.py` | Live alerts, `/dj/alerts`: signup, confirm, unsubscribe, and the admin's list and send |
| `pi/services/website-backend/app/mailer.py` | Sends email over SMTP, one message per recipient |

## Recording

- The watcher starts ffmpeg (`-c copy`, no re-encode) the first poll the mount is live, and
  adds a `dj_sets` row with no `ended_at`.
- When butt disconnects, icecast ends the stream, ffmpeg exits, and the row gets
  `ended_at`, `duration_s` and `size_bytes`. If icecast says it's off air while ffmpeg is
  still going, the watcher stops ffmpeg itself.
- Anything under 120 s (`MIN_SET_DURATION_S`) is deleted, row and file. That catches
  butt's auto start tripping on a bump.
- If the backend restarts mid-set, the file just ends there. On startup, unfinished rows
  get finished using the file's last-modified time.
- If butt drops and reconnects (Wi-Fi blip), that's two sets.
- Sets are public as soon as they end. Give them a title and description, or delete them,
  from the admin page's DJ tab.
- Covers: the DJ tab can give a set a cover image, while it's still recording ("On air
  now") or any time after. They're kept in `/mnt/ssd/dj-sets/images/set_<id>/` with a
  thumbnail, and go when the set does (deleted, or thrown away for being too short).
- An mp3 at 192 kbps is about 85 MB an hour, on the SSD at `/mnt/ssd/dj-sets`.
- Once a set's kept, the watcher works out its waveform in the background (ffmpeg decodes
  it to low-rate mono and measures each slice's loudness, a few seconds for a long set)
  and saves it next to the mp3 as `<start time>.waveform.json`. If that fails, or the set
  is older than this, it's done on the first request for it instead.
- While a set's on, a second ffmpeg, the live meter, listens to icecast too and prints the
  stream's loudness every second, measured the same way as the waveform (same filter,
  same parsing in `dj_waveform.py`), so the live trace and the finished set look alike.
  The levels are kept in memory for that set and served at `GET /dj/live/trace`, squeezed
  to at most 600 bars, for the live section's monitor. It's its own ffmpeg, not part of the
  recorder, so if it fails the recording carries on; the watcher starts it again (at most
  every 30 s, `METER_RETRY_S`), and each level is placed by its stream time plus when that
  ffmpeg started, so a restart leaves a gap instead of shifting what came after. When the
  set ends the levels are dropped: the recording's own waveform takes over.
- The live room's chat is never thrown away. A set's chat is whatever was sent while it was
  on air, matched by time, so the set page can replay it (see
  `pi/docs/api/website-backend-api.md#get-djsetsset_idchat`).

Listeners hear the stream roughly 5-15 s behind the decks (butt's buffer, icecast's
burst, the browser's buffer). The relay caps listeners at 25 (`MAX_LIVE_LISTENERS`).

## Live alerts

People can ask for an email when the stream's live. Nothing goes out on its own (butt
starts the stream for any practice): each alert is written and sent by hand from the
admin page's DJ tab.

- **Signing up**: in the live room off air (the box sits where the message box goes), the
  "Get an email when I go live" link under the live section's live row, or `/opium-den/live/alerts` on its
  own, which is a link worth sending people. They get a confirmation email, and only
  confirmed addresses get alerts, so typing in someone else's address does nothing but
  send them one email they can ignore.
- **Sending**: admin page, DJ tab, "Live alerts". An optional subject (default "Tyler's live
  in the den"), the message, Send. Everyone gets their own plain text copy: the
  message, the live room link, and their own unsubscribe link. One-click unsubscribe
  headers are on it too, so Gmail and Apple Mail show their own unsubscribe button.
  Sent while a set's recording, the subject and message also become that set's title
  and description (a blank subject keeps the title), and the set list reloads to show
  it. Change them there any time after.
- **Staying out of spam**: the emails say "the den", never "opium", in the subject, body
  and sender name (`MAIL_FROM`), since drug words are a classic spam filter trigger. The
  links still have `/opium-den/` in them, that's just the site's address. The signup also
  tells people to check their spam, and anyone marking it "not spam" teaches their
  provider to trust the address.
- Emails go out one after another, 0.6 s apart, and the admin page waits for the whole
  batch: about a minute per 100 people. Cloudflare drops a request after 100 s, so past
  ~150 subscribers sending needs to move to a background job.
- Unsubscribing deletes the address. The admin tab lists everyone (confirmed or not) and
  can remove anyone.

Endpoints: `pi/docs/api/website-backend-api.md#live-alerts`.

### Setting up email

Any SMTP provider works. Resend is the easy one: a free tier (check its current limits; it
was 3,000 a month and 100 a day) and sending from our own domain, so alerts come from
something like `den@tyler-schwenk.com` instead of a personal address.

1. Sign up at resend.com. **Domains > Add domain**, `tyler-schwenk.com`.
2. It lists DNS records (DKIM, and SPF on its `send.` subdomain). Add each in Cloudflare's
   DNS for the domain, set to **DNS only**, then hit verify in Resend. They're on their
   own names, so they don't touch the site's or the tunnel's records.
3. **API Keys > Create**, with sending access.
4. On fart-pi, in `pi/services/website-backend/.env`:
   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USERNAME=resend
   SMTP_PASSWORD=<the api key, re_...>
   MAIL_FROM=The Den <den@tyler-schwenk.com>
   ```
5. `cd ~/tyler-schwenk.github.io/pi/services/website-backend && docker compose up -d`
   (recreates the container with the new settings).
6. Sign yourself up at `tyler-schwenk.com/opium-den/live/alerts`, confirm, and send a test from
   the admin tab. Check it lands in the inbox and not spam.

To use Gmail instead: `SMTP_HOST=smtp.gmail.com`, `SMTP_USERNAME` your address,
`SMTP_PASSWORD` an app password (Google account > Security > App passwords, needs 2-step
verification), and `MAIL_FROM` that same address, which every subscriber will see.

The free tiers cap a day's sending (Resend's at 100). An alert to more people than that
gets cut off partway, and the admin tab lists who it didn't reach.

The `dj_alert_subscribers` table is created on startup, no migration needed.

## DJ laptop setup (Windows)

The laptop has rekordbox 7 and a DDJ-400. butt is free: https://danielnoethen.de/butt/
(Windows installer or portable zip).

### 1. rekordbox: send the master to the laptop too

With the DDJ-400 plugged in, open Preferences > Audio and turn on **PC MASTER OUT**
("output audio from the computer's built-in speakers and your DJ equipment"). The master
now plays on the DDJ and on the laptop's own output device, which is what butt captures.

### 2. butt: capture and server

Settings > Audio:
- **Audio device**: the laptop's own output device (the one PC MASTER OUT sends to). butt
  has captured what's playing on a WASAPI device since 0.1.33, so it lists output devices
  as well as inputs.
- Codec **MP3**, bitrate **192k**, samplerate **44100**, channels **stereo**.

Settings > Main > Server > Add:
- Type **Icecast**
- Address **192.168.1.116** (away from home: `fart-pi.taila4ff35.ts.net`, over Tailscale)
- Port **8010**
- Password: `ICECAST_SOURCE_PASSWORD` from `pi/services/dj-stream/.env` on fart-pi
- Icecast mountpoint **live**, Icecast user **source**

Settings > Stream:
- Tick **Start streaming if signal is present for 5 seconds**
- Tick **Stop streaming if signal is absent for 60 seconds**
- The signal thresholds (default -50 dB) are in the Audio tab

Leave butt running (it can start with Windows) and the stream follows the decks.

### Check it before trusting it

Play something and watch for:
1. butt's meter moving (it's capturing the master)
2. butt connecting by itself after ~5 s (status shows connected)
3. `curl http://192.168.1.116:8000/dj/status` showing `"live": true` within a few seconds
4. the live section (`/opium-den/live`) showing "live now" and playing
5. after stopping for 60 s, butt disconnecting and a new set in the list (if it ran 2+ min)

If butt's meter doesn't move, or capturing the output only works with the laptop speakers
turned up, use a virtual cable instead: install VB-CABLE (free) and get PC MASTER OUT
playing into "CABLE Input". If rekordbox's audio preferences let you pick the PC output
device, pick it there; otherwise make "CABLE Input" Windows' default output while
streaming (other laptop sounds go into the stream too while it is). Then pick
"CABLE Output" as butt's audio device.

## Deploying on fart-pi

```bash
ssh tyler@192.168.1.116
cd ~/tyler-schwenk.github.io && git pull

# icecast
cd pi/services/dj-stream
cp .env.example .env
# fill both passwords with: openssl rand -hex 16
nano .env
docker compose up -d --build

# backend: picks up the new code and the /mnt/ssd/dj-sets mount
cd ../website-backend
docker compose up -d
curl http://localhost:8000/dj/status
```

The backend has to be running first (icecast joins its `website-backend_default`
network). `init_db()` creates the `dj_sets` table on a fresh database, but it never adds
columns to an existing table. On a database whose `dj_sets` predates the `description`
column, add it once:

```bash
docker exec website-backend-api python -c "import sqlite3; db = sqlite3.connect('/app/data/website_backend.db'); db.execute('ALTER TABLE dj_sets ADD COLUMN description TEXT'); db.commit()"
```

If UFW is enabled on fart-pi, let the laptop reach 8010 from the LAN:
`sudo ufw allow from 192.168.1.0/24 to any port 8010 proto tcp`.

## Troubleshooting

**Site says off air while butt says connected**
- `docker logs website-backend-api | grep "dj stream"`. "can't read icecast status" means
  the backend can't see icecast: is `dj-stream-icecast` up, and on `website-backend_default`
  (`docker network inspect website-backend_default`)?
- Check butt's mountpoint is exactly `live`.

**butt can't connect**
- Wrong password gives a 401 in butt's log. The source password is in
  `pi/services/dj-stream/.env`.
- From the laptop: `curl http://192.168.1.116:8010/status-json.xsl` should answer.
- Icecast's own logs: `docker exec dj-stream-icecast cat /var/log/icecast2/error.log`.

**Container exits right away**
- `docker logs dj-stream-icecast`. The entrypoint says which password is empty or not hex.

**Signing up says alerts aren't set up**
- `SMTP_HOST` or `MAIL_FROM` is empty in the backend's `.env`, or the container wasn't
  recreated after setting them (`docker compose up -d`).

**Signing up or sending says it couldn't reach the mail server**
- `docker logs website-backend-api | grep mailer` has the real error: a wrong
  password or api key is an authentication error, a typo in `SMTP_HOST` a name error.
- A refused address (`failed` in the send's answer) is usually the sender: `MAIL_FROM`'s
  domain has to be verified with the provider.

**Icecast's status page**: http://192.168.1.116:8010/ (admin pages under `/admin/`, user
`admin`, password `ICECAST_ADMIN_PASSWORD`). The backend's recorder and every relay listener
show up there as listeners.
