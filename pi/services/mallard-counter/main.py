"""
Mallard Counter Display Service.

Drives an Adafruit SSD1306 OLED display over I2C on Raspberry Pi.
Displays a mallard count fetched from the backend API.

Currently in test mode: displays a static number to verify hardware is working.
"""

import time
import board
import busio
from PIL import Image, ImageDraw, ImageFont
import adafruit_ssd1306

# Display dimensions (pixels)
DISPLAY_WIDTH = 128
DISPLAY_HEIGHT = 64

# I2C address — 0x3C is the default for most Adafruit SSD1306 boards
I2C_ADDRESS = 0x3C

# Refresh interval in seconds
REFRESH_INTERVAL = 5


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


def render_frame(display: adafruit_ssd1306.SSD1306_I2C, count: int) -> None:
    """
    Draw the current mallard count onto the display.

    Args:
        display: Initialized SSD1306 display object.
        count: The mallard count to display.
    """
    image = Image.new("1", (DISPLAY_WIDTH, DISPLAY_HEIGHT))
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT), outline=0, fill=0)

    font = ImageFont.load_default()
    draw.text((0, 0), "MALLARDS", font=font, fill=255)
    draw.line((0, 12, DISPLAY_WIDTH, 12), fill=255)
    draw.text((30, 24), str(count), font=font, fill=255)

    display.image(image)
    display.show()


def main() -> None:
    """
    Main loop: initialize display and render a test count on repeat.

    Replace TEST_COUNT with an API call once the endpoint is ready.
    """
    TEST_COUNT = 42

    print("Initializing display...")
    display = init_display()
    print(f"Display ready at I2C address 0x{I2C_ADDRESS:02X}")

    while True:
        render_frame(display, TEST_COUNT)
        print(f"Displayed count: {TEST_COUNT}")
        time.sleep(REFRESH_INTERVAL)


if __name__ == "__main__":
    main()
