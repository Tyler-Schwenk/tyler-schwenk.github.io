"""
draws the pixel-art backdrop for the home page world (public/images/home/world.png).

it's painted at a tiny native res (WORLD_W_PX x WORLD_H_PX) with PIL's aliased
shapes so every edge is a hard pixel, then the site scales it up with
`image-rendering: pixelated`. the clickable sprites aren't in here -- they're
layered on top by components/home/HomeWorld.tsx using the positions in
components/home/worldObjects.ts, so if you move a landmark here (pond, deck,
cave...) move the matching objects there too.

randomness (grass dither, flowers) comes from a fixed seed so reruns are
byte-identical.

usage (from anywhere): python website/scripts/generate_home_world.py
"""

import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw

OUT_PATH = Path(__file__).resolve().parent.parent / "public" / "images" / "home" / "world.png"

# 16:9 so it lines up with the aspect-video scene box
WORLD_W_PX = 320
WORLD_H_PX = 180
HORIZON_Y_PX = 62
RANDOM_SEED = 8

# sky, top band first
SKY_BANDS = ["#2848b0", "#3058c0", "#4070d0", "#5888e0", "#78a8e8", "#a0c8f0"]
SUN = "#f8d030"
SUN_RIM = "#f8a830"
CLOUD = "#ffffff"
CLOUD_SHADE = "#c8d8f0"
MOUNTAIN = "#6070a8"
MOUNTAIN_LIGHT = "#8090c0"
SNOW = "#e8f0f8"
HILL_FAR = "#2e7a44"
HILL_NEAR = "#38904c"
PINE = "#1c5030"
PINE_LIGHT = "#2a6a3c"

# far band first. bands get taller toward the viewer to fake perspective
GRASS_BANDS = ["#4c9c48", "#54a84e", "#5cb454", "#62bc58"]
GRASS_DARK = "#3e8a3c"
GRASS_LIGHT = "#7cd070"
FLOWER_COLORS = ["#f8f8f8", "#f8d030", "#e85080", "#a070e0"]

PATH = "#c8a060"
PATH_EDGE = "#9a7444"
PEBBLE = "#e0c088"

WATER = "#3870c8"
WATER_LIGHT = "#5090e0"
WATER_GLINT = "#b8e0f8"
SHORE_MUD = "#7a6040"
SHORE_SAND = "#d0b878"
LILY = "#3a9c40"
REED = "#2a6a2c"
CATTAIL = "#7a4a24"

DIRT = "#7a4e2c"
FURROW = "#5a361c"
WOOD = "#a8743c"
WOOD_DARK = "#7a5028"
WOOD_LIGHT = "#c08a4c"
STONE = "#9098a0"
STONE_DARK = "#606870"
METAL = "#303438"
METAL_LIGHT = "#58606a"
CAVE = "#120818"
CAVE_GLOW = "#6a2c8a"
CAVE_GLOW_BRIGHT = "#b060e0"
CLEARING = "#a89060"

# landmark anchors (native px). worldObjects.ts positions are these divided by
# the world size, as percents
POND_CENTER = (72, 124)
POND_RADII = (48, 17)
LILY_PADS = [(100, 129), (52, 130), (88, 117)]
GARDEN_TOP_Y = 96
GARDEN_BOTTOM_Y = 110
CAVE_CENTER_X = 282
CAVE_BOTTOM_Y = 58
CLEARING_CENTER = (120, 84)
CRATE_TOP_LEFT = (198, 92)
GRILL_TOP_CENTER = (40, 158)
TRIPOD_TOP = (24, 82)
SIGNPOST_BASE = (150, 76)
DECK_TOP_Y = 142


def hex_rgb(color: str) -> tuple[int, int, int]:
    """turns '#rrggbb' into an (r, g, b) tuple."""
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def ellipse(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, fill: str) -> None:
    """fills an axis-aligned ellipse from its center and radii."""
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=fill)


def path_span(y: int) -> tuple[int, int]:
    """
    left/right x of the dirt path on row y.

    the path winds from the bottom middle up to the horizon, getting narrower
    the farther away it is.

    Args:
        y: screen row, at or below the horizon.

    Returns:
        (left x, right x) of the path on that row.
    """
    t = (y - HORIZON_Y_PX) / (WORLD_H_PX - HORIZON_Y_PX)
    center = 168 - 14 * t + 10 * math.sin(t * 5)
    half_width = 2 + 24 * t
    return round(center - half_width), round(center + half_width)


def draw_sky(draw: ImageDraw.ImageDraw) -> None:
    """paints the banded sky, sun, and a few blocky clouds."""
    band_h = math.ceil(HORIZON_Y_PX / len(SKY_BANDS))
    for i, color in enumerate(SKY_BANDS):
        draw.rectangle((0, i * band_h, WORLD_W_PX, (i + 1) * band_h), fill=color)

    ellipse(draw, 44, 18, 11, 11, SUN_RIM)
    ellipse(draw, 44, 18, 9, 9, SUN)

    for cx, cy, scale in [(110, 14, 1.0), (215, 24, 0.8), (300, 10, 0.6)]:
        puffs = [(-10, 2, 7, 4), (0, 0, 9, 6), (10, 2, 7, 4)]
        for dx, dy, rx, ry in puffs:
            ellipse(draw, cx + round(dx * scale), cy + round(dy * scale) + 1,
                    round(rx * scale), round(ry * scale), CLOUD_SHADE)
        for dx, dy, rx, ry in puffs:
            ellipse(draw, cx + round(dx * scale), cy + round(dy * scale),
                    round(rx * scale), round(ry * scale), CLOUD)


def draw_mountains_and_hills(draw: ImageDraw.ImageDraw) -> None:
    """distant mountain range, rolling hills, and the opium den cave."""
    peaks = [(0, 50), (30, 36), (55, 46), (95, 28), (130, 44), (165, 32), (200, 46),
             (235, 30), (270, 42), (300, 34), (320, 44)]
    draw.polygon([(0, HORIZON_Y_PX)] + peaks + [(WORLD_W_PX, HORIZON_Y_PX)], fill=MOUNTAIN)
    for x, y in peaks:
        # lit left face + snowcap on the taller peaks
        draw.polygon([(x, y), (x - 8, y + 10), (x - 2, y + 10)], fill=MOUNTAIN_LIGHT)
        if y < 40:
            draw.polygon([(x, y), (x - 3, y + 4), (x + 3, y + 4)], fill=SNOW)

    ellipse(draw, 40, 68, 70, 16, HILL_FAR)
    ellipse(draw, 150, 70, 60, 10, HILL_FAR)
    ellipse(draw, 280, 74, 72, 32, HILL_NEAR)

    # the cave mouth, cut into the right hill
    cx, by = CAVE_CENTER_X, CAVE_BOTTOM_Y
    ellipse(draw, cx, by - 9, 10, 9, CAVE_GLOW)
    draw.rectangle((cx - 10, by - 9, cx + 10, by), fill=CAVE_GLOW)
    ellipse(draw, cx, by - 9, 8, 7, CAVE)
    draw.rectangle((cx - 8, by - 9, cx + 8, by), fill=CAVE)
    for px, py in [(cx - 3, by - 6), (cx + 2, by - 9), (cx + 4, by - 3), (cx - 5, by - 2)]:
        draw.point((px, py), fill=CAVE_GLOW_BRIGHT)
    for sx in (cx - 13, cx + 12):
        draw.rectangle((sx, by - 3, sx + 2, by), fill=STONE)


def draw_treeline(draw: ImageDraw.ImageDraw, rng: random.Random) -> None:
    """little pines along the horizon, leaving a gap where the path disappears."""
    for x0, x1 in [(0, 120), (186, 228)]:
        for x in range(x0, x1, 7):
            h = rng.randint(8, 14)
            base = HORIZON_Y_PX + rng.randint(0, 2)
            draw.polygon([(x, base - h), (x - 4, base), (x + 4, base)], fill=PINE)
            draw.line([(x, base - h), (x - 3, base - 1)], fill=PINE_LIGHT)


def draw_ground(draw: ImageDraw.ImageDraw, rng: random.Random) -> None:
    """grass bands with dither noise, tufts, and scattered flowers."""
    ground_h = WORLD_H_PX - HORIZON_Y_PX
    # band heights grow quadratically so the near grass reads as closer
    weights = [(i + 1) ** 2 for i in range(len(GRASS_BANDS))]
    y = HORIZON_Y_PX
    for color, weight in zip(GRASS_BANDS, weights):
        h = round(ground_h * weight / sum(weights))
        draw.rectangle((0, y, WORLD_W_PX, y + h), fill=color)
        y += h

    for _ in range(1400):
        x, y = rng.randrange(WORLD_W_PX), rng.randrange(HORIZON_Y_PX + 2, WORLD_H_PX)
        draw.point((x, y), fill=GRASS_DARK)
    for _ in range(90):
        x, y = rng.randrange(WORLD_W_PX), rng.randrange(HORIZON_Y_PX + 30, WORLD_H_PX)
        draw.line([(x, y), (x - 1, y - 2)], fill=GRASS_LIGHT)
        draw.line([(x, y), (x + 1, y - 2)], fill=GRASS_LIGHT)
    for _ in range(60):
        x, y = rng.randrange(WORLD_W_PX), rng.randrange(HORIZON_Y_PX + 20, WORLD_H_PX)
        draw.point((x, y), fill=rng.choice(FLOWER_COLORS))


def draw_path(draw: ImageDraw.ImageDraw, rng: random.Random) -> None:
    """the winding dirt path, drawn row by row so its edges stay pixel-crisp."""
    for y in range(HORIZON_Y_PX + 1, WORLD_H_PX):
        left, right = path_span(y)
        draw.line([(left, y), (right, y)], fill=PATH)
        draw.point((left, y), fill=PATH_EDGE)
        draw.point((right, y), fill=PATH_EDGE)
    for _ in range(40):
        y = rng.randrange(HORIZON_Y_PX + 20, WORLD_H_PX)
        left, right = path_span(y)
        if right - left > 4:
            draw.point((rng.randrange(left + 2, right - 1), y), fill=PEBBLE)


def draw_pond(draw: ImageDraw.ImageDraw) -> None:
    """the frog pond -- shore, water, glints, lily pads, and cattails."""
    (cx, cy), (rx, ry) = POND_CENTER, POND_RADII
    ellipse(draw, cx, cy + 1, rx + 5, ry + 4, SHORE_SAND)
    ellipse(draw, cx, cy, rx + 2, ry + 2, SHORE_MUD)
    ellipse(draw, cx, cy, rx, ry, WATER)
    ellipse(draw, cx - 4, cy - 3, rx - 12, ry - 7, WATER_LIGHT)
    for gx, gy, length in [(50, 117, 6), (78, 121, 4), (64, 128, 5), (92, 124, 3)]:
        draw.line([(gx, gy), (gx + length, gy)], fill=WATER_GLINT)
    for lx, ly in LILY_PADS:
        ellipse(draw, lx, ly, 5, 2, LILY)
        draw.point((lx + 3, ly - 1), fill=WATER)
    for rx_, base in [(24, 122), (27, 124), (30, 121), (116, 118), (119, 120), (113, 121)]:
        draw.line([(rx_, base), (rx_, base - 9)], fill=REED)
        draw.rectangle((rx_, base - 9, rx_ + 1, base - 7), fill=CATTAIL)


def draw_garden(draw: ImageDraw.ImageDraw) -> None:
    """tilled garden plot, a trapezoid so it looks laid flat on the ground."""
    top, bottom = GARDEN_TOP_Y, GARDEN_BOTTOM_Y
    draw.polygon([(234, top), (276, top), (282, bottom), (228, bottom)], fill=DIRT)
    for y in range(top + 2, bottom, 3):
        t = (y - top) / (bottom - top)
        draw.line([(round(234 - 6 * t) + 1, y), (round(276 + 6 * t) - 1, y)], fill=FURROW)
    # fence posts along the back edge
    for x in range(232, 280, 8):
        draw.rectangle((x, top - 4, x + 1, top), fill=WOOD_DARK)
    draw.line([(232, top - 3), (279, top - 3)], fill=WOOD)


def draw_props(draw: ImageDraw.ImageDraw) -> None:
    """the little set pieces sprites sit on: crate, grill, tripod, signpost, clearing."""
    cx, cy = CLEARING_CENTER
    ellipse(draw, cx, cy, 18, 5, CLEARING)

    x, y = CRATE_TOP_LEFT
    draw.rectangle((x, y, x + 13, y + 8), fill=WOOD)
    draw.rectangle((x, y, x + 13, y + 1), fill=WOOD_LIGHT)
    draw.line([(x, y + 2), (x + 13, y + 8)], fill=WOOD_DARK)
    draw.rectangle((x, y, x + 13, y + 8), outline=WOOD_DARK)

    gx, gy = GRILL_TOP_CENTER
    ellipse(draw, gx, gy + 6, 14, 3, GRASS_DARK)
    for leg_dx in (-7, 0, 7):
        draw.line([(gx, gy + 4), (gx + leg_dx, gy + 13)], fill=METAL)
    draw.pieslice((gx - 10, gy - 6, gx + 10, gy + 8), 0, 180, fill=METAL)
    draw.rectangle((gx - 10, gy, gx + 10, gy + 1), fill=METAL_LIGHT)

    tx, ty = TRIPOD_TOP
    for leg_dx in (-5, 0, 5):
        draw.line([(tx, ty), (tx + leg_dx, ty + 10)], fill=METAL)

    sx, sy = SIGNPOST_BASE
    draw.rectangle((sx, sy - 12, sx + 1, sy), fill=WOOD_DARK)
    draw.polygon([(sx - 6, sy - 12), (sx + 6, sy - 12), (sx + 9, sy - 10),
                  (sx + 6, sy - 8), (sx - 6, sy - 8)], fill=WOOD_LIGHT)

    for rx_, ry_ in [(12, 150), (110, 150), (300, 120), (196, 128)]:
        ellipse(draw, rx_, ry_, 4, 2, STONE_DARK)
        ellipse(draw, rx_, ry_ - 1, 3, 2, STONE)


def draw_deck(draw: ImageDraw.ImageDraw) -> None:
    """wooden deck in the front right where the indoor-ish stuff lives."""
    top, bottom = DECK_TOP_Y, WORLD_H_PX
    draw.polygon([(206, top), (304, top), (320, bottom), (192, bottom)], fill=WOOD)
    y = top
    gap = 3
    while y < bottom:
        t = (y - top) / (bottom - top)
        draw.line([(round(206 - 14 * t), y), (round(304 + 16 * t), y)], fill=WOOD_DARK)
        # planks get thicker toward the viewer
        y += gap + round(3 * t)
    draw.line([(206, top), (304, top)], fill=WOOD_LIGHT)


def render_world() -> Image.Image:
    """paints every layer back to front and returns the finished image."""
    rng = random.Random(RANDOM_SEED)
    img = Image.new("RGB", (WORLD_W_PX, WORLD_H_PX), hex_rgb(SKY_BANDS[0]))
    draw = ImageDraw.Draw(img)
    draw_sky(draw)
    draw_mountains_and_hills(draw)
    draw_ground(draw, rng)
    draw_treeline(draw, rng)
    draw_path(draw, rng)
    draw_pond(draw)
    draw_garden(draw)
    draw_props(draw)
    draw_deck(draw)
    return img


def main() -> int:
    """
    renders the world and writes it to OUT_PATH.

    Returns:
        process exit code -- 1 if the png couldn't be written.
    """
    try:
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        render_world().save(OUT_PATH, "PNG", optimize=True)
    except OSError as err:
        print(f"couldn't write {OUT_PATH}: {err} -- check the folder is writable and the file isn't open elsewhere")
        return 1
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size // 1024}KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
