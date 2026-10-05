#!/usr/bin/env python3
"""idle splash screen for castpi.

draws a status screen straight into the linux framebuffer (/dev/fb0) while nobody's
casting: whether the receiver is ready, how to connect, wifi and ip, and how many times
uxplay has restarted since boot (handy for spotting crashes). uxplay's kmssink draws
video on an overlay plane above the framebuffer, so the splash sits underneath it. it's
blanked while a phone is mirroring so it doesn't peek out beside portrait video.

runs forever as castpi-splash.service. it only redraws when what's on screen would
change, so it's idle most of the time.
"""

import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

FB_DEVICE = Path("/dev/fb0")
FB_SYSFS = Path("/sys/class/graphics/fb0")
HDMI_STATUS_GLOB = "card*-HDMI-A-*/status"
DRM_SYSFS = Path("/sys/class/drm")
UXPLAY_UNIT = "uxplay.service"
AIRPLAY_NAME = "Opium Den TV"
HOSTNAME_FILE = Path("/etc/hostname")
NETWORK_INTERFACES = ("wlan0", "eth0")

POLL_S = 2
COMMAND_TIMEOUT_S = 5

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
# sizes are for a 1080-line screen and get scaled to whatever the framebuffer is
REFERENCE_HEIGHT_PX = 1080
TITLE_SIZE_PX = 110
STATUS_SIZE_PX = 64
BODY_SIZE_PX = 40
SMALL_SIZE_PX = 30
LINE_GAP_PX = 22
SECTION_GAP_PX = 70

BACKGROUND = (12, 14, 20)
TITLE_COLOR = (240, 240, 245)
BODY_COLOR = (190, 195, 205)
DIM_COLOR = (110, 115, 125)
READY_COLOR = (90, 210, 120)
WARN_COLOR = (235, 185, 70)


def run(args):
    """run a command and return its stdout, or "" if it fails.

    Args:
        args: command and arguments as a list.

    Returns:
        str: stripped stdout, empty on any error so a missing tool never kills the splash.
    """
    try:
        result = subprocess.run(
            args, capture_output=True, text=True, timeout=COMMAND_TIMEOUT_S, check=False
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"splash: couldn't run {args[0]}: {exc}", file=sys.stderr)
        return ""
    return result.stdout.strip()


def hdmi_connected():
    """True if any hdmi connector reports a connected screen."""
    for status_file in DRM_SYSFS.glob(HDMI_STATUS_GLOB):
        if status_file.read_text().strip() == "connected":
            return True
    return False


def mirroring_active():
    """True if a phone is mirroring (uxplay has an established tcp connection)."""
    return '"uxplay"' in run(["ss", "-Htnp", "state", "established"])


def uxplay_state():
    """returns (active state, restarts since boot) for uxplay.service."""
    lines = run(["systemctl", "show", "-p", "ActiveState", "-p", "NRestarts", UXPLAY_UNIT])
    props = dict(line.split("=", 1) for line in lines.splitlines() if "=" in line)
    return props.get("ActiveState", "unknown"), props.get("NRestarts", "?")


def wifi_summary():
    """returns a short 'ssid, signal%' string for the active wifi network, or ""."""
    for line in run(["nmcli", "-t", "-f", "ACTIVE,SSID,SIGNAL", "dev", "wifi"]).splitlines():
        # ssids can contain colons, which nmcli escapes as \:
        fields = line.replace("\\:", "\x00").split(":")
        if len(fields) == 3 and fields[0] == "yes":
            ssid = fields[1].replace("\x00", ":")
            return f"{ssid}, signal {fields[2]}%"
    return ""


def ip_addresses():
    """returns 'iface ip' strings for each network interface that has an ipv4 address."""
    addresses = []
    for iface in NETWORK_INTERFACES:
        fields = run(["ip", "-4", "-br", "addr", "show", iface]).split()
        if len(fields) >= 3:
            addresses.append(f"{iface} {fields[2].split('/')[0]}")
    return addresses


def build_screen():
    """collects status and returns the splash content.

    Returns:
        tuple | None: None while a phone is mirroring (screen should be black),
        otherwise a tuple of (text, size, color) lines. it's hashable, so the caller
        can skip redraws when nothing changed.
    """
    if mirroring_active():
        return None

    state, restarts = uxplay_state()
    if state == "active":
        status = ("Ready to cast", READY_COLOR)
    elif state == "activating" and not hdmi_connected():
        status = ("Waiting for the TV", WARN_COLOR)
    else:
        status = (f"Receiver starting ({state})", WARN_COLOR)

    wifi = wifi_summary() or "not connected"
    addresses = ", ".join(ip_addresses()) or "no network"
    hostname = HOSTNAME_FILE.read_text().strip()

    return (
        (AIRPLAY_NAME, TITLE_SIZE_PX, TITLE_COLOR),
        (status[0], STATUS_SIZE_PX, status[1]),
        ("", SECTION_GAP_PX, BODY_COLOR),
        ("On your iPhone: Control Center > Screen Mirroring > " + AIRPLAY_NAME,
         BODY_SIZE_PX, BODY_COLOR),
        ("Your phone has to be on the home Wi-Fi", BODY_SIZE_PX, BODY_COLOR),
        ("", SECTION_GAP_PX, BODY_COLOR),
        (f"Wi-Fi: {wifi}", SMALL_SIZE_PX, DIM_COLOR),
        (f"{hostname}: {addresses}", SMALL_SIZE_PX, DIM_COLOR),
        (f"Receiver restarts since boot: {restarts}", SMALL_SIZE_PX, DIM_COLOR),
        (time.strftime("%a %b %-d, %-I:%M %p"), SMALL_SIZE_PX, DIM_COLOR),
    )


def framebuffer_geometry():
    """returns (width, height, stride bytes, bits per pixel) of /dev/fb0."""
    width, height = (int(v) for v in (FB_SYSFS / "virtual_size").read_text().split(","))
    stride = int((FB_SYSFS / "stride").read_text())
    bpp = int((FB_SYSFS / "bits_per_pixel").read_text())
    return width, height, stride, bpp


def render(lines, width, height):
    """draws the splash lines, centered, onto a new rgb image.

    Args:
        lines: content from build_screen(), or None for a black screen.
        width, height: framebuffer size in pixels.

    Returns:
        PIL.Image.Image: the rendered rgb image.
    """
    image = Image.new("RGB", (width, height), (0, 0, 0) if lines is None else BACKGROUND)
    if lines is None:
        return image

    draw = ImageDraw.Draw(image)
    scale = height / REFERENCE_HEIGHT_PX
    gap = int(LINE_GAP_PX * scale)
    laid_out = []
    for index, (text, size, color) in enumerate(lines):
        font_path = FONT_BOLD if index < 2 else FONT_REGULAR
        font = ImageFont.truetype(font_path, max(1, int(size * scale)))
        # empty lines are spacers whose "size" is the gap they leave
        line_height = int(size * scale) if not text else font.getbbox(text)[3]
        laid_out.append((text, font, color, line_height))

    total_height = sum(entry[3] for entry in laid_out) + gap * (len(laid_out) - 1)
    y = (height - total_height) // 2
    for text, font, color, line_height in laid_out:
        if text:
            text_width = draw.textlength(text, font=font)
            draw.text(((width - text_width) // 2, y), text, font=font, fill=color)
        y += line_height + gap
    return image


def to_rgb565(image):
    """packs an rgb image into little-endian rgb565 bytes.

    pillow has no rgb565 packer, so this builds the two bytes of each pixel as 8-bit
    images (rrrrrggg and gggbbbbb) and interleaves them. the bit fields never overlap,
    so add() works as a bitwise or. all of it runs in pillow's c code.

    Args:
        image: rgb PIL image.

    Returns:
        bytes: 2 bytes per pixel, low byte first.
    """
    red, green, blue = image.split()
    high = ImageChops.add(red.point(lambda v: v & 0xF8), green.point(lambda v: v >> 5))
    low = ImageChops.add(green.point(lambda v: (v << 3) & 0xE0), blue.point(lambda v: v >> 3))
    return Image.merge("LA", (low, high)).tobytes()


def to_framebuffer_bytes(image, stride, bpp):
    """converts an rgb image to the framebuffer's pixel format.

    Args:
        image: rgb PIL image the size of the framebuffer.
        stride: bytes per framebuffer row.
        bpp: bits per pixel, 16 (rgb565) or 32 (xrgb8888).

    Returns:
        bytes: raw rows ready to write to /dev/fb0.

    Raises:
        ValueError: for a pixel format we don't handle.
    """
    if bpp == 16:
        raw = to_rgb565(image)
    elif bpp == 32:
        raw = image.convert("RGBA").tobytes("raw", "BGRA")
    else:
        raise ValueError(f"framebuffer is {bpp} bits per pixel; only 16 and 32 are handled")

    row_bytes = image.width * bpp // 8
    if row_bytes == stride:
        return raw
    padding = bytes(stride - row_bytes)
    return b"".join(
        raw[row * row_bytes:(row + 1) * row_bytes] + padding for row in range(image.height)
    )


def draw(lines):
    """renders lines and writes them to the framebuffer."""
    width, height, stride, bpp = framebuffer_geometry()
    image = render(lines, width, height)
    with FB_DEVICE.open("wb") as fb:
        fb.write(to_framebuffer_bytes(image, stride, bpp))


def main():
    """polls status forever and redraws the framebuffer when it changes."""
    shown = object()
    while True:
        try:
            lines = build_screen()
            if lines != shown:
                draw(lines)
                shown = lines
        except (OSError, ValueError) as exc:
            # keep going: a missing framebuffer (no screen yet) fixes itself on hotplug
            print(f"splash: couldn't draw, retrying in {POLL_S}s: {exc}", file=sys.stderr)
            shown = object()
        time.sleep(POLL_S)


if __name__ == "__main__":
    main()
