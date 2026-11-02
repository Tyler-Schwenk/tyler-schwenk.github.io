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
| `components/kiln/KilnConsole.tsx` | Page layout, polling, live and past firing views |
| `components/kiln/TemperatureChart.tsx` | Full-width SVG line chart, with crosshair, tooltip and table view |
| `components/kiln/FiringCard.tsx` | A past firing's tile in the grid |
| `app/globals.css` (`.kiln-*` rules) | The page's theme tokens and styles |
| `lib/useKilnFiring.ts` | Checks once whether a firing's in progress, for the home page sprite |
| `public/images/kiln/kiln-idle.png`, `kiln-firing.png` | The kiln art on this page |
| `public/images/8bit/kiln-idle.png`, `kiln-firing.png` | The same art shrunk for the home page |

## Views

- **`/kiln`**: the live view. Status line, current temperature, rise over the last 30 minutes and
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
a fault or there's a hole in the data, rather than drawing a slope across it. "View as table" shows
up to 24 evenly spaced readings for anyone who can't use the chart.

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
