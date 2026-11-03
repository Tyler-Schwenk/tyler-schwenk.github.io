# Kiln Page

`/kiln` is the public console for the kiln: current temperature, rate of rise, the current
firing's curve, and every past firing. The home page links to it with the kiln sprite. The
sprite and the art on this page both show flames and smoke while a firing's in progress, and a cold
kiln otherwise.

The readings come from a thermocouple logger on castpi, through the website backend on
fart-pi. See [`pi/docs/services/kiln-logger.md`](../../pi/docs/services/kiln-logger.md) for that
side, and [the API docs](../../pi/docs/api/website-backend-api.md#kiln) for the endpoints.

## Files

| File | What it does |
|---|---|
| `app/kiln/page.tsx` | Route and metadata. Wraps the console in the Suspense boundary `useSearchParams` needs |
| `app/kiln/kilnApi.ts` | Types and fetchers for the public `/kiln` endpoints |
| `app/kiln/kilnFormat.ts` | Unit conversion and number, rate and date formatting |
| `app/kiln/kilnCurve.ts` | Turns a curve into chart points, finds gaps, and works out the rate at a point |
| `app/kiln/kilnForecast.ts` | The calculator's predictions. No React, so they can be replayed against real data |
| `components/kiln/KilnConsole.tsx` | Page layout, polling, live and past firing views |
| `components/kiln/TemperatureChart.tsx` | Full-width SVG line chart, with crosshair and tooltip |
| `components/kiln/ReadingsTable.tsx` | The readings as a table, with adjustable spacing, sorting and CSV download |
| `components/kiln/KilnCalculator.tsx` | Estimates how long until a temperature, and how hot it'll be later |
| `components/kiln/FiringCard.tsx` | A past firing's tile in the grid |
| `app/globals.css` (`.kiln-*` rules) | The page's theme tokens and styles |
| `lib/useKilnFiring.ts` | Checks once whether a firing's in progress, for the home page sprite |
| `public/images/kiln/kiln-idle.png`, `kiln-firing.png` | The kiln art on this page |
| `public/images/8bit/kiln-idle.png`, `kiln-firing.png` | The same art shrunk for the home page |

## Views

- **`/kiln`**: the live view. Status line, a "What's this?" dropdown saying who it's for and how the
  readings get here, current temperature, rise over the last 30 minutes and
  hour, firing time, peak, and the current firing's curve
- **`/kiln?firing=<id>`**: one firing, with its peak, duration, start and finish. It's a query
  parameter rather than a path because a static export can't generate pages for firings that
  don't exist yet

Both show the past firings grid. The status line separates live, no firing in progress, probe
disconnected, logger offline, and backend unreachable. Temperature and rates show `--` unless
they're live, so an old number never looks current.

## Data

All temperatures arrive in Celsius and the page shows them in Fahrenheit. The rates are
differences, so converting them skips the 32 degree offset.

| What | How often | Endpoint |
|---|---|---|
| Live readout | 10 s | `GET /kiln/status` |
| Curve being shown | 30 s | `GET /kiln/firings/{id}/curve` |
| Past firings list | 60 s | `GET /kiln/firings` |
| A card's thumbnail | Once | `GET /kiln/firings/{id}/curve?max_points=80` |

Polling pauses while the tab's hidden. Graphs are always drawn from stored readings, so there are
no saved images. A curve averages down to at most 1,500 points, so a long firing costs the same to
draw as a short one.

## Chart

Hand-written SVG, sized to its container with a `ResizeObserver`, with no chart library. Hovering
shows the temperature, the time, and the rate of rise there, measured 10 minutes either side of the
point without crossing a gap, and shown as `--` with under 2 minutes of data around it. It has one
series, so the section title names it and there's no legend. The line breaks wherever the probe had
a fault or there's a hole in the data, rather than drawing a slope across it.

## Table

"View as table" sits under the chart, closed to start. It has a row per 15 minutes, 30 minutes or
hour on round clock times, with the time since the start, the temperature, and the rate at that point,
newest first or oldest first. The peak always gets its own row, and an interval with only faults
shows "Probe out". The header stays put while the table scrolls. "Download CSV" saves every point on
the curve, up to 1,500 of them, rather than just the rows showing.

## Calculator

Sits between the chart and past firings, in the live view only, while a firing's in progress. It
answers "when will it reach this temperature?" and "how hot will it be in this many hours?", each with
a likely range. It needs a live temperature and at least 20 minutes of readings in the last hour.

It works out the phase from the last hour's trend: heating, cooling, or holding steady under 15 °F/hr.

- **Cooling**: an exponential curve toward 70 °F, using how fast that gap closed over the last hour,
  because the rate is close to proportional to how far above room temperature the kiln is. Replaying
  the first firing's cooldown, this was typically within 5%, where assuming the current rate would
  hold was 30-40% too soon on anything hours out. The range shown is 15%
- **Just after the peak**: for 2.5 hours the last hour is misleading, since the kiln lingers near the
  top before it really starts dropping. So it uses a typical cooling constant of 0.16 per hour, from the
  first firing, with a 30% range and a note saying it's extra rough
- **Heating**: a straight line at the last hour's pace, typically within 25%, with a 30% range. It
  depends on how the burner's set, and it usually slows down near the top, so the page calls it a rough
  guide. The actual time landed in the range about two-thirds of the time

All of those numbers come from one firing, and the 0.16 was measured on the same firing it was tested
against, so re-check them as more firings come in. The logic has no React in it, so it can be replayed
against any firing's curve. Once a firing has finished, the time estimate also shows how long the same
change took in the most recent finished firing.

## Kiln art

Both images have the same canvas, with the kiln in the same spot, so swapping them doesn't move
it. The idle image has empty space at the top, where the firing one has its smoke. The page follows
`status.firing`, so the kiln keeps showing as firing for up to 6 hours after the probe's pulled,
until the backend marks that firing finished.

## Theme

A quiet ceramics catalog look, on white in both color schemes.

- **Fonts**: Instrument Serif (`--font-kiln-display`) for the title and current temperature,
  Instrument Sans (`--font-kiln-text`) for everything else. Both load only on this page
- **Tokens**: under `.kiln-theme` in `app/globals.css`
- **Line color**: `--kiln-clay` (`#a8502a`), a fired clay rust. Passes the dataviz palette validator
  against white. It's only used for data marks, never text
- **Tiles**: past firings use a gray gradient and 12 px corners, with their text underneath
