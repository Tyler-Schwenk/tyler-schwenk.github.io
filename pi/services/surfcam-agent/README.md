# Surfcam Agent

Runs on displaytop (the display kiosk laptop; not fart-pi) next to the kiosk browsers.
Plays live surf cams in mpv, fullscreen on top of the browser, on behalf of the
`/display` page's surf cam panels (see `website/docs/DISPLAY.md` and
`pi/docs/services/display-kiosk.md`).

## Why mpv instead of a video tag

The streams come from HDOnTap, which only allows its own embed on other sites and
returns 403 to any browser request carrying a foreign `Origin` header (so hls.js on
tyler-schwenk.com can't play them). mpv sends no `Origin`, so it plays them the same
way a user watching the public HDOnTap page would.

## How it works

Single-file stdlib Python server on `127.0.0.1:8765`, no dependencies beyond `mpv`.

| Request | Effect |
|---|---|
| `POST /cams/<cam>/prepare` | Scrape the cam's tokenized `.m3u8` from its public HDOnTap page (`"streamSrc"` in the HTML), start mpv paused + minimized so it buffers in the background. No-op if already running. |
| `POST /cams/<cam>/show` | Unpause and bring mpv fullscreen/on top via its JSON IPC socket (`/tmp/surfcam-<cam>.sock`), then draw the info overlay (below). Runs `prepare` first if needed. |
| `POST /cams/<cam>/stop` | Kill that cam's mpv. |

The rotation controller calls `prepare` `PANEL_PREPARE_LEAD_MS` before a surf cam
panel is due, the panel calls `show` on mount and `stop` on unmount.

Stream URLs carry an expiring token (~12 hours); one is reused until under an hour
remains, then re-scraped.

CORS: only `https://tyler-schwenk.com` is allowed, and preflights get
`Access-Control-Allow-Private-Network: true` since Chrome treats a public site
calling loopback as a private-network request.

**Which screen:** mpv opens on the primary screen, and `kiosk-run.sh` makes the external
monitor primary whenever one is connected (otherwise the built-in screen is primary).

## Info overlay

Each shown cam gets a translucent bar across the top with the place name (top left) and
one line per reading (top right), drawn by mpv's `osd-overlay` (ASS text). The files:

| File | Role |
|---|---|
| `surfcam_agent.py` | Cam list (stream page + location), mpv control, and `build_overlay_ass` / `show_overlay` |
| `surf_conditions.py` | Fetches and formats the readings; no mpv knowledge |

Readings (free, keyless APIs, cached 10 minutes, each fetched independently so one failing
API just drops its line):

| Line | Source | Location of the reading |
|---|---|---|
| Swell height, period, direction | Open-Meteo Marine model | the cam's coordinates |
| Wind speed, direction, gusts (noted when 5+ mph above the wind) | Open-Meteo forecast model | the cam's coordinates |
| Tide height, rising/falling, next high or low | NOAA predictions, station 9410230 (Scripps Pier) | the station |

Directions are where the swell/wind comes *from*. Anything read more than
`LOCAL_RADIUS_KM` (1 km) from the cam gets a small grey "(from <place>)" tag, so a tide
shown on the Pacific Beach cam says it's from Scripps Pier. The Scripps underwater cam is
at the station, so it has no tag. Each cam's name and coordinates are in `CAMS`.

The conditions are fetched during `prepare`, so `show` doesn't wait on the APIs. An overlay
belongs to the IPC client that drew it and vanishes when that connection closes, so the
agent keeps one connection per shown cam open until `stop`. If the overlay fails the video
still shows.

**Hardware decoding:** mpv runs with `--hwdec=auto-safe`, which picks VA-API on the
laptop's Intel GPU. 1080p at 20-30 fps plays with zero dropped frames and near-zero CPU.

## Cams

`CAMS` in `surfcam_agent.py` maps cam id to its HDOnTap page. The ids must match
`SurfCamId` in `website/app/display/surfCams.ts`.

| Id | Cam | Stream |
|---|---|---|
| `pb` | Pacific Beach (Pac Terrace) | 1080p, ~20 fps |
| `la-jolla-shores` | La Jolla Shores surf cam (waves) | 1080p, ~30 fps |
| `scripps-underwater` | Scripps Pier underwater cam (13 ft down a piling) | 1080p, ~30 fps |

Stick to cams that stream **1080p or lower** (check `RESOLUTION=` in the stream's
playlist) so decode and rendering stay light.

To add a cam: find its page on hdontap.com (the page source has a `"streamSrc"`
entry), add it to `CAMS` with its name and coordinates, add the id to `SurfCamId`, and add a `surfCamPanel("<id>")`
entry to `PANELS` in `website/app/display/page.tsx`.

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
- **Stream stutters / drops frames:** check `vainfo` lists H264 decode and that mpv
  reports `hwdec=vaapi` (`hwdec-current` over the IPC socket).
- **Video shows on the wrong screen:** the external monitor should be `primary` in
  `xrandr`; `pkill -x chrome` re-runs the layout.
- **No overlay on a cam:** see the agent log for `overlay for <cam> not shown` or
  `no <swell|wind|tide> for ...` warnings (an API down, or the kiosk offline). A bar with
  only the name means every reading failed.
- **Don't `pkill -f surfcam_agent` over SSH:** the pattern matches the ssh shell's own
  command line and kills it. Use `pkill -f "[s]urfcam_agent.py"`.
