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
| `components/home/MainMenuList.tsx` | The list view, built from `MENU_ENTRIES` (`WORLD_OBJECTS` plus `LIST_ONLY_ENTRIES`) |
| `components/home/world.generated.json` | Generated. Layout sizes, horizons, backdrop urls, roof footprints, sprite foot pads |
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
(that refreshes the foot pads). Run `shrink_8bit_icons.py` first on new sprites -- it caps
icons at 112px, except the ones the world draws big (`MAX_EDGE_OVERRIDES_PX`, e.g. the
480px roof).

Each scene is composed in its own `render_desktop()` / `render_mobile()` function from
shared drawing helpers (pond, garden, crate, grill, tripod, signpost, cave, house...). The
sprites are not painted in -- the backdrops only contain the set pieces they stand on.

The house is a cutaway room in one-point perspective (`HouseSpec`): the front wall is
sliced off like a dollhouse so you see the back wall, side walls, plank floor, rug and
table inside, with plum "cut" faces where the walls are sliced.

The roof isn't painted -- it's the solar sprite (`solar.png`, panels on a roof). The
generator works out where it goes (`HouseSpec.roof_footprint()`: centered on the back wall,
eaves overhanging it, resting on the wall's cut top) and writes that into the json as each
layout's `roof`. The solar object uses those numbers directly as its placement, so the roof
always fits the house. It rises well above the back wall, so keep other props clear of it.

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
- `widthPx` (optional) -- exact width in backdrop px, skipping depth scaling and `size`. Used
  for sprites that must fit a painted shape (the roof).

Object-level fields:

- `size` -- multiplier for things that are small or large in real life (a mug vs. a
  bookshelf).
- `floating` -- bobs in the air with no ground shadow (the lightbulb).
- `noShadow` -- skips the ground shadow for things not standing on the ground (the roof).
- `firingIconSrc` / `liveIconSrc` -- a second sprite to show while the kiln's firing (the
  kiln) or while the DJ stream's on air (the radio tower). `currentIconSrc` picks the sprite
  for both the world and the list view. A pair of sprites should share one canvas size with
  the feet in the same spot, so the swap doesn't jump.
- `djNotes` -- while the DJ stream's on air, pixel music notes float up off the sprite. Used
  by the DJ board inside the opium den cave.
- `liveTag` -- while the DJ stream's on air, a blinking red LIVE! tag sits above the sprite
  (hidden while the object's lit up, so its name tag shows instead). Used by the radio tower
  on the hill next to the cave, which goes to the live section (`/opium-den/live`), where the live room and every past set are.
- The live state comes from `useDjLive`, which checks `/dj/status` on load and every 30 s
  while the tab's visible. The animations are the `.world-note` / `.world-live-tag` rules
  in `globals.css`, held still under reduced motion. See `website/docs/OPIUM_DEN.md`.
- `href` / `external` / `lucky` -- where it goes. `lucky` picks a random `LUCKY_ROUTES` page
  on click.
- No `iconSrc` -- renders as an invisible square hotspot, outlined on hover (the cave).

Array order is the list-view order.

### List-only pages

`LIST_ONLY_ENTRIES` holds pages that show up in the list view but not in the world, for a
page that doesn't have a sprite yet. Entries only need `id`, `label` and `href`. The list
view shows `MENU_ENTRIES`: every world object, then the list-only pages. Once a page has a
sprite, move it into `WORLD_OBJECTS` with a size and placements.

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
