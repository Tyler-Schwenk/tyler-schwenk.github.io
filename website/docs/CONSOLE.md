# Console Page

## Overview

`/console` shows the corner console where displaytop lives (`pi/docs/services/display-kiosk.md`),
drawn like a CAD render, with a simulation of the display kiosk (`website/docs/DISPLAY.md`)
running on its two screens in perspective. It's an accurate simulation, not a mirror:

- the screens run the kiosk's own rotation, panels and key handling, on the wall clock, so
  with no keys pressed they show the slot the real screens are on
- visitors press the kiosk's keys from the deck beside the scene (or their keyboard), and
  only their own copy changes; the real kiosk never hears about it
- photos and the mallard count are fetched live like on the kiosk (each screen shuffles its
  own photos, so they aren't the same photos the real screens show)
- what only exists on displaytop gets a stand-in: the surf cam video, the surf conditions,
  and the room mic (a synthesised song)

Tapping a screen zooms the view into it; with a mouse the scene leans slightly toward the
pointer (not with `prefers-reduced-motion`).

## Files

| File | Purpose |
|------|---------|
| `website/app/console/page.tsx` | Control state, the simulated environment, physical keyboard mapping, the layout |
| `website/app/console/ConsoleScene.tsx` | The illustration, both screens, the lid shading, the zoom and tilt |
| `website/app/console/ScreenSurface.tsx` | A box at a screen's native resolution, warped onto its corners |
| `website/app/console/sceneGeometry.ts` | Each screen's resolution and corners in the illustration, the lid strip, and the perspective math (`quadTransform`, `quadBounds`, `quadPoints`) |
| `website/app/console/ConsoleControls.tsx` | The key deck, the "now showing" line, the sound switch |
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
machine, on a local state instead of the agent's key log. The `ControlOverlay` (tab menu,
"held" indicator) draws on the laptop screen, as on the kiosk's secondary screen.

**Keys:** the deck has every kiosk key. The physical keyboard maps `1`-`9`, `b`, `[`, `]`,
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
switching views doesn't restart the song. The song plays out loud by default; the deck's
`snd` key mutes it without stopping the views.

To use a real song instead: implement `SimSong` (`bpm`, `firstBeatS`, and `render`, which
can fetch and `decodeAudioData` a file) and pass it to `SimBpmEngine` in `page.tsx`. The
loop must be a whole number of beats long, or the beat drifts each time it loops.

### Simulated Surf Cams

`SimSurfCamPanel` draws a scene per cam on a canvas at 30 fps (`SCENES`): a beach with swell
rolling in and breaking, a headland for the La Jolla cams, the pier for Scripps, and the
piling, fish and light rays for the underwater cam. Over it is the agent's info bar, laid out
in mpv's 1920x1080 osd units like `build_overlay_ass` and worded like `get_metrics`.

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

- **Desktop (lg and up):** the scene fills the left of the window, the deck sits in a
  scrolling sidebar on the right
- **Phones:** the scene is a square on top that sticks to the top of the viewport (at most
  60% of its height), and the deck scrolls underneath, so the screens stay in view while
  pressing keys. Keys are at least 44 px tall. The tilt is off without a mouse

Both screens run the kiosk's panels at full native resolution, which is the same work the
kiosk does; on a phone the canvases cost more battery than a normal page.
