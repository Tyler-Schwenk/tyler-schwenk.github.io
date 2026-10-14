# Home Page

The home page (`/`) is a small pixel-art world. Every section of the site is an 8-bit
object sitting somewhere in the scene -- the frog on a lily pad in the pond, the chef hat on
the grill, the bookshelf inside the cutaway house -- and clicking one goes to that section.
A "LIST VIEW" button under the world swaps to the classic scrollable MAIN MENU list, which
shows the same objects.

There are two scenes, each composed for its screen:

- **Desktop** (Tailwind `md` and up): a wide 640x360 landscape that fits on one screen.
- **Mobile**: a tall 360x960 scene you scroll down through -- sky and cave at the top, the
  path, pond and garden mid-scroll, the house at the bottom.

## Files

| File | What it does |
|---|---|
| `app/page.tsx` | Page shell: world/list toggle, ADMIN link |
| `components/home/worldObjects.ts` | Every clickable object: label, link, sprite, size, and a placement per layout. Also the "I'm feeling lucky" route list |
| `components/home/HomeWorld.tsx` | Renders the world: backdrop, depth-scaled sprites, hover/tap behavior, per-layout depth tuning |
| `components/home/MainMenuList.tsx` | The list view, built from the same `WORLD_OBJECTS` |
| `components/home/world.generated.json` | Generated. Layout sizes, horizons, backdrop urls, sprite foot pads |
| `app/globals.css` (`.world-*` rules) | Layout switching, hover lift, yellow pixel outline, name tags, floating bob |
| `scripts/generate_home_world.py` | Paints both backdrops and writes the json |
| `public/images/home/world-desktop.png`, `world-mobile.png` | Generated backdrops |

## Backdrops

`scripts/generate_home_world.py` paints both scenes with PIL, whose shapes have no
anti-aliasing, so every edge is a hard pixel. Gradients (sky, grass, water) use ordered
Bayer dithering. The site scales the images up with `image-rendering: pixelated`. Randomness
uses a fixed seed, so reruns produce identical output.

```
python website/scripts/generate_home_world.py
```

Rerun it after editing the scenes or adding/replacing a sprite in `public/images/8bit/`
(that refreshes the foot pads).

Each scene is composed in its own `render_desktop()` / `render_mobile()` function from
shared drawing helpers (pond, garden, crate, grill, tripod, signpost, cave, house...). The
sprites are not painted in -- the backdrops only contain the set pieces they stand on.

The house is a cutaway room in one-point perspective (`HouseSpec`): the front wall is
sliced off like a dollhouse so you see the back wall, side walls, plank floor, rug and
table inside, with plum "cut" faces where the walls are sliced. Only the back slope of the
roof remains, which is where the solar panel sits.

Either backdrop can be replaced with any image of the same aspect ratio. Update the sizes in
`build_meta()` if the resolution changes, and move object placements to match.

## Objects

Each entry in `WORLD_OBJECTS` has a `desktop` and a `mobile` placement, in **backdrop
pixels** of that layout -- read coordinates straight off the png in any image editor:

- `x` -- the sprite's horizontal center.
- `y` -- where its feet touch the ground. Objects standing on a painted prop use the same
  numbers as the generator (e.g. the coffee's `y` is the table top).
- `size` (optional) -- overrides the object's `size` for that layout only.
- `scale` (optional) -- pins the depth scale instead of deriving it from `y`. Used for things
  above the horizon (the lightbulb, the cave hotspot).

Object-level fields:

- `size` -- multiplier for things that are small or large in real life (a mug vs. a
  bookshelf).
- `floating` -- bobs in the air with no ground shadow (the lightbulb).
- `href` / `external` / `lucky` -- where it goes. `lucky` picks a random `LUCKY_ROUTES` page
  on click.
- No `iconSrc` -- renders as an invisible square hotspot, outlined on hover (the cave).

Array order is the list-view order.

### Foot pads

Sprite images have transparent padding below the art, so the bottom of the image isn't
where the feet are. The generator measures each sprite's alpha bounding box and stores the
empty percent in `footPads`; the page shifts each sprite down by that much so it stands on
its spot instead of hovering.

### Fake 3D

Objects shrink toward the horizon: width is `baseSpriteWidthPct * depthScale * size`, where
`depthScale` goes linearly from `minScale` at the horizon to `maxScale` at the bottom edge.
Those three numbers are set per layout in `DEPTH_TUNING` (`HomeWorld.tsx`) -- desktop
shrinks hard with distance, mobile keeps everything big enough to tap. Objects stack by `y`
so nearer things overlap farther ones, and each grounded sprite gets a soft oval shadow at
its feet.

### How one set of elements serves both layouts

Each object gets CSS custom properties for both placements (`--m-left`, `--m-width`,
`--d-left`, `--d-width`, ...). The `.world-*` rules in `globals.css` read the `--m-*` vars
by default and the `--d-*` vars from the `md` breakpoint up. The backdrop is a `<picture>`
with a `md` media source, so the browser only downloads the scene it shows. Sprites are the
same files in both layouts and download once.

## Interaction

- Mouse: hover lifts the sprite, outlines it in yellow, and shows its name tag.
- Keyboard: every object is a real link/button, so tab focus shows the same highlight and
  Enter goes.
- Touch: there's no hover, so the first tap selects (highlight + name tag) and a second tap
  on the same object goes. Tapping empty ground clears the selection.
- Name tags near the left/right edge (`TAG_EDGE_MARGIN_PCT`) anchor to that edge so they
  don't get clipped.

## Sizing

Desktop fits the viewport (`min(96vw, 82svh * 16/9)` wide). Mobile is full width at its
natural height and the page scrolls.
