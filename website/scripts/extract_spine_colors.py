"""
picks a spine color for every book cover in public/images/library/covers/ and writes
them to data/spineColors.json, so books on the shelf match their real covers.

the spine color is the cover's dominant color (the biggest bucket after cutting the
cover down to a few colors), and the ink is whichever of the page's light/dark text
colors has more contrast on it. books without a cover file aren't in the output, so
the shelf falls back to a bookcloth color for them. output is sorted and only depends
on the cover files, so rerunning is safe and gives the same file.

needs Pillow (pip install pillow).

usage (from anywhere): python website/scripts/extract_spine_colors.py
"""

import json
import sys
from pathlib import Path

from PIL import Image

WEBSITE_DIR = Path(__file__).resolve().parent.parent
COVER_DIR = WEBSITE_DIR / "public" / "images" / "library" / "covers"
OUTPUT_PATH = WEBSITE_DIR / "data" / "spineColors.json"
COVER_GLOB = "*.jpg"

# shrinking first makes quantizing fast and smooths out jpeg noise
SAMPLE_SIZE_PX = 64
# few enough buckets that a cover's main color wins as one bucket
PALETTE_SIZE = 5

# same as the shelf's spine ink colors in library.module.css
LIGHT_INK = "#f3e7c8"
DARK_INK = "#2a2119"

# WCAG relative luminance constants
SRGB_LINEAR_CUTOFF = 0.04045
SRGB_LINEAR_SLOPE = 12.92
SRGB_GAMMA_OFFSET = 0.055
SRGB_GAMMA_SCALE = 1.055
SRGB_GAMMA = 2.4
LUMINANCE_WEIGHTS = (0.2126, 0.7152, 0.0722)
CONTRAST_FLARE = 0.05
CHANNEL_MAX = 255


def dominant_color(cover_path: Path) -> tuple[int, int, int]:
    """
    find the color that covers the most of a cover.

    Args:
        cover_path: path to the cover jpg.

    Returns:
        (r, g, b) of the biggest color bucket, 0-255 each.
    """
    with Image.open(cover_path) as cover:
        sample = cover.convert("RGB")
    sample.thumbnail((SAMPLE_SIZE_PX, SAMPLE_SIZE_PX))
    quantized = sample.quantize(colors=PALETTE_SIZE, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()
    # ties go to the lower palette index, so the pick is stable
    _, index = max(quantized.getcolors(), key=lambda bucket: (bucket[0], -bucket[1]))
    red, green, blue = palette[index * 3 : index * 3 + 3]
    return red, green, blue


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    """
    WCAG relative luminance of an sRGB color.

    Args:
        rgb: (r, g, b), 0-255 each.

    Returns:
        luminance from 0 (black) to 1 (white).
    """
    linear = []
    for channel in rgb:
        value = channel / CHANNEL_MAX
        if value <= SRGB_LINEAR_CUTOFF:
            linear.append(value / SRGB_LINEAR_SLOPE)
        else:
            linear.append(((value + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_SCALE) ** SRGB_GAMMA)
    return sum(weight * value for weight, value in zip(LUMINANCE_WEIGHTS, linear))


def contrast_ratio(first: tuple[int, int, int], second: tuple[int, int, int]) -> float:
    """
    WCAG contrast ratio between two colors.

    Args:
        first: (r, g, b), 0-255 each.
        second: (r, g, b), 0-255 each.

    Returns:
        ratio from 1 (same) to 21 (black on white).
    """
    lighter, darker = sorted((relative_luminance(first), relative_luminance(second)), reverse=True)
    return (lighter + CONTRAST_FLARE) / (darker + CONTRAST_FLARE)


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """
    parse a "#rrggbb" color.

    Args:
        hex_color: color like "#2a2119".

    Returns:
        (r, g, b), 0-255 each.
    """
    digits = hex_color.lstrip("#")
    return int(digits[0:2], 16), int(digits[2:4], 16), int(digits[4:6], 16)


def spine_color(cover_path: Path) -> dict[str, str]:
    """
    work out one book's spine background and the ink that reads best on it.

    Args:
        cover_path: path to the cover jpg.

    Returns:
        {"background": "#rrggbb", "ink": "#rrggbb"}.
    """
    background = dominant_color(cover_path)
    ink = max(
        (LIGHT_INK, DARK_INK),
        key=lambda candidate: contrast_ratio(background, hex_to_rgb(candidate)),
    )
    return {"background": "#{:02x}{:02x}{:02x}".format(*background), "ink": ink}


def main() -> int:
    """
    extract a spine color from every cover and write them all to the json file.

    Returns:
        process exit code: 0 on success, 1 if any cover couldn't be read.
    """
    colors = {}
    problems = []
    for cover_path in sorted(COVER_DIR.glob(COVER_GLOB)):
        try:
            colors[cover_path.stem] = spine_color(cover_path)
        except OSError as error:
            problems.append(f"{cover_path.name} ({error})")

    OUTPUT_PATH.write_text(json.dumps(colors, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(colors)} spine colors to {OUTPUT_PATH.relative_to(WEBSITE_DIR)}")

    if problems:
        print(
            f"couldn't read: {', '.join(problems)}. those books get a bookcloth spine -- "
            "replace the broken cover jpg (or rerun fetch_book_covers.py after deleting it) "
            "and run this again."
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
