# Surfcam Agent

Runs on the display kiosk machine (displaytop, or displaypi as the spare; not fart-pi)
next to the kiosk browser. Plays live surf cams in mpv, fullscreen on top of the browser,
on behalf of the `/display` page's surf cam panels (see `website/docs/DISPLAY.md` and
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
| `POST /cams/<cam>/show` | Unpause and bring mpv fullscreen/on top via its JSON IPC socket (`/tmp/surfcam-<cam>.sock`). Runs `prepare` first if needed. |
| `POST /cams/<cam>/stop` | Kill that cam's mpv. |

The rotation controller calls `prepare` `PANEL_PREPARE_LEAD_MS` before a surf cam
panel is due, the panel calls `show` on mount and `stop` on unmount.

Stream URLs carry an expiring token (~12 hours); one is reused until under an hour
remains, then re-scraped.

CORS: only `https://tyler-schwenk.com` is allowed, and preflights get
`Access-Control-Allow-Private-Network: true` since Chromium treats a public site
calling loopback as a private-network request.

### Hardware decoding

`MPV_HWDEC` in `surfcam_agent.py` is chosen by CPU architecture:

- **x86 (displaytop):** `auto-safe`, which picks VA-API on the Intel GPU. 1080p at 20-30
  fps plays with zero dropped frames and near-zero CPU
- **aarch64 (displaypi):** `v4l2m2m-copy`, the Pi's `bcm2835-codec` hardware decoder.
  Software-decoding 1080p there pegs the CPU at ~200% with dropped frames; hardware
  decode plays 20 fps streams fine but drops most frames of 30 fps ones

## Cams

`CAMS` in `surfcam_agent.py` maps cam id to its HDOnTap page. The ids must match
`SurfCamId` in `website/app/display/surfCams.ts`.

| Id | Cam | Stream |
|---|---|---|
| `pb` | Pacific Beach (Pac Terrace) | 1080p, ~20 fps |
| `la-jolla-shores` | La Jolla Shores surf cam (waves) | 1080p, ~30 fps |
| `scripps-underwater` | Scripps Pier underwater cam (13 ft down a piling) | 1080p, ~30 fps |

Only use cams that stream **1080p or lower** (check `RESOLUTION=` in the stream's
playlist): the Pi's hardware decoder can't do 1440p/4K, producing dark corrupted
output, a software fallback, and overheating. The laptop has more headroom but 1080p
is still the safe ceiling.

To add a cam: find its page on hdontap.com (the page source has a `"streamSrc"`
entry), add it to `CAMS`, add the id to `SurfCamId`, and add a `surfCamPanel("<id>")`
entry to `PANELS` in `website/app/display/page.tsx`.

## Setup

The agent needs the kiosk's X session (to open an mpv window), so it's started from
`~/kiosk-run.sh` rather than as a systemd service; the loop there restarts it if it ever
crashes. `pi/services/display-kiosk/setup-displaytop.sh` installs it (and mpv) on the
laptop; see `pi/docs/services/display-kiosk.md`. After a power loss nothing needs doing:
autologin, `startx`, openbox, and `~/kiosk-run.sh` bring up both the browser and the
agent on their own.

On displaypi it was set up by hand: `sudo apt install mpv`, copy `surfcam_agent.py` to
`~/surfcam-agent/`, and add the agent loop to `~/kiosk-run.sh`.

The browser prompts for "local network access" when a public site calls `127.0.0.1`,
which would pop a dialog on the kiosk. Allow it by policy for our origin:

| Machine | Policy file |
|---|---|
| displaytop (Chrome) | `/etc/opt/chrome/policies/managed/surfcam.json` |
| displaypi (Chromium) | `/etc/chromium/policies/managed/surfcam.json` |

```json
{"LocalNetworkAccessAllowedForUrls": ["https://tyler-schwenk.com"]}
```

## Troubleshooting

- **Panel says "surfcam agent unreachable":** the agent isn't running (or the page is
  open somewhere other than the kiosk). `pgrep -af surfcam_agent`.
- **Panel shows an error from the agent:** it's the agent's own message (mpv missing,
  HDOnTap page format changed, unknown cam id, etc) -- run the agent in a terminal to
  see the log. An unknown cam id means the deployed site and the agent's `CAMS` are out
  of sync.
- **Stream stutters / drops frames:** on the Pi, check `vcgencmd get_throttled`; anything
  other than `0x0` means undervoltage or throttling (flags persist since boot, so reboot
  after fixing power). On the laptop, check `vainfo` lists H264 decode and that mpv
  reports `hwdec=vaapi`.
- **Don't `pkill -f surfcam_agent` over SSH:** the pattern matches the ssh shell's own
  command line and kills it. Use `pkill -f "[s]urfcam_agent.py"`.
