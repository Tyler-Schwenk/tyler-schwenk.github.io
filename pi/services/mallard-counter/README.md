# Mallard Counter

Raspberry Pi service that drives an Adafruit SSD1306 OLED display (128x64, I2C) to show the current mallard count from the backend API.

## Hardware

- Adafruit SSD1306 OLED (128x64)
- Connected via I2C (default address `0x3C`)

| OLED Pin | Pi Pin | Label |
|----------|--------|-------|
| VCC | 1 | 3.3V |
| GND | 6 | GND |
| SDA | 3 | GPIO 2 |
| SCL | 5 | GPIO 3 |

## Pi Setup

Enable I2C on the Pi (one-time):

```bash
sudo raspi-config
# Interface Options → I2C → Enable
sudo reboot
```

Verify display is detected:

```bash
sudo apt install i2c-tools
i2cdetect -y 1
# Should show 0x3c in the grid
```

## Running

```bash
pip install -r requirements.txt
python main.py
```

## Running as a systemd service

```bash
sudo nano /etc/systemd/system/mallard-counter.service
```

```ini
[Unit]
Description=Mallard Counter Display
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/tyler/tyler-schwenk.github.io/pi/services/mallard-counter/main.py
WorkingDirectory=/home/tyler/tyler-schwenk.github.io/pi/services/mallard-counter
Restart=always
User=tyler

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable mallard-counter
sudo systemctl start mallard-counter
sudo journalctl -u mallard-counter -f
```
