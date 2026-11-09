# Fly Kill Count

`/flies` is the house fly kill counter. The top of the page is a scoreboard with a tile for
each of Jude, Dax, Tyler and Joel: their kill count, a `+1` button and a `-` button to take one
back. The bottom is the floor, with a pile of every fly the house has killed. No login:
anyone can add a kill for anyone.

The home page links to it with the dead fly sprite on the floor of the house, right of the rug.
It's also in the "I'm feeling lucky" routes and the sitemap.

The counts live in the website backend on fart-pi. See
[the API docs](../../pi/docs/api/website-backend-api.md#fly-kills) for the endpoints.

## Files

| File | What it does |
|---|---|
| `app/flies/page.tsx` | Route and metadata |
| `app/flies/flyKillsApi.ts` | The people (`FLY_KILLERS`, which has to match `FlyKiller` in the backend's `schemas.py`), types, and fetchers for `/fly-kills` |
| `app/flies/flyPile.ts` | Lays out the pile. No React |
| `lib/useFlyKills.ts` | Loads and polls the tally, and applies clicks straight away |
| `components/flies/FlyKillCounter.tsx` | Page layout: wall, scoreboard, floor |
| `components/flies/KillerCard.tsx` | One person's tile |
| `components/flies/FlyPile.tsx` | Draws the pile and drops new flies onto it |
| `components/flies/flies.module.css` | All the styling |
| `public/images/flies/dead-fly.png` | The pile's fly, 192px wide |
| `public/images/8bit/fly.png` | The same fly at icon size, for the home page |

## Data

- The tally loads once, then polls `GET /fly-kills` every 15 s (skipped while the tab's hidden),
  so kills logged from another phone show up and drop onto the pile.
- A click changes the count and pile straight away, then sends `POST` or `DELETE`. While any
  click is still waiting on the backend, incoming tallies are ignored, so fast clicks don't
  flicker back. When the last one answers, its tally replaces the local one. If one fails,
  the click is undone and the error shows under the scoreboard.
- `-` is disabled at zero. Taking a kill back removes the top fly from the pile.
- The tile with the most kills gets a "Top swatter" tag. Ties all get it, and nobody does at zero.

## The pile

`flyPile.ts` runs a small sandpile. The floor is split into 29 columns. Fly `n` lands in a
column picked from a rough normal distribution around the middle. If that column stands more
than `MAX_STEP_HEIGHT` above a neighbor, the fly slides toward the lower side until it doesn't.
Then it sits on top of the column, which rises by `LAYER_STEP`. Every random number is seeded
from the fly's index (`lib/seededRandom.ts`), so:

- the pile looks the same on every screen and every load
- adding a fly never moves the others, and taking one back removes the newest

Heights are in fly heights and x is a percent of the pile's width, so CSS draws it at any size.
The fly is `clamp(46px, 12vw, 84px)` wide, and the pile is up to 760px wide.

The fake 3D:

- each fly gets a seeded depth. Back flies sit a bit higher, smaller and darker, and front flies
  draw over back ones at the same height
- flies get darker the deeper they are under the top of their column, so the surface looks
  lit and the middle looks shaded
- an oval shadow under the pile grows with it
- the floor planks are a tall plane tipped back toward the wall (`.planks::before`), with the
  horizon just above the baseboard, so the seams run to a vanishing point

Past `MAX_DRAWN_FLIES` (800), the most buried flies aren't drawn, to keep the DOM small.
They're in the dark middle of the pile, mostly hidden by their neighbors.

## The drop

When the total goes up, `FlyPile` animates each new fly with the Web Animations API, in a
layout effect so it never shows in its final spot first. It falls from just above the top
of the screen, faster as it goes, spinning, tumbling in 3D and drifting sideways (all
seeded). It squashes when it lands and bounces once. Several new flies at once (a poll
catching up) fall one after another. Flies already there when the page loads don't fall.
With `prefers-reduced-motion` they fade in instead.

Falling flies pass over the scoreboard, so the floor doesn't clip them. `.room` has
`overflow-x: clip` so their sideways drift can't make the page scroll.

## Adding someone

Add the name to `FlyKiller` in `pi/services/website-backend/app/schemas.py` and to
`FLY_KILLERS` and `FLY_KILLER_NAMES` in `app/flies/flyKillsApi.ts`, deploy the backend, then
push the site. The scoreboard is 2 columns on phones and 4 from 768px up, so a fifth person
would want a grid change too.

Checked in Chrome at 390px (phone) and 1280px: no horizontal scroll, the page fits one phone
screen, a 600-fly pile renders solid, and `+1` and `-` both work.
