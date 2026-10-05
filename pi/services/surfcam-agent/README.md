# Surfcam Agent

Runs on displaytop (the display kiosk laptop; not fart-pi) next to the kiosk browsers.
Plays live surf cams in mpv, fullscreen on top of the browser, on behalf of the
`/display` page's surf cam panels, and serves each cam's surf conditions to the
conditions panel on the other screen (see `website/docs/DISPLAY.md` and
`pi/docs/services/display-kiosk.md`).

## Why mpv instead of a video tag

The streams come from two places, and neither will play in a page on tyler-schwenk.com:

- **HDOnTap** only allows its own embed on other sites and returns 403 to any browser
  request carrying a foreign `Origin` header. mpv sends no `Origin`, so it plays them the
  same way a user watching the public HDOnTap page would.
- **Surfline's** stream CDN returns 403 unless the request's referrer is its own embed
  player (`https://embed.cdn-surfline.com/`). mpv sends that with `--referrer`. Only
  Surfline's free cams are used (the ones Scripps and others embed publicly); premium
  cams are for paying subscribers and are left out.

## How it works

Stdlib-only Python server on `127.0.0.1:8765`, no dependencies beyond `mpv`.

| Request | Effect |
|---|---|
| `POST /cams/<cam>/prepare` | Get the cam's `.m3u8` (scraped from its HDOnTap page, or Surfline's fixed url), start mpv paused + minimized so it buffers in the background. No-op if already running. |
| `POST /cams/<cam>/show?token=<t>` | Wait for mpv's first frame, then unpause and bring it fullscreen/on top via its JSON IPC socket (`/tmp/surfcam-<cam>.sock`), then draw the info overlay (below). Runs `prepare` first if needed. |
| `POST /cams/<cam>/stop?token=<t>` | Kill that cam's mpv, unless a newer show of it (different token) has already arrived. |
| `POST /cams/stop-all` | Kill every cam's mpv (from `kiosk-run.sh` when it kills the browsers). |
| `GET /cams/<cam>/conditions` | The cam's place name, waves, wind and tide (with its graph data) as json (below), for the conditions panel on the laptop screen. |
| `POST /control/keys/<key>` | Log a keyboard-control key press (from xbindkeys). Keys: `tab`, `escape`, `backspace`, `next`, `prev`, `1`-`9`. |
| `POST /control/reset` | Clear the key log (from `kiosk-run.sh` when the overnight sleep starts). |
| `GET /control/log?after=<version>` | The key log since the last reset, `{"session_ms", "version", "events": [{"key", "at_ms"}]}`. Long-polls: waits up to 25 s for the version to differ from `after` (`-1` answers at once). |

**Keyboard control** (`kiosk_control.py`): the agent is also the relay between the
kiosk's keyboard and the two pages. It only stores the presses; what they mean is worked
out in the page (`website/app/display/kioskControl.ts`), which replays the whole log, so
both screens always agree. The log lives in memory, so an agent restart is also a reset.

**Remote control** (`remote_control.py`): the admin page's Display tab
(`website/docs/ADMIN.md`) presses keys from anywhere. It can't reach this agent (loopback
only), so the website backend relays (`pi/services/website-backend/app/display_control.py`),
and the agent makes two outbound connections to `https://api.tyler-schwenk.com/display-control`,
each on its own thread:

- **pull**: long-polls `GET /kiosk/commands?after=<cursor>` for remote presses and adds
  each one's keys to the key log as one change (`ControlLog.add`), so a remote "escape then 4"
  never shows the standard rotation in between. `beat-earlier` / `beat-later` go to the bpm
  agent's `POST /offset/earlier|later` instead, like the `-` and `=` keys. On startup it
  sends `after=-1`, which skips presses queued before it was listening
- **push**: `PUT /kiosk/log` with the whole key log every time it changes, and every 25 s
  anyway as a heartbeat (that's what makes the admin page show the kiosk as online)

Both send the shared secret from `~/surfcam-agent/kiosk-token` as `X-Kiosk-Token`; it must
match `KIOSK_TOKEN` in the backend's `.env`. With no token file, remote control is off
(logged at startup) and everything else works as before. A failed request is retried
every 5 s; only the first failure and the recovery are logged.

The rotation controller calls `prepare` `PANEL_PREPARE_LEAD_MS` before a surf cam
panel is due, the panel calls `show` on mount and `stop` on unmount. Only the primary
screen's page (`/display?screen=primary`) has surf cam panels, so only it drives the
player; the secondary page only reads `conditions`.

Starting and stopping a cam's mpv is serialized by a per-cam lock: without it, two
requests arriving together (the stream scrape takes about a second) would each start an
mpv, and the first would be orphaned, since the second takes over its control socket.

What happens when the cam on screen changes (in the rotation, or by the keyboard):
- **Show waits for a picture.** An mpv window with no frame yet is plain white, so `show`
  polls mpv's `vo-configured` and only raises the window once it's true (up to 20 s, else
  it returns an error the panel displays and retries). A cam prepared ahead is ready at
  once; one jumped to with a key shows "loading surf cam..." for a few seconds instead
  of a white screen.
- **Stale stops are ignored.** Each panel mount sends a random token with its show and
  stop. Going A, B, A quickly sends stop(A) and a new show(A) on separate connections,
  so they can arrive in either order; a stop whose token isn't the current show's is
  ignored, so it can't kill the video that's meant to be up.
- **Unused prepares are cleaned up.** A cam prepared but not shown within 30 s is stopped
  (a key press can change what's next after the page prepared it).
- **Drops are restarted.** If a shown cam's mpv exits by itself (the stream dropped, or
  its url token expired during a long hold), the agent shows it again after 10 s, and
  keeps trying while the page still wants it. A deliberate stop clears the token first,
  so it's never undone, and a restart never re-claims a cam that was stopped meanwhile.

mpv runs with `--no-input-default-bindings`, because it takes keyboard focus when it comes
on top and keys pressed at the kiosk would otherwise quit, pause, or resize it.

**Cleanup:** the agent stops its mpv processes when it exits, including on SIGTERM
(`pkill`'s default). Whenever `kiosk-run.sh` kills the browsers (a killed page never
sends `stop`) it asks the agent to `stop-all` first (a bare `pkill` would just be
restarted as a drop), then runs `pkill -x mpv` as a fallback. It also kills any mpv
before every agent start (a new agent can't see the old one's players).

HDOnTap stream URLs carry an expiring token (~12 hours); one is reused until under an
hour remains, then re-scraped. Surfline's URLs are fixed (`hls.cdn-surfline.com/oregon/<alias>/playlist.m3u8`).

CORS: only `https://tyler-schwenk.com` is allowed, and preflights get
`Access-Control-Allow-Private-Network: true` since Chrome treats a public site
calling loopback as a private-network request.

**Which screen:** mpv opens on the primary screen, and `kiosk-run.sh` makes the external
monitor primary whenever one is connected (otherwise the built-in screen is primary).

## Surf conditions

`surf_conditions.py` picks the most accurate free source for each reading:

| Reading | Source | Where it's for |
|---|---|---|
| Waves: height, peak period, peak direction | [CDIP MOP](https://cdip.ucsd.edu/) nearshore nowcast (OPeNDAP, hourly, ~1 h behind) | the MOP point nearest the beach (one every 100 m along the San Diego coast, in 10 m of water) |
| Wind: speed, direction, gusts | measured at NOAA station LJAC1 (end of Scripps Pier) for the La Jolla cams; Open-Meteo forecast model elsewhere | the station, or the cam's coordinates |
| Tide: height now, rising/falling, next high/low, the graph | NOAA station 9410230 (Scripps Pier): measured water level (past 12 h) plus 6-minute and high/low predictions | the station |

Why these: MOP turns the real buoy measurements into waves at each beach, so it catches
what a coarse wave model misses (in the open-meteo model La Jolla Shores and Scripps
share a grid cell, and it reported a 10 s south swell when the beach had 5 s wind
swell). Its height is the total significant wave height, which is why the label is
"Waves" not "Swell". Measured wind beats any model where there's a station; there's none
near Pacific Beach or Encinitas. The tide's height now is the gauge's latest reading when
it's under 30 minutes old (it catches surge the predictions miss), else the prediction.

Each cam's spot (`SurfSpot` in `CAMS`) holds its coordinates, MOP point id, and wind
station if it has one. Measured wind falls back to the model if the station's latest
reading is missing or over an hour old, and the tide graph works without its measured
line if the gauge feed fails.

`GET /cams/<cam>/conditions` returns (a reading that couldn't be had is `null`;
directions are where the waves/wind come from, degrees clockwise from north; `*_ms` are
epoch milliseconds):

```json
{
  "name": "Pacific Beach",
  "waves": {"height_ft": 2.48, "period_s": 12.3, "direction_deg": 248, "direction_compass": "WSW", "as_of": "1:00 PM"},
  "wind": {"speed_mph": 9.0, "gusts_mph": 10.5, "direction_deg": 324, "direction_compass": "NW", "note": "forecast model"},
  "tide": {
    "height_ft": 6.21, "measured": true, "rising": false,
    "next_turn_kind": "low", "next_turn_at": "9:53 PM", "source": "Scripps Pier",
    "now_ms": 1790982000000, "window_start_ms": 1790938800000, "window_end_ms": 1791068400000,
    "predicted": [[1790938800000, 3.01], "...every 6 min across the window"],
    "observed": [[1790938800000, 4.12], "...every 6 min over the past 12 h"],
    "turns": [{"at_ms": 1790974500000, "at": "1:25 PM", "height_ft": 5.41, "kind": "high"}]
  }
}
```

`gusts_mph` can be `null`; the tide's `source` is `null` when the station is at the cam;
`observed` can be empty.

## Info overlay

Each shown cam gets a translucent bar across the top with the place name (top left) and
one line per reading (top right), drawn by mpv's `osd-overlay` (ASS text): waves, wind
(gusts noted when 5+ mph above the wind), and tide. Anything read more than
`LOCAL_RADIUS_KM` (1 km) from the cam gets a small grey "(from <place>)" tag, so a tide
shown on the Pacific Beach cam says it's from Scripps Pier.

| File | Role |
|---|---|
| `surfcam_agent.py` | Cam list (stream source + spot), mpv control, the HTTP API, and `build_overlay_ass` / `show_overlay` |
| `surf_conditions.py` | Fetches the readings (`get_conditions`) and formats them as overlay lines (`get_metrics`) or json (`conditions_to_json`); no mpv knowledge |
| `kiosk_control.py` | The keyboard-control key log (`ControlLog`) and the keys it accepts |
| `remote_control.py` | Relays the admin page's remote through the website backend: pulls presses into the key log, pushes the log back up |

**Failure handling** (`surf_conditions.py`): a flaky API can't take the overlay or panel down.
- Each reading is fetched on its own thread and fails on its own, so a missing wave
  reading still shows wind and tide, and a hanging API costs one 5 s timeout, not three
- Any error at all (network, malformed response, an unexpected field) just drops that
  reading; the overlay and the video still show
- Results are cached for 10 minutes. If a refresh fails, the last good reading is kept for
  up to 2 hours (tide predictions, which don't drift, up to 24 hours) before being dropped
- After a failure an API isn't retried for 60 seconds, so an outage doesn't add a delay
  to every cam change
- If everything fails, the bar still shows the place name

The conditions are fetched during `prepare`, so `show` doesn't wait on the APIs. An overlay
belongs to the IPC client that drew it and vanishes when that connection closes, so the
agent keeps one connection per shown cam open until `stop`. If the overlay fails the video
still shows.

**Hardware decoding:** mpv runs with `--hwdec=auto-safe`, which picks VA-API on the
laptop's Intel GPU. 1080p at 20-30 fps plays with zero dropped frames and near-zero CPU.

## Cams

`CAMS` in `surfcam_agent.py` maps cam id to its stream source and surf spot. The ids
must match `SurfCamId` in `website/app/display/surfCams.ts`.

| Id | Cam | Source | Stream | MOP point | Wind |
|---|---|---|---|---|---|
| `pb` | Pacific Beach (Pac Terrace) | HDOnTap | 1080p, ~20 fps | D0402 | model |
| `la-jolla-shores` | La Jolla Shores surf cam | HDOnTap | 1080p, ~30 fps | D0499 | LJAC1 |
| `scripps` | Scripps Pier, south side (above water) | Surfline `wc-scripps` | 720p | D0514 | LJAC1 |
| `scripps-underwater` | Scripps Pier underwater cam (13 ft down a piling) | HDOnTap | 1080p, ~30 fps | D0514 | LJAC1 |
| `moonlight` | Moonlight Beach, Encinitas | Surfline `wc-moonlight` | 720p | D0723 | model |

Swami's isn't here because both of Surfline's Swami's cams are premium and HDOnTap has
none; Moonlight is the nearest free cam (about 1.5 km north).

Stick to cams that stream **1080p or lower** so decode and rendering stay light.

To add a cam:
1. Find a stream. HDOnTap: the cam page's source has a `"streamSrc"` entry; add a `Cam`
   with `page_url`. Surfline: look up the spot's cameras with
   `https://services.surfline.com/kbyg/spots/reports?spotId=<id>` (or
   `.../kbyg/mapview?south=..&west=..&north=..&east=..` to list an area), use only one
   with `isPremium: false`, and add `surfline_cam("<alias>", ...)`.
2. Give it a `SurfSpot`: coordinates, the nearest MOP point (MOP ids run south to north,
   `D0001` at the border to `D1210`; each dataset's `metaLatitude`/`metaLongitude` are in
   `https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/<id>_nowcast.nc.ascii?metaLatitude,metaLongitude`),
   and `SCRIPPS_PIER_WIND` if it's within about a km of the pier.
3. Add the id and its name to `SURF_CAMS` in `website/app/display/surfCams.ts`. That's
   all the page needs: the rotation, its shortcut key and the admin remote's button all
   come from that list.

## Setup

The agent needs the kiosk's X session (to open an mpv window), so it's started from
`~/kiosk-run.sh` rather than as a systemd service; the loop there restarts it if it ever
crashes, and its output goes to `/tmp/surfcam-agent.log`.
`pi/services/display-kiosk/setup-displaytop.sh` installs it, mpv, and the Chrome policy
that lets the page call it (`/etc/opt/chrome/policies/managed/surfcam.json`); see
`pi/docs/services/display-kiosk.md`. After a power loss nothing needs doing: autologin,
`startx`, openbox, and `~/kiosk-run.sh` bring up both the browsers and the agent on
their own.

The policy is needed because Chrome prompts for "local network access" when a public
site calls `127.0.0.1`, which would pop a dialog on the kiosk:

```json
{"LocalNetworkAccessAllowedForUrls": ["https://tyler-schwenk.com"]}
```

## Troubleshooting

- **Panel says "surfcam agent unreachable":** the agent isn't running (or the page is
  open somewhere other than the kiosk). `pgrep -af surfcam_agent`, and read
  `/tmp/surfcam-agent.log`.
- **Panel shows an error from the agent:** it's the agent's own message (mpv missing,
  HDOnTap page format changed, unknown cam id, etc) -- see the log. An unknown cam id
  means the deployed site and the agent's `CAMS` are out of sync.
- **A Surfline cam stays on "loading surf cam...":** test the stream by hand:
  `mpv --referrer=https://embed.cdn-surfline.com/ https://hls.cdn-surfline.com/oregon/<alias>/playlist.m3u8`.
  A 403 means Surfline changed what it checks, or the cam went premium.
- **Stream stutters / drops frames:** check `vainfo` lists H264 decode and that mpv
  reports `hwdec=vaapi` (`hwdec-current` over the IPC socket).
- **Video shows on the wrong screen:** the external monitor should be `primary` in
  `xrandr`; `pkill -x chrome` re-runs the layout.
- **Checking for stray players:** `ps -o pid,etimes,args -C mpv` should list at most the
  cam on screen plus the one being prepared. Anything older than a rotation is a leak;
  `pkill -x mpv` clears it and the next `prepare` starts fresh.
- **A reading is missing or says "forecast model" where it should be measured:** see the
  agent log for `no <waves|wind|tide> for ...` or `measured wind ... unavailable`
  warnings (an API down, a stale station, or the kiosk offline). A bar with only the
  name means every reading failed.
- **Admin page says the kiosk is offline:** `grep remote- /tmp/surfcam-agent.log`. "no
  kiosk token" means `~/surfcam-agent/kiosk-token` is missing; a 401 means it doesn't match
  the backend's `KIOSK_TOKEN`; a 503 means the backend has no `KIOSK_TOKEN` set; a
  connection error means displaytop can't reach `api.tyler-schwenk.com`.
- **Don't `pkill -f surfcam_agent` over SSH:** the pattern matches the ssh shell's own
  command line and kills it. Use `pkill -f "[s]urfcam_agent.py"`.
