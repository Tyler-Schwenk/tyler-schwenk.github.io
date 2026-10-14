"""
draws the pixel-art backdrops for the home page world, plus the metadata the
page needs to line sprites up with them.

two scenes get painted, each composed for its screen:
  - desktop: a wide landscape (public/images/home/world-desktop.png)
  - mobile: a tall scene you scroll down through (public/images/home/world-mobile.png)

shapes are drawn with PIL, which doesn't anti-alias, so every edge is a hard
pixel. gradients use ordered (bayer) dithering for the classic retro look. the
site scales the images up with `image-rendering: pixelated`.

it also writes components/home/world.generated.json with:
  - each layout's native size and horizon row, which the page uses to turn
    sprite positions (backdrop pixels) into percents and depth scales
  - each 8-bit sprite's footPad -- the percent of its height that's empty
    below the art -- so sprites can stand on the ground instead of hovering

the clickable sprites aren't painted in -- components/home/worldObjects.ts
places them in backdrop pixel coords, so if you move a landmark here (pond,
house, crate...) move the matching objects there too. read coords straight off
the png in any image editor.

randomness (grass texture, flowers) uses a fixed seed so reruns are byte-identical.

usage (from anywhere): python website/scripts/generate_home_world.py
"""

import json
import math
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw

WEBSITE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = WEBSITE_DIR / "public" / "images" / "home"
SPRITE_DIR = WEBSITE_DIR / "public" / "images" / "8bit"
SPRITE_URL_PREFIX = "/images/8bit/"
META_PATH = WEBSITE_DIR / "components" / "home" / "world.generated.json"

RANDOM_SEED = 8

# sprite pixels at or under this alpha count as empty when measuring footPad --
# the generator art has faint fringes that shouldn't count as feet
SPRITE_ALPHA_THRESHOLD = 40

BAYER_4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
BAYER_LEVELS = 16

# palette -----------------------------------------------------------------------
SKY = ["#203c98", "#2848b0", "#3460c4", "#4878d4", "#6494e0", "#88b4ec", "#b0d4f4"]
SUN = "#f8e060"
SUN_CORE = "#fff4b0"
SUN_RIM = "#f8a830"
SUN_GLOW = "#c8dcf0"
CLOUD = "#ffffff"
CLOUD_SHADE = "#c8d8f0"
CLOUD_DEEP = "#a0b8e0"
MOUNTAIN = "#6070a8"
MOUNTAIN_SHADE = "#4c5890"
MOUNTAIN_LIGHT = "#8494c4"
SNOW = "#f0f6fc"
SNOW_SHADE = "#c0d0e8"
HILL_FAR = "#2e7a44"
HILL_FAR_LIGHT = "#3c8c50"
HILL_NEAR = "#38904c"
HILL_NEAR_LIGHT = "#4ca460"
PINE = "#1c5030"
PINE_SHADE = "#123c22"
PINE_LIGHT = "#2e7040"
TRUNK = "#5a3a20"

GRASS = ["#4a9a48", "#52a64e", "#5ab052", "#60b856", "#66c05a"]
GRASS_DARK = "#3e8a3c"
GRASS_DEEP = "#327434"
GRASS_LIGHT = "#80d070"
FLOWER_COLORS = ["#f8f8f8", "#f8d030", "#e85080", "#a070e0"]

PATH = "#c8a060"
PATH_LIGHT = "#dab878"
PATH_DARK = "#a88048"
PATH_EDGE = "#8a6438"
PEBBLE = "#e8d0a0"

WATER = ["#5898e8", "#4080d8", "#3068c0", "#2858a8"]
WATER_GLINT = "#d0ecfc"
WATER_RIPPLE = "#78b0f0"
SHORE_MUD = "#6a5238"
SHORE_SAND = "#d8c080"
SHORE_SAND_DARK = "#b8a060"
LILY = "#3a9c40"
LILY_LIGHT = "#5cbc58"
LILY_FLOWER = "#f8a0c0"
REED = "#2a6a2c"
REED_LIGHT = "#409040"
CATTAIL = "#7a4a24"

DIRT = "#7a4e2c"
DIRT_LIGHT = "#946038"
FURROW = "#5a361c"
SPROUT = "#68c050"
CLEARING = "#a88c5c"
CLEARING_EDGE = "#8a7048"

WOOD = "#a8743c"
WOOD_DARK = "#7a5028"
WOOD_DEEP = "#5a3a1c"
WOOD_LIGHT = "#c89058"
STONE = "#9aa2aa"
STONE_LIGHT = "#c0c8d0"
STONE_DARK = "#606870"
METAL = "#303438"
METAL_LIGHT = "#5a626c"
OUTLINE = "#20242c"

CAVE = "#180808"
CAVE_DEEP = "#0c0404"
CAVE_GLOW = "#a02020"
CAVE_GLOW_BRIGHT = "#ff6040"

# house -- warm walls inside, plum "cut" faces where the walls are sliced away
# (same trick as isometric dollhouse/sims rooms)
WALL_BACK = "#f4e4d4"
WALL_BACK_STRIPE = "#ecd8c6"
WALL_LEFT = "#e8d2bc"
WALL_RIGHT = "#d8bea6"
BASEBOARD = "#b08a64"
CUT = "#6a4a7c"
CUT_DARK = "#4a3058"
FLOOR = "#c08a54"
FLOOR_DARK = "#a47040"
FLOOR_LIGHT = "#d4a068"
RUG = "#c84848"
RUG_BORDER = "#f0d090"
RUG_DARK = "#983434"
ROOF = "#8a3c34"
ROOF_DARK = "#6a2a24"
ROOF_LIGHT = "#a85048"
WINDOW_FRAME = "#f8f4ec"
WINDOW_GLASS = "#88c0ec"
WINDOW_GLASS_LIGHT = "#c0e0f8"
BLIND = "#e8dcc8"
FRAME_ART = "#5888c0"


# helpers -----------------------------------------------------------------------

def rgb(color: str) -> tuple[int, int, int]:
    """turns '#rrggbb' into an (r, g, b) tuple."""
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def ellipse(draw: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, fill: str) -> None:
    """fills an axis-aligned ellipse from its center and radii."""
    draw.ellipse((round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)), fill=fill)


def lerp(a: float, b: float, t: float) -> float:
    """linear blend from a to b."""
    return a + (b - a) * t


def dithered_color(colors: list[str], t: float, x: int, y: int) -> tuple[int, int, int]:
    """
    picks a gradient color for one pixel, bayer-dithering between neighbor stops.

    Args:
        colors: gradient stops, start to end.
        t: 0..1 position along the gradient.
        x, y: the pixel, which picks the dither threshold.

    Returns:
        the rgb to paint.
    """
    pos = max(0.0, min(1.0, t)) * (len(colors) - 1)
    low = min(int(pos), len(colors) - 2)
    threshold = (BAYER_4[y % 4][x % 4] + 0.5) / BAYER_LEVELS
    return rgb(colors[low + 1] if pos - low > threshold else colors[low])


def fill_vertical_gradient(img: Image.Image, box: tuple[int, int, int, int], colors: list[str],
                           mask: Image.Image | None = None) -> None:
    """
    fills a box with a dithered top-to-bottom gradient.

    Args:
        img: image to paint on.
        box: (x0, y0, x1, y1), end-exclusive.
        colors: gradient stops, top to bottom.
        mask: optional 'L' image the size of img -- only nonzero pixels get painted.
    """
    x0, y0, x1, y1 = box
    px = img.load()
    mask_px = mask.load() if mask else None
    for y in range(max(0, y0), min(img.height, y1)):
        t = (y - y0) / max(1, y1 - y0 - 1)
        for x in range(max(0, x0), min(img.width, x1)):
            if mask_px is None or mask_px[x, y]:
                px[x, y] = dithered_color(colors, t, x, y)


def checker_fill(img: Image.Image, mask: Image.Image, color: str) -> None:
    """paints every other pixel inside mask -- a 50% dither for soft glows and edges."""
    px, mask_px, c = img.load(), mask.load(), rgb(color)
    for y in range(img.height):
        for x in range(img.width):
            if mask_px[x, y] and (x + y) % 2 == 0:
                px[x, y] = c


def new_mask(img: Image.Image) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """a blank mask the size of img, plus a draw handle for it."""
    mask = Image.new("L", img.size, 0)
    return mask, ImageDraw.Draw(mask)


# scenery -----------------------------------------------------------------------

def draw_sky(img: Image.Image, draw: ImageDraw.ImageDraw, horizon: int, sun: tuple[int, int, int]) -> None:
    """
    dithered sky gradient and a sun with a soft glow.

    Args:
        horizon: row the sky ends on.
        sun: (cx, cy, radius).
    """
    fill_vertical_gradient(img, (0, 0, img.width, horizon), SKY)
    cx, cy, r = sun
    mask, mdraw = new_mask(img)
    glow = r * 3 // 2
    mdraw.ellipse((cx - glow, cy - glow, cx + glow, cy + glow), fill=255)
    checker_fill(img, mask, SUN_GLOW)
    ellipse(draw, cx, cy, r + 2, r + 2, SUN_RIM)
    ellipse(draw, cx, cy, r, r, SUN)
    ellipse(draw, cx - r * 0.3, cy - r * 0.3, r * 0.45, r * 0.45, SUN_CORE)


def draw_cloud(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float) -> None:
    """a puffy cloud: deep shadow, shade, then lit puffs on top."""
    puffs = [(-22, 4, 14, 9), (-8, -4, 16, 13), (10, -1, 15, 11), (24, 5, 12, 8)]
    layers = [(CLOUD_DEEP, 4, 0), (CLOUD_SHADE, 2, 0), (CLOUD, 0, 2)]
    for color, dy, shrink in layers:
        for px_, py_, rx, ry in puffs:
            ellipse(draw, cx + px_ * scale, cy + (py_ + dy) * scale,
                    (rx - shrink) * scale, (ry - shrink) * scale, color)


def draw_mountains(draw: ImageDraw.ImageDraw, ridge: list[tuple[int, int]], base_y: int, snow_above: int) -> None:
    """
    a mountain range with lit and shaded faces and snowcaps.

    Args:
        ridge: alternating valley/peak points, left to right, starting and ending on a
            valley -- so peaks are the odd indexes.
        base_y: row the range sits on.
        snow_above: peaks higher than this row get snow.
    """
    width = ridge[-1][0]
    draw.polygon([(0, base_y)] + ridge + [(width, base_y)], fill=MOUNTAIN)
    for i in range(1, len(ridge) - 1, 2):
        (lx, ly), (px, py), (rx, ry) = ridge[i - 1], ridge[i], ridge[i + 1]
        # sun's on the left, so right faces fall into shadow and left ridges catch light
        draw.polygon([(px, py), (rx, ry), (px + (rx - px) // 4, base_y)], fill=MOUNTAIN_SHADE)
        draw.polygon([(px, py), (px - (px - lx) // 3, py + (ly - py) // 3), (px - 3, base_y)], fill=MOUNTAIN_LIGHT)
        if py < snow_above:
            cap = (snow_above - py) // 2 + 4
            draw.polygon([(px, py), (px - cap, py + cap), (px - cap // 3, py + cap - 3),
                          (px, py + cap), (px + cap // 2, py + cap - 2), (px + cap, py + cap)], fill=SNOW)
            draw.polygon([(px, py), (px + cap // 2, py + cap - 2), (px + cap, py + cap)], fill=SNOW_SHADE)


def draw_hill(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, color: str, light: str) -> None:
    """a rounded hill with a lit rim along its top."""
    ellipse(draw, cx, cy, rx, ry, light)
    ellipse(draw, cx + 2, cy + 3, rx - 1, ry - 1, color)


def draw_pine(draw: ImageDraw.ImageDraw, x: int, base: int, h: int) -> None:
    """a three-tier pine, lit on the left."""
    draw.rectangle((x - 1, base - 3, x + 1, base), fill=TRUNK)
    for tier in range(3):
        top = base - h + tier * h // 4
        bottom = base - 2 - (2 - tier) * h // 6
        half = (bottom - top) * 2 // 3 + 2
        draw.polygon([(x, top), (x - half, bottom), (x + half, bottom)], fill=PINE)
        draw.polygon([(x, top), (x + half, bottom), (x + 1, bottom)], fill=PINE_SHADE)
        draw.line([(x, top), (x - half + 1, bottom - 1)], fill=PINE_LIGHT)


def draw_treeline(draw: ImageDraw.ImageDraw, rng: random.Random, horizon: int,
                  spans: list[tuple[int, int]], height: tuple[int, int]) -> None:
    """pines packed along the horizon in each (x0, x1) span."""
    for x0, x1 in spans:
        x = x0
        while x < x1:
            draw_pine(draw, x, horizon + rng.randint(0, 3), rng.randint(*height))
            x += rng.randint(9, 14)


def draw_ground(img: Image.Image, draw: ImageDraw.ImageDraw, rng: random.Random, horizon: int) -> None:
    """dithered grass gradient with texture, tufts, and flowers that grow toward the viewer."""
    fill_vertical_gradient(img, (0, horizon, img.width, img.height), GRASS)
    area = img.width * (img.height - horizon)
    for _ in range(area // 30):
        x, y = rng.randrange(img.width), rng.randrange(horizon + 2, img.height)
        draw.point((x, y), fill=rng.choice([GRASS_DARK, GRASS_DARK, GRASS_DEEP]))
    for _ in range(area // 400):
        x, y = rng.randrange(img.width), rng.randrange(horizon + 10, img.height)
        tuft = 2 + round(3 * (y - horizon) / (img.height - horizon))
        draw.line([(x, y), (x - 1, y - tuft)], fill=GRASS_DEEP)
        draw.line([(x + 1, y), (x + 2, y - tuft)], fill=GRASS_LIGHT)
        draw.line([(x + 2, y), (x + 4, y - tuft + 1)], fill=GRASS_DARK)
    for _ in range(area // 900):
        x, y = rng.randrange(2, img.width - 2), rng.randrange(horizon + 16, img.height)
        color = rng.choice(FLOWER_COLORS)
        draw.point([(x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)], fill=color)
        draw.point((x, y), fill=SUN)


def draw_path(img: Image.Image, draw: ImageDraw.ImageDraw, rng: random.Random,
              span: Callable[[int], tuple[int, int]], y0: int, y1: int) -> None:
    """
    a winding dirt path, painted row by row so its edges stay pixel-crisp.

    Args:
        span: row -> (left x, right x) of the path.
        y0, y1: first and last rows to paint.
    """
    for y in range(y0, y1):
        left, right = span(y)
        draw.line([(left - 1, y), (right + 1, y)], fill=GRASS_DEEP)
        for x in range(left, right + 1):
            t = (x - left) / max(1, right - left)
            # darker toward the right edge for a bit of shape
            img.putpixel((x, y), dithered_color([PATH_LIGHT, PATH, PATH, PATH_DARK], t, x, y))
        draw.point([(left, y), (right, y)], fill=PATH_EDGE)
    for _ in range((y1 - y0) // 2):
        y = rng.randrange(y0 + 10, y1)
        left, right = span(y)
        if right - left > 8:
            x = rng.randrange(left + 3, right - 3)
            draw.point((x, y), fill=PEBBLE)
            draw.point((x + 1, y + 1), fill=PATH_EDGE)


def draw_pond(img: Image.Image, draw: ImageDraw.ImageDraw, center: tuple[int, int], radii: tuple[int, int],
              lily_pads: list[tuple[int, int]], reed_spots: list[tuple[int, int]]) -> None:
    """
    a pond: sandy shore, dithered deep-to-shallow water, ripples, lily pads, cattails.

    Args:
        center, radii: the water ellipse.
        lily_pads: pad centers (sprites can sit on these).
        reed_spots: bases of cattail clumps along the shore.
    """
    (cx, cy), (rx, ry) = center, radii
    ellipse(draw, cx, cy + 3, rx + 10, ry + 7, SHORE_SAND_DARK)
    ellipse(draw, cx, cy + 1, rx + 9, ry + 6, SHORE_SAND)
    ellipse(draw, cx, cy, rx + 3, ry + 3, SHORE_MUD)
    mask, mdraw = new_mask(img)
    mdraw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    fill_vertical_gradient(img, (cx - rx, cy - ry, cx + rx + 1, cy + ry + 1), WATER, mask)
    for i, (dx, dy, length) in enumerate([(-0.6, -0.4, 14), (0.1, -0.2, 9), (-0.3, 0.3, 12), (0.4, 0.15, 7)]):
        gx, gy = cx + dx * rx, cy + dy * ry
        draw.line([(gx, gy), (gx + length, gy)], fill=WATER_GLINT if i % 2 == 0 else WATER_RIPPLE)
    for lx, ly in lily_pads:
        ellipse(draw, lx, ly + 1, 11, 4, WATER[3])
        ellipse(draw, lx, ly, 11, 4, LILY)
        ellipse(draw, lx - 2, ly - 1, 6, 2, LILY_LIGHT)
        draw.polygon([(lx, ly), (lx + 11, ly - 2), (lx + 11, ly + 1)], fill=WATER[1])
    for i, (sx, sy) in enumerate([(cx - rx - 2, cy + 4), (cx + rx + 2, cy + 6), (cx - rx // 3, cy + ry + 4)]):
        ellipse(draw, sx, sy, 5, 3, STONE_DARK)
        ellipse(draw, sx - 1, sy - 1, 4, 2, STONE if i % 2 else STONE_LIGHT)
    for bx, by in reed_spots:
        for dx, h in [(-3, 16), (0, 22), (3, 18), (6, 13)]:
            draw.line([(bx + dx, by), (bx + dx, by - h)], fill=REED)
            draw.point((bx + dx - 1, by - h // 2), fill=REED_LIGHT)
            draw.rectangle((bx + dx, by - h, bx + dx + 1, by - h + 4), fill=CATTAIL)


def draw_clearing(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int) -> None:
    """a bare dirt patch, with a darker rim."""
    ellipse(draw, cx, cy + 1, rx + 2, ry + 1, CLEARING_EDGE)
    ellipse(draw, cx, cy, rx, ry, CLEARING)
    ellipse(draw, cx - rx // 3, cy - ry // 3, rx // 3, max(1, ry // 3), PATH_LIGHT)


def draw_garden(draw: ImageDraw.ImageDraw, corners: list[tuple[int, int]]) -> None:
    """
    a tilled plot with furrows, little sprouts, and a picket fence along the back.

    Args:
        corners: back-left, back-right, front-right, front-left -- a trapezoid so it lies flat.
    """
    bl, br, fr, fl = corners
    draw.polygon([(fl[0], fl[1] + 3), (fr[0], fr[1] + 3), fr, fl], fill=FURROW)
    draw.polygon(corners, fill=DIRT)
    rows = (fl[1] - bl[1]) // 5
    for i in range(1, rows + 1):
        t = i / (rows + 1)
        left = (lerp(bl[0], fl[0], t), lerp(bl[1], fl[1], t))
        right = (lerp(br[0], fr[0], t), lerp(br[1], fr[1], t))
        draw.line([left, right], fill=FURROW)
        draw.line([(left[0], left[1] - 1), (right[0], right[1] - 1)], fill=DIRT_LIGHT)
        for s in range(1, 8):
            sx = lerp(left[0], right[0], s / 8)
            draw.point([(sx, left[1] - 2), (sx - 1, left[1] - 3), (sx + 1, left[1] - 3)], fill=SPROUT)
    for x in range(bl[0], br[0] + 1, 8):
        draw.rectangle((x, bl[1] - 9, x + 2, bl[1]), fill=WOOD_LIGHT)
        draw.point((x + 1, bl[1] - 10), fill=WOOD_LIGHT)
        draw.line([(x + 2, bl[1] - 9), (x + 2, bl[1])], fill=WOOD_DARK)
    draw.line([(bl[0], bl[1] - 6), (br[0] + 2, bl[1] - 6)], fill=WOOD, width=2)


def draw_crate(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    """a wooden crate with its top face showing. (x, y) is the front face's top-left."""
    lip = h // 4
    draw.polygon([(x, y), (x + lip, y - lip), (x + w + lip, y - lip), (x + w, y)], fill=WOOD_LIGHT)
    draw.polygon([(x + w, y), (x + w + lip, y - lip), (x + w + lip, y + h - lip), (x + w, y + h)], fill=WOOD_DARK)
    draw.rectangle((x, y, x + w, y + h), fill=WOOD)
    for py in range(y + h // 3, y + h, h // 3):
        draw.line([(x, py), (x + w, py)], fill=WOOD_DARK)
    draw.line([(x, y), (x + w, y + h)], fill=WOOD_DARK, width=2)
    draw.rectangle((x, y, x + w, y + h), outline=WOOD_DEEP)


def draw_grill(draw: ImageDraw.ImageDraw, cx: int, top: int, r: int) -> None:
    """a kettle grill. `top` is the rim row a chef hat can sit on."""
    ellipse(draw, cx, top + r + 14, r + 6, 4, GRASS_DEEP)
    for dx in (-r * 2 // 3, 0, r * 2 // 3):
        draw.line([(cx, top + r // 2), (cx + dx, top + r + 14)], fill=METAL, width=2)
    draw.pieslice((cx - r, top - r, cx + r, top + r), 0, 180, fill=METAL)
    draw.arc((cx - r + 3, top - r + 3, cx + r - 3, top + r - 3), 20, 70, fill=METAL_LIGHT, width=2)
    draw.rectangle((cx - r - 1, top - 1, cx + r + 1, top + 1), fill=METAL_LIGHT)
    draw.point([(cx - r // 2, top - 2), (cx, top - 3), (cx + r // 2, top - 2)], fill="#e86030")


def draw_tripod(draw: ImageDraw.ImageDraw, x: int, top: int, h: int) -> None:
    """three metal legs meeting at `top` -- the camera sprite stands on it."""
    for dx in (-h // 2, 0, h // 2):
        draw.line([(x, top), (x + dx, top + h)], fill=METAL, width=2)
    draw.rectangle((x - 3, top - 1, x + 3, top + 1), fill=METAL_LIGHT)


def draw_signpost(draw: ImageDraw.ImageDraw, x: int, base: int, h: int) -> None:
    """a wooden post with an arrow sign pointing down the road."""
    draw.rectangle((x, base - h, x + 2, base), fill=WOOD_DARK)
    top = base - h
    arrow = [(x - 12, top), (x + 12, top), (x + 17, top + 5), (x + 12, top + 10), (x - 12, top + 10)]
    draw.polygon(arrow, fill=WOOD_LIGHT, outline=WOOD_DEEP)
    draw.line([(x - 8, top + 4), (x + 8, top + 4)], fill=WOOD_DARK)
    draw.line([(x - 8, top + 7), (x + 4, top + 7)], fill=WOOD_DARK)


def draw_rock(draw: ImageDraw.ImageDraw, x: int, y: int, r: int) -> None:
    """a little shaded boulder."""
    ellipse(draw, x + 1, y + 1, r + 1, r * 0.6 + 1, GRASS_DEEP)
    ellipse(draw, x, y, r, r * 0.6, STONE_DARK)
    ellipse(draw, x - 1, y - 1, r - 1, r * 0.6 - 1, STONE)
    ellipse(draw, x - r // 3, y - r // 3, r // 3, r // 5 + 1, STONE_LIGHT)


def draw_cave(img: Image.Image, draw: ImageDraw.ImageDraw, cx: int, bottom: int, w: int, h: int) -> None:
    """
    the opium den: a dark arched cave mouth with a red glow and a stone arch.

    Args:
        cx, bottom: bottom center of the opening.
        w, h: opening size.
    """
    mask, mdraw = new_mask(img)
    mdraw.ellipse((cx - w * 0.75, bottom - h * 1.25, cx + w * 0.75, bottom + 2), fill=255)
    checker_fill(img, mask, CAVE_GLOW)
    half = w // 2
    arch = (cx - half - 4, bottom - h - 4, cx + half + 4, bottom - h + w + 4)
    draw.pieslice(arch, 180, 360, fill=STONE_DARK)
    draw.rectangle((cx - half - 4, bottom - h + half, cx + half + 4, bottom), fill=STONE_DARK)
    draw.pieslice((cx - half, bottom - h, cx + half, bottom - h + w), 180, 360, fill=CAVE_GLOW)
    draw.rectangle((cx - half, bottom - h + half, cx + half, bottom), fill=CAVE_GLOW)
    draw.pieslice((cx - half + 2, bottom - h + 2, cx + half - 2, bottom - h + w - 2), 180, 360, fill=CAVE)
    draw.rectangle((cx - half + 2, bottom - h + half, cx + half - 2, bottom), fill=CAVE)
    ellipse(draw, cx, bottom - 3, half - 6, 4, CAVE_DEEP)
    for i in range(7):
        angle = math.pi * (i / 6)
        sx = cx - math.cos(angle) * (half + 2)
        sy = bottom - h + half - math.sin(angle) * (half + 2)
        ellipse(draw, sx, sy, 3, 2, STONE if i % 2 else STONE_LIGHT)
    rng = random.Random(RANDOM_SEED + 1)
    for _ in range(10):
        draw.point((cx + rng.randint(-half + 4, half - 4), bottom - rng.randint(3, h - 6)), fill=CAVE_GLOW_BRIGHT)


@dataclass
class HouseSpec:
    """
    a cutaway room seen from the front, drawn in one-point perspective.

    the front wall is sliced off so you look straight in, like a dollhouse.
    the back of the room is the front opening shrunk toward the vanishing
    point by `depth`.

    Attributes:
        left, right: x of the front edges of the side walls.
        wall_top: row the front edges of the side walls are cut at.
        floor: row of the front edge of the floor.
        vanish: (x, y) vanishing point.
        depth: back wall size as a fraction of the front opening (0..1).
        roof_rise: how far the roof climbs above the back wall, px.
        window: (x0, x1) of the back-wall window, or None.
        table: (cx, floor y, half width, leg height) of the table, or None.
    """

    left: int
    right: int
    wall_top: int
    floor: int
    vanish: tuple[int, int]
    depth: float
    roof_rise: int
    window: tuple[int, int] | None
    table: tuple[int, int, int, int] | None

    def back(self, x: float, y: float) -> tuple[int, int]:
        """projects a front-plane point onto the back wall plane."""
        vx, vy = self.vanish
        return round(vx + (x - vx) * self.depth), round(vy + (y - vy) * self.depth)


def draw_house(draw: ImageDraw.ImageDraw, house: HouseSpec) -> None:
    """
    the cutaway house: roof, back wall with window, side walls, plank floor,
    rug, table, and the plum cut faces where the walls are sliced.
    """
    fl, fr, ft, ff = house.left, house.right, house.wall_top, house.floor
    bl_top, br_top = house.back(fl, ft), house.back(fr, ft)
    bl_floor, br_floor = house.back(fl, ff), house.back(fr, ff)
    cut = max(3, (fr - fl) // 50)

    ellipse(draw, (fl + fr) / 2, ff + 6, (fr - fl) / 2 + 12, 10, GRASS_DEEP)
    draw_roof(draw, bl_top, br_top, house.roof_rise, cut)

    # back wall with pinstripes and a baseboard
    draw.rectangle((bl_top[0], bl_top[1], br_top[0], bl_floor[1]), fill=WALL_BACK)
    for x in range(bl_top[0] + 4, br_top[0], 8):
        draw.line([(x, bl_top[1]), (x, bl_floor[1])], fill=WALL_BACK_STRIPE)
    draw.rectangle((bl_floor[0], bl_floor[1] - 4, br_floor[0], bl_floor[1]), fill=BASEBOARD)
    if house.window:
        draw_window(draw, house.window, bl_top[1], bl_floor[1])

    draw.polygon([(fl, ft), bl_top, bl_floor, (fl, ff)], fill=WALL_LEFT)
    draw.polygon([(fr, ft), br_top, br_floor, (fr, ff)], fill=WALL_RIGHT)
    draw.line([bl_floor, (fl, ff)], fill=BASEBOARD, width=3)
    draw.line([br_floor, (fr, ff)], fill=BASEBOARD, width=3)

    draw_floor(draw, house, bl_floor, br_floor)
    if house.table:
        draw_table(draw, *house.table)

    # cut faces: tops of the walls and the sliced front edges, plus the floor slab
    draw.line([(fl, ft), bl_top, br_top, (fr, ft)], fill=CUT, width=cut)
    draw.rectangle((fl - cut, ft, fl, ff), fill=CUT)
    draw.rectangle((fr, ft, fr + cut, ff), fill=CUT_DARK)
    draw.rectangle((fl - cut, ff, fr + cut, ff + cut * 2), fill=CUT)
    draw.rectangle((fl - cut, ff + cut * 2, fr + cut, ff + cut * 2 + 2), fill=CUT_DARK)


def draw_roof(draw: ImageDraw.ImageDraw, bl_top: tuple[int, int], br_top: tuple[int, int], rise: int, cut: int) -> None:
    """
    a shingled roof slope climbing back from the top of the back wall. the
    front half of the roof is cut away with the front wall, so this is all
    that's left -- the solar panel sits on it.
    """
    inset = rise // 3
    top_left, top_right = (bl_top[0] + inset, bl_top[1] - rise), (br_top[0] - inset, br_top[1] - rise)
    eave_left, eave_right = (bl_top[0] - cut * 2, bl_top[1]), (br_top[0] + cut * 2, br_top[1])
    draw.polygon([eave_left, eave_right, top_right, top_left], fill=ROOF)
    for i in range(1, rise // 5):
        t = i * 5 / rise
        y = round(lerp(eave_left[1], top_left[1], t))
        x0, x1 = lerp(eave_left[0], top_left[0], t), lerp(eave_right[0], top_right[0], t)
        draw.line([(x0, y), (x1, y)], fill=ROOF_DARK)
        offset = 5 if i % 2 else 0
        for sx in range(round(x0) + offset, round(x1), 10):
            draw.line([(sx, y), (sx, y + 4)], fill=ROOF_DARK)
    draw.line([top_left, top_right], fill=ROOF_LIGHT, width=2)
    draw.line([eave_left, eave_right], fill=ROOF_DARK, width=2)


def draw_window(draw: ImageDraw.ImageDraw, span: tuple[int, int], wall_top: int, wall_bottom: int) -> None:
    """a back-wall window with sky, half-drawn blinds, and a sill."""
    x0, x1 = span
    wall_h = wall_bottom - wall_top
    y0, y1 = wall_top + wall_h // 5, wall_top + wall_h * 3 // 5
    draw.rectangle((x0 - 3, y0 - 3, x1 + 3, y1 + 3), fill=WINDOW_FRAME)
    draw.rectangle((x0, y0, x1, y1), fill=WINDOW_GLASS)
    draw.polygon([(x0, y1), (x0, y1 - 8), (x0 + 8, y0), (x0 + 16, y0), (x0 + 2, y1)], fill=WINDOW_GLASS_LIGHT)
    for y in range(y0, y0 + (y1 - y0) // 2, 3):
        draw.line([(x0, y), (x1, y)], fill=BLIND)
    draw.line([((x0 + x1) // 2, y0), ((x0 + x1) // 2, y1)], fill=WINDOW_FRAME, width=2)
    draw.rectangle((x0 - 6, y1 + 3, x1 + 6, y1 + 6), fill=BASEBOARD)


def draw_floor(draw: ImageDraw.ImageDraw, house: HouseSpec, bl_floor: tuple[int, int], br_floor: tuple[int, int]) -> None:
    """wood plank floor whose seams run toward the vanishing point, plus a rug."""
    fl, fr, ff = house.left, house.right, house.floor
    draw.polygon([(fl, ff), (fr, ff), br_floor, bl_floor], fill=FLOOR)
    plank_w = max(8, (fr - fl) // 18)
    for i, x in enumerate(range(fl + plank_w, fr, plank_w)):
        draw.line([(x, ff), house.back(x, ff)], fill=FLOOR_DARK)
        if i % 3 == 0:
            draw.line([(x + 2, ff - 1), house.back(x + 2, ff - 1)], fill=FLOOR_LIGHT)
    depth = ff - bl_floor[1]
    for row, t in enumerate([0.25, 0.55, 0.85]):
        y = round(lerp(bl_floor[1], ff, t))
        x_left, x_right = lerp(bl_floor[0], fl, t), lerp(br_floor[0], fr, t)
        start = x_left + (row * plank_w) % (plank_w * 3)
        for x in range(round(start), round(x_right), plank_w * 3):
            draw.line([(x, y), (x + plank_w, y)], fill=FLOOR_DARK)

    # rug, laid flat in the middle of the floor
    rug_near, rug_far = ff - depth // 6, bl_floor[1] + depth // 4
    near_half, far_half = (fr - fl) * 0.3, (br_floor[0] - bl_floor[0]) * 0.32
    cx = (fl + fr) / 2
    far_cx = (bl_floor[0] + br_floor[0]) / 2
    rug = [(far_cx - far_half, rug_far), (far_cx + far_half, rug_far), (cx + near_half, rug_near), (cx - near_half, rug_near)]
    draw.polygon(rug, fill=RUG_BORDER)
    inner = [(far_cx - far_half + 5, rug_far + 2), (far_cx + far_half - 5, rug_far + 2),
             (cx + near_half - 7, rug_near - 3), (cx - near_half + 7, rug_near - 3)]
    draw.polygon(inner, fill=RUG)
    mid_y = (rug_far + rug_near) / 2
    draw.line([((inner[0][0] + inner[3][0]) / 2 + 6, mid_y), ((inner[1][0] + inner[2][0]) / 2 - 6, mid_y)], fill=RUG_DARK, width=2)


def draw_table(draw: ImageDraw.ImageDraw, cx: int, floor_y: int, half_w: int, leg_h: int) -> None:
    """
    a small wooden side table. its top surface is at floor_y - leg_h, which
    is where the coffee sprite sits.
    """
    top = floor_y - leg_h
    ellipse(draw, cx, floor_y, half_w + 2, 3, FLOOR_DARK)
    for dx in (-half_w + 3, half_w - 4):
        draw.rectangle((cx + dx, top, cx + dx + 2, floor_y), fill=WOOD_DARK)
    draw.polygon([(cx - half_w + 4, top - 6), (cx + half_w - 4, top - 6), (cx + half_w, top), (cx - half_w, top)], fill=WOOD_LIGHT)
    draw.rectangle((cx - half_w, top, cx + half_w, top + 3), fill=WOOD)
    draw.line([(cx - half_w, top + 3), (cx + half_w, top + 3)], fill=WOOD_DEEP)


# layouts -----------------------------------------------------------------------
# every coordinate below is native backdrop pixels. objects in worldObjects.ts
# that stand on these props use the same numbers.

DESKTOP_W_PX, DESKTOP_H_PX, DESKTOP_HORIZON_PX = 640, 360, 124
MOBILE_W_PX, MOBILE_H_PX, MOBILE_HORIZON_PX = 360, 960, 170


def desktop_path_span(y: int) -> tuple[int, int]:
    """desktop path: winds from the bottom middle up to the horizon, narrowing with distance."""
    t = (y - DESKTOP_HORIZON_PX) / (DESKTOP_H_PX - DESKTOP_HORIZON_PX)
    center = 336 - 28 * t + 20 * math.sin(t * 5)
    half = 4 + 46 * t
    return round(center - half), round(center + half)


def mobile_path_span(y: int) -> tuple[int, int]:
    """mobile path: wiggles down between the pond and the garden and ends behind the house."""
    t = (y - MOBILE_HORIZON_PX) / (MOBILE_H_PX - MOBILE_HORIZON_PX)
    center = 186 + 14 * math.sin(t * 7)
    half = 4 + 40 * t
    return round(center - half), round(center + half)


def render_desktop() -> Image.Image:
    """the wide landscape: pond on the left, path up the middle, cutaway house front right."""
    rng = random.Random(RANDOM_SEED)
    img = Image.new("RGB", (DESKTOP_W_PX, DESKTOP_H_PX))
    draw = ImageDraw.Draw(img)
    h = DESKTOP_HORIZON_PX

    draw_sky(img, draw, h, (88, 40, 18))
    for cx, cy, scale in [(220, 34, 1.0), (430, 52, 0.8), (600, 24, 0.6)]:
        draw_cloud(draw, cx, cy, scale)
    draw_mountains(draw, [(0, 100), (60, 72), (110, 96), (190, 56), (260, 92), (330, 66), (400, 96),
                          (470, 60), (540, 90), (600, 70), (640, 96)], h, 80)
    draw_hill(draw, 80, 140, 150, 30, HILL_FAR, HILL_FAR_LIGHT)
    draw_hill(draw, 290, 138, 110, 18, HILL_FAR, HILL_FAR_LIGHT)
    draw_hill(draw, 560, 150, 140, 64, HILL_NEAR, HILL_NEAR_LIGHT)
    draw_cave(img, draw, 564, 118, 40, 38)
    draw_ground(img, draw, rng, h)
    draw_treeline(draw, rng, h, [(0, 250), (372, 470)], (16, 30))
    draw_path(img, draw, rng, desktop_path_span, h + 1, DESKTOP_H_PX)

    draw_clearing(draw, 240, 168, 38, 10)
    draw_signpost(draw, 300, 154, 24)
    draw_crate(draw, 380, 148, 22, 14)
    draw_garden(draw, [(96, 168), (180, 168), (190, 192), (86, 192)])
    draw_tripod(draw, 44, 164, 20)
    draw_pond(img, draw, (148, 254), (96, 32), [(206, 262), (104, 266), (176, 238)],
              [(54, 252), (238, 248), (230, 258)])
    for x, y in [(24, 300), (226, 300), (452, 196), (612, 200), (368, 252)]:
        draw_rock(draw, x, y, 7)
    draw_grill(draw, 80, 312, 20)
    draw_house(draw, HouseSpec(left=410, right=630, wall_top=212, floor=342, vanish=(520, 124),
                               depth=0.66, roof_rise=34, window=(498, 540), table=(518, 326, 22, 12)))
    return img


def render_mobile() -> Image.Image:
    """the tall scene: sky and cave up top, pond and garden mid-scroll, cutaway house at the bottom."""
    rng = random.Random(RANDOM_SEED)
    img = Image.new("RGB", (MOBILE_W_PX, MOBILE_H_PX))
    draw = ImageDraw.Draw(img)
    h = MOBILE_HORIZON_PX

    draw_sky(img, draw, h, (64, 46, 20))
    for cx, cy, scale in [(220, 40, 0.9), (300, 96, 0.6), (110, 108, 0.7)]:
        draw_cloud(draw, cx, cy, scale)
    draw_mountains(draw, [(0, 150), (40, 124), (80, 146), (140, 112), (190, 144), (240, 120),
                          (290, 146), (330, 128), (360, 146)], h, 130)
    draw_hill(draw, 60, 182, 90, 22, HILL_FAR, HILL_FAR_LIGHT)
    draw_hill(draw, 300, 196, 100, 52, HILL_NEAR, HILL_NEAR_LIGHT)
    draw_cave(img, draw, 300, 168, 36, 34)
    draw_ground(img, draw, rng, h)
    draw_treeline(draw, rng, h, [(0, 150), (214, 248)], (14, 26))
    draw_path(img, draw, rng, mobile_path_span, h + 1, 700)

    draw_signpost(draw, 140, 200, 22)
    draw_clearing(draw, 80, 262, 46, 12)
    draw_tripod(draw, 300, 258, 22)
    draw_crate(draw, 266, 336, 26, 16)
    draw_pond(img, draw, (88, 452), (72, 32), [(124, 462), (52, 466), (104, 434)],
              [(16, 446), (160, 444), (154, 456)])
    draw_garden(draw, [(232, 424), (330, 424), (340, 462), (222, 462)])
    for x, y in [(20, 330), (340, 390), (30, 560), (330, 530), (120, 620)]:
        draw_rock(draw, x, y, 7)
    draw_grill(draw, 64, 566, 20)
    draw_house(draw, HouseSpec(left=16, right=344, wall_top=728, floor=928, vanish=(180, 560),
                               depth=0.7, roof_rise=46, window=(156, 204), table=(180, 900, 26, 14)))
    return img


# metadata ------------------------------------------------------------------------

def measure_foot_pads() -> dict[str, float]:
    """
    measures how much empty space sits under the art in each 8-bit sprite.

    Returns:
        sprite url -> percent of the image height that's transparent below the art.
    """
    pads = {}
    for path in sorted(SPRITE_DIR.glob("*.png")):
        with Image.open(path) as sprite:
            alpha = sprite.convert("RGBA").getchannel("A")
            box = alpha.point(lambda a: 255 if a > SPRITE_ALPHA_THRESHOLD else 0).getbbox()
            if box is None:
                print(f"skipped {path.name} -- it's fully transparent, so there's no art to stand on")
                continue
            pads[SPRITE_URL_PREFIX + path.name] = round((sprite.height - box[3]) / sprite.height * 100, 1)
    return pads


def build_meta() -> dict:
    """the json the page reads: layout sizes/horizons/backdrop urls plus sprite foot pads."""
    def layout(name: str, w: int, h: int, horizon: int) -> dict:
        return {"widthPx": w, "heightPx": h, "horizonPx": horizon, "backdropSrc": f"/images/home/world-{name}.png"}

    return {
        "layouts": {
            "desktop": layout("desktop", DESKTOP_W_PX, DESKTOP_H_PX, DESKTOP_HORIZON_PX),
            "mobile": layout("mobile", MOBILE_W_PX, MOBILE_H_PX, MOBILE_HORIZON_PX),
        },
        "footPads": measure_foot_pads(),
    }


def main() -> int:
    """
    renders both backdrops and writes the metadata json.

    Returns:
        process exit code -- 1 if anything couldn't be written.
    """
    try:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        for name, render in [("desktop", render_desktop), ("mobile", render_mobile)]:
            out = OUT_DIR / f"world-{name}.png"
            render().save(out, "PNG", optimize=True)
            print(f"wrote {out} ({out.stat().st_size // 1024}KB)")
        META_PATH.write_text(json.dumps(build_meta(), indent=2) + "\n", encoding="utf-8")
        print(f"wrote {META_PATH}")
    except OSError as err:
        print(f"couldn't write world output: {err} -- check the folders are writable and nothing has the files open")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
