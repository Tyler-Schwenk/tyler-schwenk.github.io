# Kiln Page

`/kiln` is the public console for the kiln: current temperature, rate of rise, the current
firing's curve, every past firing, and Jude's notes and photos on each firing. The home page links to it with the kiln sprite. The
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
| `app/kiln/kilnJournalApi.ts` | Types, fetchers and writes for notes and photos, the editor login's path and storage key, and photo urls |
| `app/kiln/kilnFormat.ts` | Unit conversion and number, rate and date formatting |
| `app/kiln/kilnCurve.ts` | Turns a curve into chart points, finds gaps, and works out the rate at a point |
| `app/kiln/kilnForecast.ts` | The calculator's predictions. No React, so they can be replayed against real data |
| `components/kiln/KilnConsole.tsx` | Page layout, polling, live and past firing views |
| `components/kiln/TemperatureChart.tsx` | Full-width SVG line chart, with crosshair and tooltip, and comparison lines |
| `components/kiln/CompareFirings.tsx` | The "Compare with" chips, and the hook that tracks and loads compared firings |
| `components/kiln/ReadingsTable.tsx` | The readings as a table, with adjustable spacing, sorting and CSV download |
| `components/kiln/KilnCalculator.tsx` | Estimates how long until a temperature, and how hot it'll be later |
| `components/kiln/FiringCard.tsx` | A past firing's tile in the grid |
| `components/kiln/useFiringJournal.ts` | Loads and polls the shown firing's notes and photos, with the editor's token if logged in |
| `components/kiln/FiringNotes.tsx` | The notes list, the add and edit form, and `numberPinnedNotes` for the chart's markers |
| `components/kiln/FiringPhotos.tsx` | The photo grid, the upload form, and the full-size viewer |
| `components/kiln/JournalControls.tsx` | Shared bits for both: chip pickers, the private/public toggle, and `useJournalAction` for writes |
| `components/kiln/KilnEditorLogin.tsx` | "Jude's login" at the bottom of the page |
| `app/globals.css` (`.kiln-*` rules) | The page's theme tokens and styles |
| `lib/useKilnFiring.ts` | Checks once whether a firing's in progress, for the home page sprite |
| `lib/usePolling.ts` | Runs a task now and on an interval, skipping ticks while the tab's hidden |
| `lib/useAdminAuth.ts` | Keeps the editor's token in localStorage (shared with the admin page and The Kitchen) |
| `public/images/kiln/kiln-idle.png`, `kiln-firing.png` | The kiln art on this page |
| `public/images/8bit/kiln-idle.png`, `kiln-firing.png` | The same art shrunk for the home page |

## Views

- **`/kiln`**: the live view. Status line, a "What's this?" dropdown saying who it's for and how the
  readings get here, current temperature, rise over the last 30 minutes and
  hour, firing time, peak, time to peak, and the current firing's curve
- **`/kiln?firing=<id>`**: one firing, with its peak, duration, time to peak, start and finish. It's a query
  parameter rather than a path because a static export can't generate pages for firings that
  don't exist yet

**Time to peak** runs from the firing's first reading to its hottest one (`peak_at`), and its label
gives the first reading's temperature, since logging can start partway up. In the live view it says
"Still climbing" while the 30 minute rate is positive, because the peak isn't final yet.

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
| A compared firing | Once, when first turned on | `GET /kiln/firings/{id}/curve?max_points=500` |
| Notes and photos on the shown firing | 60 s, and right after any change | `GET /kiln/firings/{id}/notes`, `/photos` |

Polling pauses while the tab's hidden. Graphs are always drawn from stored readings, so there are
no saved images. A curve averages down to at most 1,500 points, so a long firing costs the same to
draw as a short one.

## Chart

Hand-written SVG, sized to its container with a `ResizeObserver`, with no chart library. Hovering
shows the temperature, the time, and the rate of rise there, measured 10 minutes either side of the
point without crossing a gap, and shown as `--` with under 2 minutes of data around it. On its own it
has one series, so the section title names it and there's no legend. The line breaks wherever the probe had
a fault or there's a hole in the data, rather than drawing a slope across it.

### Comparing firings

A "Compare with" row of chips sits above the chart, one per other firing, in both views. Turning
one on draws it over the main curve. Up to 3 at once, since more lines get hard to tell apart.

- **Lined up by starting temperature**: logging can start partway into a firing, so start times
  alone don't line firings up. With any comparison on, the firing whose first reading was coldest
  starts at 0, and every other one starts at the moment that coldest one reached its first reading's
  temperature, worked out between readings (`alignByStartTemp` in `kilnCurve.ts`). So one whose
  logging began at 433 °F starts where the coldest one hit 433 °F. The x axis becomes time since the
  coldest one started ("Start", "2 hr", ...), and the section note says so
- **Colors**: the main firing keeps the clay line and its fill. Comparisons are lines only, in
  `--kiln-compare-1` to `-3` (blue, aqua, yellow), validated with clay against white for color
  vision deficiency. Aqua and yellow are under 3:1 contrast, so every series is also named in the
  legend and the tooltip. A firing keeps its color until it's turned off, so turning others on or
  off never repaints it
- **Legend and tooltip**: a legend appears above the chart. The crosshair follows the pointer rather
  than snapping to a reading, since firings have readings at different times, and the tooltip lists
  each firing's temperature and rate at that point, or "No data" past its end or in a hole
- The table and CSV stay the main firing's only. Compared curves are fetched once and kept for
  the visit, since finished firings don't change. Selections aren't saved in the URL

## Notes and photos

Jude can write notes on a firing and add photos of what came out. Everyone sees the public ones,
and only Jude sees the private ones. Both sections sit under the chart (and the calculator), on
whichever firing is showing, so the live view gets them while a firing's in progress. With no
firing in progress there's nowhere to put them, so they're hidden. For someone who isn't logged
in, each section only shows if it has something public in it.

**Logging in**: "Jude's login" at the very bottom of the page opens a username and password form.
It's a separate login from the admin page's, made on the backend with
`scripts/create_kiln_editor.py` (see [the API docs](../../pi/docs/api/website-backend-api.md#kiln-journal)),
and its token can only write notes and photos. Removing the login with that script's `--remove`
logs it out everywhere straight away. The token's kept in localStorage under
`kiln-editor-token` and lasts 30 days, so a phone stays logged in. If a write comes back 401, the
page logs out and shows the login again. Logging in or out reloads the notes and photos, to add or
drop the private ones.

**Notes**: the form has the text, then "When": General (about the whole firing), Right now, or
Pick a time (a date and time in the viewer's timezone), then "Who sees it": Private or Public.
New notes start private. The list puts general notes first, then pinned ones in time order. Each
pinned note shows its time, the kiln's temperature then (from the curve, if there's a reading
within a few buckets), and a number. The same number marks its time on the chart with a dashed
line and a flag. Markers only show on the clock-time axis, not while comparing firings, since
they belong to the main firing, and only inside the curve's range. Tapping or clicking a flag
(it has a finger-sized invisible target) pops that note's number, time and text up above it,
kept inside the chart's width, and turns the flag clay; the hover readout hides while it's open.
Tapping the flag again, anywhere else on the chart, or anywhere outside it closes it. Jude can edit any note
(including its time, or making it general), flip it public or private, or delete it.

**Photos**: "Choose photos" (an outlined button over a hidden file input, which on a phone offers
the camera or the photo library) picks any number of images. They show as small previews, or their
file name where the browser can't draw them (HEIC outside Safari), with "Clear" to start over. Then
pick whether they're public, and they upload one at a time, so one bad file doesn't stop the rest. HEIC and sideways phone photos get converted on the backend.
New photos start private. Tiles are square thumbnails, and clicking one opens it full size (escape
or a click closes it). Public photos load straight from their url. Private ones need the token,
which an `img` tag can't send, so they're fetched and shown from a blob url instead.

**On a phone**: Jude mostly uses this from his phone. Under 640px the form labels sit above their
chips, the main buttons stretch across the form, and the login fields go full width. On touch
screens (`pointer: coarse`) every chip, button and text action is at least 44px tall.

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
Everything on the way down also uses the cooling constant, the share of the gap to the outdoor
temperature that closes per hour. Firings aren't run the same way, since Jude can keep some gas on to hold the heat up, and that
constant is how the page tells the two apart. It reads the curve, not the time since the peak.

- **Full drop**: a constant of 0.11 per hour or more, or anything under 1,000 °F. An exponential curve
  toward the outdoor temperature, using the constant from the last hour. Replaying the first firing, this was typically
  within 6% with the actual time in the 15% range 97% of the time, where assuming the current rate
  would hold was 30-40% too soon on anything hours out
- **Held up**: at or above 1,000 °F with a constant under 0.11. There's no telling when a hold ends, so
  the page shows limits, not estimates: "at least" this long and "no lower than" this temperature if
  it's let drop now, using the typical constant from past firings. In the replay, the flip to full drop came 1.4
  hours after the peak, at about 2,090 °F
- **Heating**: a straight line at the last hour's pace, typically within 25%, with a 30% range. It
  depends on how the burner's set, and it usually slows down near the top, so the page calls it a rough
  guide. The actual time landed in the range about two-thirds of the time

**Pace changes**: an hour-long average is slow to notice Jude opening the vents, so the page also
measures the last 15 minutes. If that and the hour disagree by a factor of 1.5 while it's cooling, it
goes off the 15 minutes with a 30% range and labels it "Pace just changed". Overnight they stayed
within 1.28. When the vents opened around 9:40 AM in the first firing, cooling sped up 5-8 times, and
300 °F arrived at 10:00. By 9:45 the estimate said 10:15, and by 9:49 it said 10:00, where the hour
alone was still saying 10:05 at 9:56. Slowing down uses the same check but hasn't been seen in real
data yet. The check also spots a full drop's start sooner, about 22 minutes in that firing.

**Outdoor temperature**: the kiln's outdoors, so it cools toward `outdoor_forecast_c` from
`/kiln/status`, the average forecast for the next 12 hours. Without a forecast it assumes 70 °F and the
note says so. This barely matters above about 300 °F but a lot near the end: for 500 down to 100 °F,
assuming 30 °F or 90 °F gave 13 or 24 hours rather than 17. So every cooling range also allows for the
outdoor temperature being off by 10 °F, and targets within 10 °F of it get no estimate, since the
curve never really arrives. Wind isn't modeled. The first firing's readings didn't get low enough to
test any of this.

**Learning from past firings**: the page loads up to the 5 newest finished firings. For each, it
takes hour-long stretches after the peak, above 500 °F so the weather and opening the kiln don't skew
them, and keeps the ones fast enough to be a full drop. The median across stretches is that firing's
constant, and the median across firings replaces the built-in 0.16 for the held up limits. The more
firings disagree, the wider those limits get. Only the held up limits learn: a full drop is measured
live, and the 0.11 and 1,000 °F cutoffs are fixed, so re-check those as more firings come in.

**What it can't see**: it reacts to what Jude does, but can't know what he'll do next. Every number
assumes things carry on as they are.

A "How do these estimates work?" dropdown under the cards explains all this in plain language, so
update it along with the logic.

The logic has no React in it, so it can be replayed against any firing's curve. Once a firing has
finished, the time estimate also shows how long the same change took in the most recent finished firing.

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
