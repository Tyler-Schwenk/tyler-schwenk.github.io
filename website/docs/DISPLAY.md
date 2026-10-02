# Display Page Documentation

## Overview

`/display` is a full-screen kiosk page, not a normal site page — it has no navigation
or footer and isn't linked from anywhere on the public site. It's meant to be opened in
a kiosk browser on the always-on screens (see `pi/docs/services/display-kiosk.md` for
displaytop, the laptop that runs them) and rotates through a fixed list of "panels," each
a self-contained view.

Only the currently-active panel is mounted. Switching panels unmounts the previous one,
so its polling/timers stop automatically — an inactive panel costs nothing.

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `website/app/display/page.tsx` | Rotation controller — `ROTATION` pairs what each screen shows per slot, `SHORTCUTS` maps the digit keys; picks this screen's side from `?screen=` |
| `website/app/display/layout.tsx` | Turns off page scrolling for `/display` (every panel is a fixed full-screen layer; without it the kiosk browser can show scrollbars) |
| `website/app/display/kioskControl.ts` | Keyboard control: the key-log state machine both pages replay (`replayControl`) and the long-poll hook (`useControlLog`) |
| `website/app/display/ControlOverlay.tsx` | The shortcut menu and the top-right "held" indicator |
| `website/app/display/useClockSlot.ts` | Wall-clock slot hook shared by the rotation and the photo slideshow |
| `website/app/display/PhotoPanel.tsx` | Full-bleed rotating slideshow of every public gallery's photos (`staggered` changes half a beat later) |
| `website/app/display/MallardPanel.tsx` | Current mallard count with a canvas-animated duck background |
| `website/app/display/SurfCamPanel.tsx` | Live surf cam; asks the surfcam agent on displaytop to play it (see "Surf Cams") |
| `website/app/display/SurfConditionsPanel.tsx` | Waves, wind (compass dials) and tide for a cam's spot, shown on the top screen while the cam plays below |
| `website/app/display/TideGraph.tsx` | The tide chart on the conditions panel: predicted curve, measured line, now marker, highs/lows |
| `website/app/display/surfCams.ts` | Client for the surfcam agent (`prepareSurfCam`, `showSurfCam`, `stopSurfCam`, `fetchSurfConditions`) and the `SurfCamId` list |
| `website/app/display/PlaceholderPanel.tsx` | Generic "Coming Soon: {name}" stand-in, reused as new panels get built |

### Adding a Panel

1. Build the panel as its own component in `website/app/display/`, following
   `MallardPanel.tsx` as a template: fetch its own data, manage its own polling, render
   `fixed inset-0` full-bleed.
2. Add a slot to `ROTATION` in `page.tsx` saying what each screen shows during it (or
   put it on one side of an existing slot).
3. If it's slow to start, give its panel entry a `prepare` hook (see below).

### Screens and Rotation

The kiosk runs one browser per screen and opens this page as `/display?screen=primary`
on the screen surf cams play on (the external monitor, below) and
`/display?screen=secondary` on the other (the laptop's own screen, on top). A lone
screen gets `?screen=solo`, which shows the primary side plus the keyboard overlay; no
param means solo too, so opening `/display` in a normal browser shows the full thing.

The two screens are coordinated: `ROTATION` is a list of slots, and each slot says what
both screens show at the same time:

| Slot | Primary (monitor, below) | Secondary (laptop, top) |
|------|--------------------------|-------------------------|
| photos | photos | photos, staggered |
| mallards | photos (carries on) | mallard count |
| each of the five cams | the live cam | that spot's waves, wind and tide |

The active slot comes from the wall clock, not a timer chain (`useClockSlot.ts`): time
is cut into `PANEL_ROTATE_INTERVAL_MS` slots counted from the epoch, and slot `n` is
`ROTATION[n % ROTATION.length]`. Both screens share the laptop's clock, so they switch at
the same instant and stay paired, and a reloaded page lands straight on the current slot.
The keyboard can change this (below); with no keys pressed it's exactly this.

Only the primary side of a cam slot talks to the agent's player: mpv plays on the primary
screen, so exactly one page may send it `show`/`stop`, or the two pages would start and
kill each other's video. The secondary side only reads conditions.

**Staggered photos:** each screen shuffles the photo list on its own, so they show
different photos. Both change every `PHOTO_ROTATE_INTERVAL_MS` on wall-clock boundaries,
but the secondary (`<PhotoPanel staggered />`) is offset by half an interval, so the
screens take turns: one changes, then the other, at even spacing. The primary photo
panel renders identically in the photos and mallards slots, so React keeps it mounted
across them and the slideshow carries on without reloading.

### Keyboard Control

The laptop's keyboard drives the display. Every key works from anywhere (no need to open
the menu first); tab just shows the list on the top screen.

| Key | Does |
|-----|------|
| `tab` | open/close the shortcut menu |
| `1` | hold the photos: both screens stop on the photo they're showing |
| `2` | hold the mallard counter |
| `3` | rotate through the surf cams only (from the first) |
| `4`-`8` | hold one cam (in `SURF_CAMS` order: PB, La Jolla Shores, Scripps, Scripps underwater, Moonlight) |
| `]` / `[` | next / previous: the next photo while photos are held, the next slot while a slot is held (still held), else skip the rotation ahead (the new item gets a full interval) |
| `backspace` | back one step: closes the menu if it's open, else ends the hold or cam-only rotation |
| `esc` | straight back to the standard display |

A hold or the cam-only rotation shows a small indicator in the top right of the top
screen ("held" / "surf cams only", "backspace to return"). Everything goes back to the
standard rotation when the overnight sleep starts.

**How it works:** xbindkeys on displaytop grabs those keys system-wide (so they work even
while mpv has focus) and posts each press to the surfcam agent, which keeps a log of the
presses since the last reset (`pi/services/surfcam-agent/kiosk_control.py`). Each page
long-polls `GET /control/log` and replays the whole log through `replayControl` in
`kioskControl.ts`, a pure state machine, so both screens always agree, and a page that
reloads (or opens mid-day) replays the log and lands in the same place. The log is
cleared by `kiosk-run.sh` when the sleep window starts, and by an agent restart.

The rotation's position is an anchor (`anchorMs`, `anchorIndex`): at `anchorMs` it's on
item `anchorIndex` of its list (all slots, or just the cams) and moves on one per
interval. With no keys pressed the anchor is (0, 0), i.e. the plain wall clock. `]`/`[`
re-anchor at the press. A photo hold freezes each `PhotoPanel` on the photo its own clock
slot gave at the moment `1` was pressed.

To add a shortcut, add an entry to `SHORTCUTS` in `page.tsx` (a free digit key; the
kiosk grabs 1-9). A new kind of action needs a case in `kioskControl.ts`. New physical
keys need adding to `CONTROL_KEYS` in both `setup-displaytop.sh` and `kiosk_control.py`.

### Preparing Panels Ahead of Time

A panel entry can define `prepare()`. The rotation controller calls it
`PANEL_PREPARE_LEAD_MS` before that panel is due on screen, so slow-starting content
(a live video stream) loads in the background and appears already running. Panels
without `prepare` are unaffected. Right now only surf cams use it.

Panels not yet built are listed in a comment at the top of `page.tsx` rather than kept
in the active rotation with `PlaceholderPanel` — add a panel to a list (optionally
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

Live cams (Pacific Beach, La Jolla Shores, Scripps Pier above and below water, Moonlight
Beach in Encinitas) are normal rotation entries, but the video isn't played by the page.
The streams are from HDOnTap and Surfline's free cams, which both block playback from
other sites' pages, so a small agent on displaytop plays them in mpv fullscreen on top
of Chrome (`pi/services/surfcam-agent/README.md`, which also lists the cams and how to
add one).

`SurfCamPanel` calls the agent's `show` on mount and `stop` on unmount; the rotation's
`prepare` hook calls `prepare` a few seconds earlier, which starts mpv paused and
minimized so it's already buffered when the panel comes up. The stream therefore runs a
few seconds behind real time, which is fine for ambient viewing.

While a cam shows, the agent draws an overlay on the video (place name, waves, wind,
tide; readings from somewhere other than the cam are tagged with where they came from).
That lives entirely in the agent -- see `pi/services/surfcam-agent/README.md`.

The video plays on the external monitor, which the kiosk makes primary (see
`pi/docs/services/display-kiosk.md`). Meanwhile the laptop screen above shows
`SurfConditionsPanel` for the same cam, reading `GET /cams/<cam>/conditions` from the
agent: the same cached readings as the overlay, as structured json (shape in the agent
README; the data sources are explained there too). Waves and wind each get a compass dial
(north up) with an arrow pointing the way the waves/wind are heading, next to the compass
name and degrees they come from (`from WSW 248°`) and a grey note saying where the
reading is from (CDIP nearshore nowcast, measured at Scripps Pier, or forecast model).
The tide shows its height now and next high/low beside `TideGraph`, a normal tide chart
across the past 12 h and next 24 h: the predicted curve (blue, filled), the gauge's
measured water level over the past (white), a dashed "now" line, and each high/low
labelled with its height and time. The measured line often sits off the prediction;
that's real (surge, swell setup), and it's why the height now uses the measurement.

The page talks to the agent at `http://127.0.0.1:8765`, which only exists on displaytop.
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

This page runs on a Surface Laptop 3 (displaytop, see `pi/docs/services/display-kiosk.md`)
with 8 GB of RAM and two screens, each running its own browser. That's plenty, but it's
an always-on kiosk on a solar battery, so panels should stay cheap. Any panel that
animates many elements should follow the pattern established
in `MallardPanel.tsx`: draw on a single `<canvas>` with one `requestAnimationFrame`
loop rather than many independently CSS-animated DOM nodes, pre-render repeated images
once to an offscreen canvas instead of redrawing them every frame, and cap how many
elements actually render/animate regardless of the "real" underlying number.
