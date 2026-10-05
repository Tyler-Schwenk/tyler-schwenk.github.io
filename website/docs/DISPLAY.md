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
| `website/app/display/page.tsx` | Rotation controller — pairs each slot with what each screen shows (`ROTATION`); picks this screen's side from `?screen=` |
| `website/app/display/displayConfig.ts` | What the display shows, with no panels in it: `ROTATION_SLOTS`, `BPM_VIEW_INFO`, `SHORTCUTS`, `CONTROL_CONFIG`, `PANEL_ROTATE_INTERVAL_MS`, and `describeDisplay` (the state in words). Shared with the admin page's remote |
| `website/app/display/layout.tsx` | Turns off page scrolling for `/display` (every panel is a fixed full-screen layer; without it the kiosk browser can show scrollbars) |
| `website/app/display/kioskControl.ts` | Keyboard control: the key-log state machine both pages (and the admin remote) replay (`replayControl`) and the long-poll hook (`useControlLog`) |
| `website/app/display/ControlOverlay.tsx` | The shortcut menu and the top-right "held" indicator |
| `website/app/display/useClockSlot.ts` | Wall-clock slot hook shared by the rotation and the photo slideshow |
| `website/app/display/PhotoPanel.tsx` | Full-bleed rotating slideshow of every public gallery's photos (`staggered` changes half a beat later) |
| `website/app/display/MallardPanel.tsx` | Current mallard count with a canvas-animated duck background |
| `website/app/display/SurfCamPanel.tsx` | Live surf cam; asks the surfcam agent on displaytop to play it (see "Surf Cams") |
| `website/app/display/SurfConditionsPanel.tsx` | Waves, wind (compass dials) and tide for a cam's spot, shown on the top screen while the cam plays below |
| `website/app/display/TideGraph.tsx` | The tide chart on the conditions panel: predicted curve, measured line, now marker, highs/lows |
| `website/app/display/surfCams.ts` | Client for the surfcam agent (`prepareSurfCam`, `showSurfCam`, `stopSurfCam`, `fetchSurfConditions`) and the `SurfCamId` list |
| `website/app/display/BpmPanel.tsx` | Bpm mode's slot (key only, never rotated): `BPM_VIEWS` (each view's info paired with its component), holds the bpm agent's stream open, picks what this screen shows |
| `website/app/display/BpmVisualizer.tsx` | View 1, spectrum bars: mirrored bars that rise and fall with the music and pulse on the beat |
| `website/app/display/BpmCalibration.tsx` | View 2, calibration: spectrogram, onset curve with detected beats, level meter, tempo scores, beat flash |
| `website/app/display/BpmHalo.tsx` | View 3, halo: turning ring of spectrum spokes round a bass-driven core, light trails, sparks on each beat |
| `website/app/display/BpmDjView.tsx` | View 4, dj meters: low/mid/high meters in dB, beat counter, three-band scrolling waveform with beat grid |
| `website/app/display/BpmMilkdrop.tsx` | View 5, milkdrop: all ~395 MilkDrop presets via butterchurn (WebGL), fed the agent's raw waveform, a new preset every 32 beats or by hand with ] / [ |
| `website/app/display/butterchurn.d.ts` | Minimal types for the `butterchurn` and `butterchurn-presets` packages |
| `website/app/display/BpmReadout.tsx` | The tempo over a beat-pulsing ring and the current view's name, for the other screen |
| `website/app/display/bpmAgent.ts` | Client for the bpm agent on displaytop (`useBpmStream`) plus helpers the views share (beat phase/pulse/counting, band ranges, beat grid, time axis) |
| `website/app/display/spectrumLevels.ts` | Rise-and-fall spectrum levels with peak caps and auto gain, shared by the bars and halo views |
| `website/app/display/useCanvasLoop.ts` | Full-window canvas + `requestAnimationFrame` loop hook, used by the bpm views |
| `website/app/display/PlaceholderPanel.tsx` | Generic "Coming Soon: {name}" stand-in, reused as new panels get built |

### Adding a Panel

1. Build the panel as its own component in `website/app/display/`, following
   `MallardPanel.tsx` as a template: fetch its own data, manage its own polling, render
   `fixed inset-0` full-bleed.
2. Add a slot to `ROTATION_SLOTS` in `displayConfig.ts` (id and the name the remote shows),
   and its panels to `FIXED_SLOT_PANELS` in `page.tsx`, saying what each screen shows during
   it (or put it on one side of an existing slot).
3. If it's slow to start, give its panel entry a `prepare` hook (see below).

### Screens and Rotation

The kiosk runs one browser per screen and opens this page as `/display?screen=primary`
on the screen surf cams play on (the external monitor, below) and
`/display?screen=secondary` on the other (the laptop's own screen, on top). A lone
screen gets `?screen=solo`, which shows the primary side plus the keyboard overlay; no
param means solo too, so opening `/display` in a normal browser shows the full thing.

The two screens are coordinated: `ROTATION_SLOTS` is a list of slots, and each slot says what
both screens show at the same time:

| Slot | Primary (monitor, below) | Secondary (laptop, top) |
|------|--------------------------|-------------------------|
| photos | photos | photos, staggered |
| mallards | photos (carries on) | mallard count |
| each of the five cams | the live cam | that spot's waves, wind and tide |

Bpm mode is a slot too, but it's not in `ROTATION_SLOTS`: it only comes up from its key (`b`,
below), since it keeps the mic recording while it's on screen. It has its own views (see
"BPM Visualizer") on the primary screen and the tempo on the other.

The active slot comes from the wall clock, not a timer chain (`useClockSlot.ts`): time
is cut into `PANEL_ROTATE_INTERVAL_MS` slots counted from the epoch, and slot `n` is
`ROTATION_SLOTS[n % ROTATION_SLOTS.length]`. Both screens share the laptop's clock, so they switch at
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
| `b` | bpm mode, cycling through its views (keys inside it below) |
| `]` / `[` | next / previous, and hold there: the next photo while photos are held, otherwise the next slot (photos, mallards, each cam) from wherever it was; backspace resumes the rotation |
| `backspace` | back one step: closes the menu if it's open, else ends the hold or cam-only rotation |
| `esc` | straight back to the standard display |

A hold (including one from `]`/`[`), the cam-only rotation or bpm mode shows a small indicator in the top right of the top
screen ("held" / "surf cams only" / "bpm" / "bpm, held", "backspace to return"). Everything goes back to the
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
interval. With no keys pressed the anchor is (0, 0), i.e. the plain wall clock; starting the
cam-only rotation anchors it at the press so it begins on the first cam. Bpm mode's cycling
uses the same anchor to count its views, anchored at the press that started it. A photo hold freezes each `PhotoPanel` on the photo its own clock
slot gave at the moment `1` was pressed.

Inside bpm mode the keys work on its views instead (the tab menu lists them):

| Key | Does |
|-----|------|
| `1`-`5` | hold that view (in `BPM_VIEWS` order: spectrum bars, calibration, halo, dj meters, milkdrop); other digits do nothing |
| `]` / `[` | next / previous view, and hold there. On milkdrop: next / previous preset instead, holding the view and the preset |
| `b` | back to cycling, from the view that's up |
| `-` / `=` | move the beat earlier / later on screen by 10 ms (calibration, see "BPM Visualizer") |
| `backspace` | from a held preset back to presets moving on by themselves; from a held view back to cycling; from cycling out of bpm mode |
| `esc` | straight back to the standard display |

`-` and `=` are the exception to the key log: xbindkeys posts them straight to the bpm
agent (`POST /offset/earlier|later` on port 8766), since the offset is the agent's
setting, not display state. The agent ignores them unless bpm mode is up.

To add a shortcut, add an entry to `SHORTCUTS` in `displayConfig.ts` (a free key; the kiosk grabs
1-9 and b). It shows up on the admin remote by itself. A new kind of action needs a case in `kioskControl.ts`. New physical
keys need adding to `CONTROL_KEYS` in both `setup-displaytop.sh` and `kiosk_control.py`, and to
`DisplayKey` in the website backend's `schemas.py` for the remote to send them.

### Remote Control (admin page)

The admin page's Display tab (`website/docs/ADMIN.md`) presses the same keys from a phone
or laptop anywhere. Its presses go through the website backend to the surfcam agent,
which adds them to the same key log, so to the pages they're no different from the
keyboard: both screens replay them, the overlay shows "held" and so on. The agent also
sends the log back up, and the remote replays it through `replayControl` to show what's on
screen. See `pi/services/surfcam-agent/README.md` ("Remote control").

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

## BPM Visualizer

A USB mic on displaytop listens to whatever's playing in the room, and the bpm agent
(`pi/services/bpm-agent/README.md`) finds its beat and streams it to the page. It's only
shown from the `b` key, and the mic only records while it's up: `BpmPanel` holds the
agent's event stream (`GET http://127.0.0.1:8766/stream`) open while mounted, and the
agent starts recording when the first page connects and stops a few seconds after the
last one leaves.

Both screens render `BpmPanel`, so both hold the stream. The primary screen shows the
current view, the secondary `BpmReadout` (the tempo over a ring that pulses on the beat,
and the view's name). The views, in `BPM_VIEWS` order:

| # | View | What it shows |
|---|------|---------------|
| 1 | spectrum bars (`BpmVisualizer`) | 64 bands as bars mirrored out from the centre (bass in the middle), jumping up with the music and falling back under gravity with slower peak caps. On each beat the bars kick taller and brighter, a glow flashes behind them, and the colours step round |
| 2 | calibration (`BpmCalibration`) | What the agent hears (below); the readout adds the calibration keys |
| 3 | halo (`BpmHalo`) | A slowly turning ring of spectrum spokes round a glowing core that swells with the bass, drawn with light trails. Each beat throws a burst of sparks outward, kicks the spin and steps the colours |
| 4 | dj meters (`BpmDjView`) | The room split like a mixer's three-band EQ (low < 250 Hz, mid to 2.5 kHz, high above): a meter per band in dB with peak hold, the tempo with a four-beat counter and phase bar, and a scrolling three-band waveform (blue lows, orange mids, white highs, like CDJ waveforms) under the detected beat grid |
| 5 | milkdrop (`BpmMilkdrop`) | MilkDrop presets (below) |

Bpm mode starts cycling through them every `PANEL_ROTATE_INTERVAL_MS`, or holds one (keys
under "Keyboard Control"). `BpmPanel` is the same component whichever view is up, so
changing views doesn't drop the stream or make the tracker start over. The bars and halo
use auto gain (the loudest recent band is full height), so they work whatever the volume;
the dj meters don't, so they read like a level meter. The four-beat counter just counts
beats: it doesn't know where the bar's downbeat is.

To add a view, build it as a component taking `{ stream }` that draws through
`useCanvasLoop`, add its info to `BPM_VIEW_INFO` in `displayConfig.ts` and its component
to `BPM_VIEW_COMPONENTS` in `BpmPanel.tsx` (digits 1-9 can pick up to
nine views). A view that needs the raw audio sets `needsWaveform` (see MilkDrop).

**MilkDrop** (`BpmMilkdrop`): the Winamp visualizer's presets, run in WebGL 2 by
[butterchurn](https://github.com/jberg/butterchurn) with every preset from all four
`butterchurn-presets` packs: base, Extra, Extra2 and MD1, ~395 once the few that appear in
more than one pack are merged (both MIT, stable 2.x). MilkDrop presets react to the raw waveform,
not to bands, so this view's `BPM_VIEW_INFO` entry sets `needsWaveform`, and `BpmPanel` opens the
primary screen's stream with `?waveform=1`: the agent then also sends the latest 1024
samples with every hop. Butterchurn's `render({ audioLevels })` takes those directly, so
it's created without an AudioContext and the page never touches the mic (the agent stays
its only user). Switching to or from this view reopens the primary page's stream, which
the agent's grace period covers.

- A room mic is far quieter than the line-level audio MilkDrop expects, so the waveform
  gets an auto gain first (loudest recent sample scaled to ~80% of full scale, at most
  24x), or most presets' wave shapes would be flat lines
- Presets play in a shuffled order and blend into the next over 2.7 s, on a beat, every
  32 beats (or every 30 s with no beat). Each new preset's place in the order and name show
  in the corner for a few seconds
- `]` / `[` step through that order by hand (a quicker 1 s blend) and hold the preset, which
  then stays put with "held" in the corner until backspace. The key log only records how
  many steps (`PresetControl.step`), and the view moves by however much that changes, so the
  order itself is per page load and not shared (only the primary screen runs milkdrop)
- It draws at 1280 px wide (the height follows the screen's shape) and the browser scales
  that up, so the GPU isn't rendering 2560x1440 MilkDrop shaders all evening
- butterchurn and the four packs are their own chunks (~450 KB gzipped together), only
  fetched when the view opens. Parsed, the presets take ~10 MB of memory; only the one or
  two on screen are compiled into shaders

**Beat sync:** the agent runs on the same machine, so its beat times are on the page's
clock. Each `tempo` event gives a beat time (`beat_ms`, calibration offset already
applied) and the period; `beatPhase` in `bpmAgent.ts` works out where in the beat `now`
is, and `beatPulse` turns that into a 0-1 pulse that jumps to 1 on the beat and fades.
Every view draws from that, so they all pulse together. The agent smooths the beat
clock itself, so the page never sees it jump.

**Calibration** (`b`, then `2`): play a click track, then `-`/`=` until the flash lands on
the click. The view also shows the spectrogram with the beat band marked, the onset
curve with the detected beats, the level against the silence threshold, and every
tempo's score. Details in the agent README.

Frames (~86 a second) go into a ref rather than React state, and each view draws from it
in one `requestAnimationFrame` loop (`useCanvasLoop`), per "Hardware Constraints" below.

Anywhere but the kiosk the panel just shows "bpm agent unreachable".

## Hardware Constraints

This page runs on a Surface Laptop 3 (displaytop, see `pi/docs/services/display-kiosk.md`)
with 8 GB of RAM and two screens, each running its own browser. That's plenty, but it's
an always-on kiosk on a solar battery, so panels should stay cheap. Any panel that
animates many elements should follow the pattern established
in `MallardPanel.tsx`: draw on a single `<canvas>` with one `requestAnimationFrame`
loop rather than many independently CSS-animated DOM nodes, pre-render repeated images
once to an offscreen canvas instead of redrawing them every frame, and cap how many
elements actually render/animate regardless of the "real" underlying number.
