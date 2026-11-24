# Events

`/events` lists parties, meetups and fundraisers. Every event lives in one array, `EVENTS` in `website/app/events/data.ts`.

## Routes

| Route | What renders it | Look |
|---|---|---|
| `/events` | `app/events/page.tsx` | riso zine (below) |
| `/events/<slug>` | `app/events/[slug]/page.tsx` | riso zine |
| `/events/disco` | `app/events/disco/page.tsx` | its own invite design, see `DISCO_INVITE.md` |
| `/events/techno` | `app/events/techno/page.tsx` | its own Lavender Bay design |

A static route beats `[slug]`, so an event with its own folder under `app/events/` keeps its own design. Every other event gets the zine detail page.

## Event data

`EventEntry` fields that matter for the pages:

- `past` - puts it on the "Already happened" board and stamps it "been & gone". Upcoming events sit on the big "Coming up" board in array order (pinned regulars first, then soonest), and the first one gets a "next up!" scribble.
- `coverImage` - the card photo on `/events`. Falls back to `flierImage`. Use it for events with no flier, or when the flier is a bad thumbnail. Not shown on the detail page.
- `flierImage` - taped down on the detail page; tapping it opens it full screen. Also the event's link preview image.
- `schedule`, `highlights`, `links`, `rsvpLink` / `rsvpNote`, `additionalImages` - optional blocks on the detail page, each skipped when empty.
- `rsvpForm` - renders `EventRsvpForm` (only Lavender Bay uses it, and that one has its own route).

## Zine theme

Styles are in `app/events/zine.css`, imported by both zine pages and scoped under `.zine`. It's a two-ink risograph zine on cream paper:

- Inks: pink `#ff4fa3`, blue `#2f4fa8`, text ink `#1f2f6e`, paper `#f3ede0`, tape `#efe2b8d9`. Tokens are `--zine-*` custom properties on `.zine`. It stays on paper in dark mode since it's meant to look printed.
- Fonts (loaded in `app/layout.tsx`): Bowlby One for headlines and buttons (`--font-zine-display`), Courier Prime for body text (`--font-zine-mono`), Gochi Hand for handwritten notes and card titles (`--font-zine-hand`).
- Headline: `components/events/ZineHeadline.tsx`. The pink text gets reprinted in blue a few px off by `::after`, from the text in `data-t`.
- Cards: white photo-print cards, each a little rotated, with tape on top. Photos are halftone duotones (grayscale screened onto pink or blue, alternating per card). Hovering a card brings back the real colors.
- Detail page: the flier (`components/events/ZineFlier.tsx`) taped on the left with a stamp, and the when/where box, plan, rundown, link tags and RSVP button on the right. Without a flier it's one column.

The look comes from the opium den UI concept `input/opium-den/ui-concepts/2-zine.html`.
