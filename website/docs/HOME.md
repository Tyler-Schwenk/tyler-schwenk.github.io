# Home Page

The home page (`/`) is a small pixel-art world. Every section of the site is an 8-bit
object sitting somewhere in the scene -- the frog on a lily pad in the pond, the bookshelf on
the deck, the plant in the garden plot -- and clicking one goes to that section. A
"LIST VIEW" button under the world swaps to the classic scrollable MAIN MENU list, which
shows the same objects.

## Files

| File | What it does |
|---|---|
| `app/page.tsx` | Page shell: world/list toggle, ADMIN link |
| `components/home/worldObjects.ts` | Every clickable object (label, link, sprite, position, size) and the "I'm feeling lucky" route list |
| `components/home/HomeWorld.tsx` | Renders the world: backdrop, depth-scaled sprites, hover/tap behavior |
| `components/home/MainMenuList.tsx` | The list view, built from the same `WORLD_OBJECTS` |
| `app/globals.css` (`.world-*` rules) | Hover lift, yellow pixel outline, name tag reveal, floating bob |
| `scripts/generate_home_world.py` | Draws the backdrop |
| `public/images/home/world.png` | The generated backdrop (320x180) |

## Backdrop

`scripts/generate_home_world.py` paints the scene at 320x180 with PIL, whose shapes have no
anti-aliasing, so every edge is a hard pixel. The site scales it up with
`image-rendering: pixelated`. Randomness (grass dither, flowers) uses a fixed seed, so reruns
produce the same image.

```
python website/scripts/generate_home_world.py
```

The sprites are not part of the backdrop. They're layered on top in the browser, so the
backdrop only contains the set pieces they stand on: pond and lily pads, crate, grill,
tripod, signpost, clearing, garden plot, deck, and the cave (which has no sprite -- it's an
invisible hotspot over the painted cave).

The backdrop can be replaced with any 16:9 image at the same path. If landmarks move, update
the object positions to match.

## Objects

Each entry in `WORLD_OBJECTS` has:

- `x`, `y` -- percent of the world box. `x` is the sprite's horizontal center, `y` is where
  its feet touch the ground. Backdrop pixel coordinates convert as `x_px / 320 * 100` and
  `y_px / 180 * 100`.
- `size` -- multiplier for things that are small or large in real life (a mug vs. a
  bookshelf).
- `footPad` -- percent of the sprite image's height that's transparent below the art. The
  sprite is pulled down by that much so it stands on its spot instead of hovering. Measure
  it from the image's alpha bounding box when adding a sprite.
- `floating` -- bobs in the air with no ground shadow (the lightbulb).
- `scale` -- pins the depth scale instead of deriving it from `y`. Used for things above the
  horizon (the lightbulb, the cave hotspot).
- `href` / `external` / `lucky` -- where it goes. `lucky` picks a random `LUCKY_ROUTES` page
  on click.
- No `iconSrc` -- renders as an invisible square hotspot, outlined on hover.

Array order is the list-view order.

### Fake 3D

Objects shrink toward the horizon: width is `BASE_SPRITE_WIDTH_PCT * depthScale * size`,
where `depthScale` goes linearly from `MIN_DEPTH_SCALE` at the horizon (`HORIZON_PCT`, which
must match the generator's `HORIZON_Y_PX`) to `MAX_DEPTH_SCALE` at the bottom edge. Objects
are drawn in `y` order with a matching z-index so nearer things overlap farther ones, and
each grounded sprite gets a soft oval shadow at its feet.

## Interaction

- Mouse: hover lifts the sprite, outlines it in yellow, and shows its name tag.
- Keyboard: every object is a real link/button, so tab focus shows the same highlight and
  Enter goes.
- Touch: there's no hover, so the first tap selects (highlight + name tag) and a second tap
  on the same object goes. Tapping empty ground clears the selection.
- Name tags near the left/right edge (`TAG_EDGE_MARGIN_PCT`) anchor to that edge so they
  don't get clipped.

## Sizing

On `md` and up the world fits the viewport (`min(96vw, 82svh * 16/9)` wide). Below that it
keeps a usable height (72svh) and scrolls sideways instead of shrinking, starting centered.
