# Display Page Documentation

## Overview

`/display` is a full-screen kiosk page, not a normal site page — it has no navigation
or footer and isn't linked from anywhere on the public site. It's meant to be opened in
a kiosk browser on a dedicated monitor (see `pi/docs/services/display-kiosk.md` for the
Raspberry Pi that runs it) and rotates through a fixed list of "panels," each a
self-contained view.

Only the currently-active panel is mounted. Switching panels unmounts the previous one,
so its polling/timers stop automatically — an inactive panel costs nothing.

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `website/app/display/page.tsx` | Rotation controller — cycles through `PANELS` every `PANEL_ROTATE_INTERVAL_MS` |
| `website/app/display/PhotoPanel.tsx` | Full-bleed rotating slideshow of every public gallery's photos |
| `website/app/display/MallardPanel.tsx` | Current mallard count with a canvas-animated duck background |
| `website/app/display/SurfCamPanel.tsx` | Live surf cam; asks the surfcam agent on the kiosk machine to play it (see "Surf Cams") |
| `website/app/display/surfCams.ts` | Client for the surfcam agent (`prepareSurfCam`, `showSurfCam`, `stopSurfCam`) and the `SurfCamId` list |
| `website/app/display/PlaceholderPanel.tsx` | Generic "Coming Soon: {name}" stand-in, reused as new panels get built |

### Adding a Panel

1. Build the panel as its own component in `website/app/display/`, following
   `MallardPanel.tsx` as a template: fetch its own data, manage its own polling, render
   `fixed inset-0` full-bleed.
2. Add it to the `PANELS` array in `page.tsx`.
3. If it's slow to start, give its `PANELS` entry a `prepare` hook (see below).

### Preparing Panels Ahead of Time

A `PANELS` entry can define `prepare()`. The rotation controller calls it
`PANEL_PREPARE_LEAD_MS` before that panel is due on screen, so slow-starting content
(a live video stream) loads in the background and appears already running. Panels
without `prepare` are unaffected. Right now only surf cams use it.

Panels not yet built are listed in a comment at the top of `page.tsx` rather than kept
in the active rotation with `PlaceholderPanel` — add a panel to `PANELS` (optionally
with `PlaceholderPanel` first as a stub) once it's actually being worked on.

### Planned Panels (not yet built)

- MTS trolley info
- Pac-Tyler bike map
- BPM audio visualizer — a USB mic on fart-pi listens to ambient music, detects the
  BPM, and this panel shows a visual synced to it. See "BPM Audio Visualizer" below.
- Server status (Beszel) — blocked on Beszel having no public/read-only API access
  (confirmed: the anonymous `systems` records endpoint returns zero items even though
  it responds 200). Needs either a persistent authenticated Chromium session (simple,
  but the login session will eventually expire) or a server-side proxy endpoint on
  website-backend holding a Beszel service token (more durable, matches how the rest
  of the backend handles secrets — preferred if there's time to build it properly)

## Mallard Count

`MallardPanel.tsx` fetches from `${API_BASE}/mallard-count`, which is a
website-backend endpoint (`pi/services/website-backend/app/routers/mallard.py`) that
proxies `api.traderoutes.cards` server-side. That external API doesn't send CORS
headers, so a direct browser fetch from `tyler-schwenk.com` is silently blocked —
routing it through our own backend sidesteps the problem since server-to-server
requests aren't subject to browser CORS rules.

## Surf Cams

Live cams (Pacific Beach, La Jolla Shores, Scripps underwater) are normal rotation entries, but the
video isn't played by the page. The streams are from HDOnTap, which blocks browser
playback from other origins, so a small agent on the kiosk machine plays them in mpv fullscreen
on top of Chromium (`pi/services/surfcam-agent/README.md`).

`SurfCamPanel` calls the agent's `show` on mount and `stop` on unmount; the rotation's
`prepare` hook calls `prepare` a few seconds earlier, which starts mpv paused and
minimized so it's already buffered when the panel comes up. The stream therefore runs a
few seconds behind real time, which is fine for ambient viewing.

On the laptop the kiosk can drive two screens, each running this page; surf cam video
plays on the external monitor only (see `pi/docs/services/display-kiosk.md`).

The page talks to the agent at `http://127.0.0.1:8765`, which only exists on the kiosk machine.
Anywhere else the panel just shows "surfcam agent unreachable". Cam ids in
`SurfCamId` must match `CAMS` in the agent.

## BPM Audio Visualizer (planned)

A USB mic on fart-pi (see `pi/docs/internal/hardware.md`) continuously listens to
ambient music and estimates its tempo. The display panel polls for the current BPM
and renders a visual that moves/pulses in time with it.

### Beat sync strategy

There are two latency sources between "a beat happens in the room" and "the panel
shows something for it":

- **Fixed pipeline latency** — audio buffering, the beat-detection algorithm's
  required lookahead window, and network/render delay to the kiosk. This is roughly
  constant for a given setup regardless of what's playing, so it can be calibrated
  once (play a metronome click, compare detected-beat-time to actual click-time, take
  the average delta) and compensated with a fixed offset going forward. No live manual
  tuning needed for this part.
- **Residual jitter** — beat trackers don't produce a perfectly steady phase; the
  estimate wobbles beat-to-beat depending on how clean the onset is. A static offset
  can't fix this. The plan is a lightweight phase-locked loop on the display side: it
  runs its own beat clock forward at the current tempo estimate and nudges the phase
  toward each newly detected beat rather than snapping to it, smoothing out jitter
  instead of visibly jumping.

**Fallback if precise sync proves too hard:** use a continuous (non-discrete) motion
that just completes exactly one full cycle per beat period — e.g. a smooth oscillation
or gradient sweep — rather than a discrete per-beat pulse. This only needs the tempo
(cycle duration) to be right, not phase-locked alignment to the exact instant of each
beat, so it's far more forgiving of detection latency and jitter. Worth falling back to
if the fixed-offset-plus-PLL approach above doesn't feel tight enough in practice.

## Hardware Constraints

The primary kiosk is a Surface Laptop 3 (displaytop) with plenty of headroom, but the
spare is a Raspberry Pi 3 B+ with 1 GB of RAM (see `pi/docs/services/display-kiosk.md`),
which is not a lot for a full browser plus animation, so panels should stay light enough
to run on it. Any panel that animates many elements should follow the pattern established
in `MallardPanel.tsx`: draw on a single `<canvas>` with one `requestAnimationFrame`
loop rather than many independently CSS-animated DOM nodes, pre-render repeated images
once to an offscreen canvas instead of redrawing them every frame, and cap how many
elements actually render/animate regardless of the "real" underlying number.
