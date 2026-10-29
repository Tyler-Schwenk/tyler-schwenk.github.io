# Console Page

## Overview

`/console` shows the corner console where displaytop lives (`pi/docs/services/display-kiosk.md`),
drawn like a CAD render, with a simulation of the display kiosk (`website/docs/DISPLAY.md`)
running on its two screens in perspective. It's an accurate simulation, not a mirror:

- the screens run the kiosk's own rotation, panels and key handling, on the wall clock, so
  with no keys pressed they show the slot the real screens are on
- visitors drive it from the info panel beside the scene (or the kiosk's keys on their
  keyboard), and only their own copy changes; the real kiosk never hears about it
- photos and the mallard count are fetched live like on the kiosk (each screen shuffles its
  own photos, so they aren't the same photos the real screens show)
- what only exists on displaytop gets a stand-in: the surf cam video, the surf conditions,
  and the room mic (a synthesised song)

The solar page (`/solar`, "What It Runs") links here with a tilted still of the console
(`ConsolePreview` in `website/app/solar/page.tsx`), since the console runs on that setup.

Tapping a screen zooms the view into it. With a mouse the scene leans up to 2 degrees
toward the pointer, just enough to read as 3d (not with `prefers-reduced-motion`).

## Files

| File | Purpose |
|------|---------|
| `website/app/console/page.tsx` | Control state, the simulated environment, physical keyboard mapping, the layout |
| `website/app/console/consoleSections.ts` | The panel's sections: tab labels, descriptions, the state each one puts the screens in, and which section a display mode belongs to |
| `website/app/console/ConsolePanel.tsx` | The info and control panel: section tabs, the "now showing" line, each section's controls and description |
| `website/app/console/ConsoleScene.tsx` | The illustration, both screens, the lid shading, the zoom and tilt |
| `website/app/console/ScreenSurface.tsx` | A box at a screen's native resolution, warped onto its corners |
| `website/app/console/sceneGeometry.ts` | Each screen's resolution and corners in the illustration, the lid strip, and the perspective math (`quadTransform`, `quadBounds`, `quadPoints`) |
| `website/app/console/SimSurfCamPanel.tsx` | Surf cam stand-in: an animated canvas scene per cam plus the agent's info overlay |
| `website/app/console/simSurf.ts` | Made-up surf conditions in the surfcam agent's json format |
| `website/app/console/simBpmEngine.ts` | Stand-in for the bpm agent: plays a song and streams frames and tempo |
| `website/app/console/simSong.ts` | The song: a 122 bpm house loop synthesised in the browser |

## How the Simulation Plugs In

The display's panels don't know they're on the console. Two shared pieces make that work
(see "Running Elsewhere" in `DISPLAY.md`):

- `displayRotation.tsx`'s `DisplayScreen` renders one screen for a control state and clock
  slot, exactly as the kiosk page does
- a `DisplayEnvironmentProvider` swaps what panels get from displaytop's agents:

| Environment field | Kiosk | Console |
|-------------------|-------|---------|
| `connectBpm` | the bpm agent's event stream | `SimBpmEngine.connect` |
| `fetchSurfConditions` | the surfcam agent | `fetchSimulatedSurfConditions` |
| `SurfCamPanel` | asks the agent's mpv to play the cam | `SimSurfCamPanel` |
| `reportPlayingPreset` | tells the admin remote | does nothing |

Key presses go through `applyControlEvent` from `kioskControl.ts`, the kiosk's own state
machine, on a local state instead of the agent's key log. The `ControlOverlay`'s "held"
indicator draws on the laptop screen, as on the kiosk's secondary screen (its tab menu
never opens here, since the panel replaces it and tab is left for page focus).

## The Panel

The panel beside the scene has a tab per section (`CONSOLE_SECTIONS`). Each shows the "now
showing" line, that section's controls, and a description of what it is:

| Section | Picking it puts the screens on | Controls |
|---------|--------------------------------|----------|
| overview (default) | the standard rotation | the rotation's slots, the current one lit; picking one stays on it |
| photos | the photos slot, photos still changing | keep changing / freeze this photo, and previous/next while frozen |
| mallards | the mallard counter | none |
| surf cams | the cam-only rotation | all cams rotating, or one cam; a link to the real stream of the cam that's up |
| bpm | bpm mode, cycling the views | cycle or hold the monitor's view, previous/next (views, or milkdrop presets), what the laptop screen shows (same as the monitor, a view, or the tempo), sound, beat earlier/later |

The tab isn't its own state: it's worked out from the display mode (`sectionForMode`), so
keys pressed on the keyboard move the panel too. Picking the tab that's already up does
nothing, so it doesn't restart a rotation. Every control goes through the kiosk's state
machine, except holding a slot: the kiosk has no key that holds the photos slot without
freezing the photo, so the panel builds `hold-slot` states directly (`holdSlotState`), the
same state ] and [ lead to on the kiosk.

The overview's "how it works" text is placeholder lorem ipsum for now.

**Keys:** the physical keyboard maps `1`-`9`, `b`, `[`, `]`,
backspace, esc, `-` and `=`; tab isn't taken over, so it still moves focus around the page.
`-`/`=` nudge the simulated beat 10 ms earlier/later (only in bpm mode, like the agent).

### Simulated BPM

`SimBpmEngine` plays `HOUSE_LOOP` through web audio and analyses it the way the bpm agent
does (`pi/services/bpm-agent/beat_tracker.py`): 64 log-spaced bands from 40 Hz to 12 kHz on
the agent's -90 to -10 dB scale, bass spectral-flux onsets (40-200 Hz), per-hop rms level and
a 1024-sample waveform, at the agent's ~86 frames a second. The analyser's output is shifted
13.56 dB to match the agent's fft normalisation, and turned down 18 dB to land near what the
room mic hears.

The tempo isn't tracked: it's the song's own, so the beat is exact. Like the agent, it
reports no tempo for the first 4 s, sends a prior-weighted tempo curve (a peak at the song's
tempo, smaller ones at its relatives), and updates every 250 ms. Beat times are converted
from the audio clock to `Date.now()` with `getOutputTimestamp`, so the pulse lands when the
sound comes out of the speakers.

The engine starts when the first stream connects (bpm mode opening, always after a key
press, which browsers need before audio can play) and stops 5 s after the last closes, so
switching views doesn't restart the song. The song plays out loud by default; the bpm
section's sound switch mutes it without stopping the views.

To use a real song instead: implement `SimSong` (`bpm`, `firstBeatS`, and `render`, which
can fetch and `decodeAudioData` a file) and pass it to `SimBpmEngine` in `page.tsx`. The
loop must be a whole number of beats long, or the beat drifts each time it loops.

### Simulated Surf Cams

`SimSurfCamPanel` draws a scene per cam on a canvas at 30 fps (`SCENES`): a beach with swell
rolling in and breaking, a headland for the La Jolla cams, the pier for Scripps, and the
piling, fish and light rays for the underwater cam. Over it is the agent's info bar, laid out
in mpv's 1920x1080 osd units like `build_overlay_ass` and worded like `get_metrics`.

**Why not the real streams:** they can't play on this site. HDOnTap's embed player
(`portal.hdontap.com/s/embed/?stream=<id>`) asks its backend for the stream with the
embedding site's origin, and the backend only answers for domains the cam's owner has
allowed; for tyler-schwenk.com it returns a "blocked" image instead. Its public `/embed/`
pages send `X-Frame-Options: DENY`, and the HLS playlists refuse other origins (403).
Surfline's embed player is for its partners (403). Spoofing the origin or relaying the
streams through the Pi would get round the owners' restrictions, so it isn't done. Instead,
while a cam is up the surf cams section links to its real stream (`LIVE_CAM_PAGES` in `simSurf.ts`).
If a cam owner ever allow-lists tyler-schwenk.com, that cam's stand-in could become an
iframe of the portal player.

`simSurf.ts` makes conditions in the agent's format, so the real `SurfConditionsPanel` and
`TideGraph` show them unchanged. The tide is a harmonic curve with La Jolla's main
constituents (the mixed two-highs-two-lows shape, though not the real times), with the
"measured" line wobbling slightly off it. Waves drift between plausible bounds over a few
days, and wind goes from a light morning offshore to an afternoon westerly. Wind and tide
sources follow the agent's `CAMS` (measured at Scripps Pier for the La Jolla cams, forecast
model for the rest; tide tagged "from Scripps Pier" away from the pier).

## How the Screens Are Placed

The page shows `website/public/images/console.webp`. `console_marked.png` is the same
picture with colored corner brackets drawn on the screens, and the outer corners of those
brackets are the constants in `sceneGeometry.ts`:

| Marker | Marks |
|--------|-------|
| red | the LG monitor's four corners (primary screen, 2560 x 1440) |
| green | the laptop screen's top corners, and where the record player's clear lid starts covering it |
| purple | the laptop screen's real bottom corners, seen through the lid (secondary screen, 2256 x 1504) |

The scene is laid out in illustration pixels (1254 x 1254) and scaled as one unit. Each
screen is a `div` at its native resolution with `transform-origin: 0 0` and a `matrix3d`
transform mapping its rectangle onto the four corners (the projective square-to-quad
transform, see `quadTransform`). Panels lay out exactly as on the real screen.

The laptop screen runs from the green top corners down to the purple bottom ones. The strip
between the lower green brackets and the purple ones is behind the lid, so an SVG layer on
top frosts it slightly and draws a glint along the lid's edge.

**Zoom** moves the whole stage (one transform with a transition), scaling it so the
screen's bounding box fills the scene area. Nothing remounts, and because the panels render
at native resolution, a zoomed screen is sharp.

To redraw the illustration: mark the screens' corners on a copy in the same colors, read the
bracket corners into `sceneGeometry.ts`, and export a clean copy as `console.webp`.

## Layout

The illustration is drawn at 96% of the smaller side of its area, centred on the blueprint
grid, with rounded corners and a shadow so its edges show as it tilts.

- **Desktop (lg and up):** the scene's area is square and as tall as the window (narrower
  only if that would leave the panel less than 22rem), on the left; the panel takes the rest
  of the width, its content capped at `max-w-2xl` so wide screens don't stretch the text
- **Phones:** the scene sits on top, square, at most 55% of the height; the panel scrolls
  below it. Controls are at least 44 px tall for touch, and there's no tilt without a mouse

On touch screens (`pointer: coarse`, via tailwind's `pointer-coarse:` variant) a banner
above the scene says it's better viewed on a computer. Its x hides it until the page is
reloaded. It's gated in css rather than js, so desktop never renders it.

The home page links here ("THE CONSOLE" -- the record-player stand on the deck in the world view, icon `public/images/8bit/console.png`). See `HOME.md`.

Both screens run the kiosk's panels at full native resolution, which is the same work the
kiosk does; on a phone the canvases cost more battery than a normal page.

## Keeping It in Sync with the Kiosk

The console imports the kiosk's own code, so most changes to the display show up here on
the next deploy with nothing else to do:

- the rotation, its slots and timing (`displayConfig.ts`, `displayRotation.tsx`)
- the shortcuts and their labels, the bpm views, the key handling (`kioskControl.ts`)
- every panel's look and behaviour, the tab menu and the "held" indicator
- the cam list (`SURF_CAMS`)

These need updating by hand, and most of them fail the type check until they are:

| Change on the kiosk | Update on the console |
|---------------------|-----------------------|
| a new cam in `SURF_CAMS` | its scene (`SCENES`), place name (`CAM_PLACE_NAMES`) and live page (`LIVE_CAM_PAGES`); all three are keyed by cam id, so it won't compile without them |
| a new panel that talks to an agent | a field in `DisplayEnvironment` (`website/app/display/displayEnvironment.tsx`), which won't compile until the console gives it a stand-in |
| a new panel sized from `window` or `vw`/`vh` | size it from its panel instead (see "Running Elsewhere" in `DISPLAY.md`), or it'll be the wrong size on the console |
| the surfcam agent's overlay wording or layout, or its conditions' sources | `SimSurfCamPanel.tsx`, `simSurf.ts` |
| the bpm agent's analysis settings (bands, dB range, frame rate, tempo range) | the matching constants at the top of `simBpmEngine.ts` |
| the physical setup (a screen moved or swapped, a new resolution) | the illustration and the corners and resolutions in `sceneGeometry.ts` |

Trash night isn't simulated, so changes to it don't affect the console.

