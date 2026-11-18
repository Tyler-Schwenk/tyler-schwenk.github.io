# DJ Stream

Whatever's playing out of rekordbox on the DJ laptop streams live to the Opium Den page
(`tyler-schwenk.com/opium-den`), and every session gets recorded and listed there as a
past set. Streaming starts by itself when there's sound and stops after a stretch of
silence, so practicing is all it takes to go live.

## How it fits together

```
rekordbox (DDJ-400 master, also sent to the laptop's own output by PC MASTER OUT)
  -> butt on the laptop: captures that output, mp3 192 kbps, auto start/stop on signal
  -> icecast on fart-pi (dj-stream-icecast, host port 8010, LAN + tailnet only)
  -> website backend (website-backend-api):
       - polls icecast's status every 3 s -> GET /dj/status
       - while live, ffmpeg copies the stream to /mnt/ssd/dj-sets/<start time>.mp3
       - relays the stream to listeners -> GET /dj/live (through the existing tunnel)
       - serves finished sets -> GET /dj/sets, GET /dj/sets/{id}/audio
  -> Opium Den page: live player while on air, past sets underneath
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
- Sets are public as soon as they end. Rename or delete them from the admin page's DJ tab.
- An mp3 at 192 kbps is about 85 MB an hour, on the SSD at `/mnt/ssd/dj-sets`.

Listeners hear the stream roughly 5-15 s behind the decks (butt's buffer, icecast's
burst, the browser's buffer). The relay caps listeners at 25 (`MAX_LIVE_LISTENERS`).

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
4. the Opium Den page showing "live now" and playing
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
network). The `dj_sets` table is new, so `init_db()` creates it on startup.

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

**Icecast's status page**: http://192.168.1.116:8010/ (admin pages under `/admin/`, user
`admin`, password `ICECAST_ADMIN_PASSWORD`). The backend's recorder and every relay listener
show up there as listeners.
