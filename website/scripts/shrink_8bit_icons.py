"""
shrinks the 8-bit menu/nav icons in public/images/8bit/ down to web size, in place.

they come out of the generator at ~1024px and 1-1.5MB each, but most never show
much bigger than 56px (the nav logo), so anything past 2x that is wasted
download. a few render big in the home page world and get a larger cap in
MAX_EDGE_OVERRIDES_PX. icons already at or under their max edge are left alone,
so it's safe to rerun after dropping in new ones.

usage (from anywhere): python website/scripts/shrink_8bit_icons.py
"""

import sys
from pathlib import Path

from PIL import Image

ICON_DIR = Path(__file__).resolve().parent.parent / "public" / "images" / "8bit"

# 2x the biggest render size (56px nav logo) so they stay sharp on retina screens
ICON_MAX_EDGE_PX = 112

# sprites the home page world draws much bigger than an icon. solar.png is the
# whole house roof there, up to ~450px wide on a big desktop
MAX_EDGE_OVERRIDES_PX = {"solar.png": 480}


def shrink_icon(path: Path) -> tuple[int, int] | None:
    """
    resize one icon so its longest edge is its max (ICON_MAX_EDGE_PX unless it's
    in MAX_EDGE_OVERRIDES_PX), keeping aspect ratio.

    Args:
        path: the png to shrink. overwritten in place.

    Returns:
        (bytes before, bytes after), or None if it was already small enough.
    """
    size_before = path.stat().st_size
    max_edge = MAX_EDGE_OVERRIDES_PX.get(path.name, ICON_MAX_EDGE_PX)
    with Image.open(path) as img:
        if max(img.size) <= max_edge:
            return None
        img.load()
        # LANCZOS rather than NEAREST -- the source art isn't on a true pixel grid,
        # so nearest-neighbor would just alias it
        img.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        img.save(path, "PNG", optimize=True)
    return size_before, path.stat().st_size


def main() -> int:
    """
    shrink every png in ICON_DIR and print what changed.

    Returns:
        process exit code -- 1 if the icon folder is missing or any icon failed.
    """
    if not ICON_DIR.is_dir():
        print(f"icon folder not found at {ICON_DIR} -- run this from a full checkout of the repo")
        return 1

    failed = False
    for path in sorted(ICON_DIR.glob("*.png")):
        try:
            result = shrink_icon(path)
        except OSError as err:
            print(f"couldn't shrink {path.name}: {err} -- check it's a valid png and not open elsewhere")
            failed = True
            continue
        if result is None:
            print(f"skipped {path.name} (already small)")
            continue
        before, after = result
        print(f"shrunk {path.name}: {before // 1024}KB -> {after // 1024}KB")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
