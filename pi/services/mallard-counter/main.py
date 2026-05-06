"""
Mallard Counter Display Service.

Drives an Adafruit SSD1306 OLED display over I2C on Raspberry Pi.
Periodically fetches the current mallard count from the external API and
renders it on the display.
"""

import time
import requests
import board
import busio
from PIL import Image, ImageDraw, ImageFont
import adafruit_ssd1306

# Display dimensions (pixels)
DISPLAY_WIDTH = 128
DISPLAY_HEIGHT = 64

# I2C address — 0x3C is the default for most Adafruit SSD1306 boards
I2C_ADDRESS = 0x3C

# URL of the endpoint that returns {"count": <int>}
COUNT_API_URL = "https://www.traderoutestcg.com/api/mallard-count"

# How often to re-fetch the count from the API (s)
FETCH_INTERVAL_S = 60

# How often to re-render the display (s)
DISPLAY_REFRESH_S = 60

# HTTP request timeout (s)
REQUEST_TIMEOUT_S = 10


def init_display() -> adafruit_ssd1306.SSD1306_I2C:
    """
    Initialize the SSD1306 display over I2C.

    Returns:
        adafruit_ssd1306.SSD1306_I2C: Initialized display object.
    """
    i2c = busio.I2C(board.SCL, board.SDA)
    display = adafruit_ssd1306.SSD1306_I2C(DISPLAY_WIDTH, DISPLAY_HEIGHT, i2c, addr=I2C_ADDRESS)
    display.fill(0)
    display.show()
    return display


def fetch_count(url: str) -> int | None:
    """
    Fetch the current mallard count from the API.

    Expects a JSON response with a top-level "count" integer field.

    Args:
        url: Full URL of the count endpoint.

    Returns:
        The mallard count as an int, or None if the request failed.
    """
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT_S)
        response.raise_for_status()
        data = response.json()
        return int(data["count"])
    except requests.RequestException as exc:
        print(f"Failed to fetch count from {url}: {exc} — retrying next cycle")
        return None
    except (KeyError, ValueError, TypeError) as exc:
        print(f"Unexpected response format from {url}: {exc} — expected {{\"count\": <int>}}")
        return None


def render_frame(display: adafruit_ssd1306.SSD1306_I2C, label: str) -> None:
    """
    Draw the current mallard count (or a placeholder) onto the display.

    Args:
        display: Initialized SSD1306 display object.
        label: The string to show as the count (e.g. "1234" or "---").
    """
    image = Image.new("1", (DISPLAY_WIDTH, DISPLAY_HEIGHT))
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT), outline=0, fill=0)

    font = ImageFont.load_default()
    draw.text((0, 0), "MALLARDS", font=font, fill=255)
    draw.line((0, 12, DISPLAY_WIDTH, 12), fill=255)
    draw.text((30, 24), label, font=font, fill=255)

    display.image(image)
    display.show()


def main() -> None:
    """
    Main loop: fetch the mallard count from the API every hour and render it.

    Shows "---" until the first successful fetch. On fetch failure, keeps
    displaying the last known count (or "---" if no count has ever succeeded).
    """
    print("Initializing display...")
    display = init_display()
    print(f"Display ready at I2C address 0x{I2C_ADDRESS:02X}")

    current_count: int | None = None
    last_fetch_time = 0.0

    while True:
        now = time.monotonic()

        if now - last_fetch_time >= FETCH_INTERVAL_S:
            print(f"Fetching count from {COUNT_API_URL}...")
            result = fetch_count(COUNT_API_URL)
            if result is not None:
                current_count = result
                print(f"Count updated: {current_count}")
            last_fetch_time = now

        label = str(current_count) if current_count is not None else "---"
        render_frame(display, label)
        print(f"Displayed: {label}")

        time.sleep(DISPLAY_REFRESH_S)


if __name__ == "__main__":
    main()
