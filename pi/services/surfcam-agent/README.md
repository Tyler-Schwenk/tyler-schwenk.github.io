# Surfcam Agent

Runs on displaypi (not fart-pi) next to the kiosk Chromium. Plays live surf cams in
mpv, fullscreen on top of the browser, on behalf of the `/display` page's surf cam
panels (see `website/docs/DISPLAY.md` and `pi/docs/services/display-kiosk.md`).

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

mpv decodes with the Pi's hardware H.264 decoder (`--hwdec=v4l2m2m-copy`, the
`bcm2835-codec` device). On a Pi 3B+, software-decoding 1080p pegs the CPU at ~200%
with dropped frames; hardware decode is ~20%. The streams are ~20 fps.

Stream URLs carry an expiring token (~12 hours); one is reused until under an hour
remains, then re-scraped.

CORS: only `https://tyler-schwenk.com` is allowed, and preflights get
`Access-Control-Allow-Private-Network: true` since Chromium treats a public site
calling loopback as a private-network request.

## Cams

`CAMS` in `surfcam_agent.py` maps cam id to its HDOnTap page. The ids must match
`SurfCamId` in `website/app/display/surfCams.ts`.

| Id | Cam |
|---|---|
| `pb` | Pacific Beach (Pac Terrace) |
| `scripps` | La Jolla Shores overlook (Scripps Pier in frame) |
| `scripps-underwater` | Scripps Pier underwater cam (13 ft down a piling) |

To add a cam: find its page on hdontap.com (the page source has a `"streamSrc"`
entry), add it to `CAMS`, add the id to `SurfCamId`, and add a `surfCamPanel("<id>")`
entry to `PANELS` in `website/app/display/page.tsx`.

## Setup on displaypi

The agent needs the kiosk's X session (to open an mpv window), so it's started from
`~/kiosk-run.sh` rather than as a systemd service.

```bash
sudo apt install mpv
mkdir -p ~/surfcam-agent
scp surfcam_agent.py tyler@192.168.1.187:~/surfcam-agent/
```

Add this to `~/kiosk-run.sh` before the main loop (the loop restarts the agent if it
ever crashes):

```bash
( while true; do python3 ~/surfcam-agent/surfcam_agent.py; sleep $RELAUNCH_DELAY_S; done ) &
```

After a power loss nothing needs doing: autologin, `startx`, openbox, and
`~/kiosk-run.sh` bring up both the browser and the agent on their own.

Chromium 154 prompts for "local network access" when a public site calls
`127.0.0.1`, which would pop a dialog on the kiosk. Allow it by policy for our origin
in `/etc/chromium/policies/managed/surfcam.json`:

```json
{"LocalNetworkAccessAllowedForUrls": ["https://tyler-schwenk.com"]}
```

## Troubleshooting

- **Panel says "surfcam agent unreachable":** the agent isn't running (or the page is
  open somewhere other than displaypi). `pgrep -af surfcam_agent`.
- **Panel shows an error from the agent:** it's the agent's own message (mpv missing,
  HDOnTap page format changed, etc) -- run the agent in a terminal to see the log.
- **Stream stutters / drops frames:** check `vcgencmd get_throttled`. Anything other
  than `0x0` means undervoltage or throttling (flags persist since boot, so reboot
  after fixing power). Throttling hurts video far more than the other panels.
- **Don't `pkill -f surfcam_agent` over SSH:** the pattern matches the ssh shell's own
  command line and kills it. Use `pkill -f "[s]urfcam_agent.py"`.
