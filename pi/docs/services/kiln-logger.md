# Kiln Logger

Logs kiln temperature during firings. castpi reads a thermocouple and sends every reading
to fart-pi, which stores it. castpi does no processing, so it can lose power at any time.
Plug it in and it starts logging by itself.

```
Type K probe -> MAX31856 amp -> castpi (kiln-logger.service) -> Wi-Fi -> fart-pi backend (SQLite)
```

The readings end up on the public kiln page, `tyler-schwenk.com/kiln` (see
[`website/docs/KILN.md`](../../../website/docs/KILN.md)).

## Hardware

- **Thermocouple**: Type K probe, in a mini Type K panel socket, joined to the amp with Type K
  wire (yellow is +, red is -)
- **Amp**: Adafruit MAX31856
- **Logger**: castpi, the Raspberry Pi 3B+ from [Cast Receiver](cast-receiver.md). The AirPlay
  services stay installed, and wait harmlessly when there's no screen

| MAX31856 | Pi pin | Pi function |
|---|---|---|
| Vin | 1 | 3.3V |
| GND | 6 | GND |
| SCK | 23 | GPIO11, SPI clock |
| SDI | 19 | GPIO10, MOSI |
| SDO | 21 | GPIO9, MISO |
| CS | 29 | GPIO5, chip select |

3Vo, DRDY and FLT aren't connected. Pins 2 and 4 are 5V, so keep them clear of the amp.

## How It Works

`kiln-logger.service` runs `/usr/local/bin/kiln_logger.py` (source:
`pi/services/kiln-logger/kiln_logger.py`). It takes a reading every 5 s and queues it in
memory, and a second thread sends the queue to fart-pi. Readings only leave the queue once
fart-pi confirms them.

- **Timestamps**: a Pi 3 has no real-time clock and boots with the wrong date, so readings
  have none. Each carries its age when sent (`age_s`, from the monotonic clock), and the
  backend works out `recorded_at` from that. A reading sent after an outage still gets the right time
- **Retries**: `boot_id` plus `seq` identify a reading, so a batch that got stored but whose
  reply was lost can be sent again without creating duplicates
- **Why the LAN address**: it sends to `http://192.168.1.116:8000`, not
  `api.tyler-schwenk.com`. Logging keeps working with the internet down, and TLS would fail
  while the clock's wrong. The token does cross the home LAN unencrypted
- **Faults**: `thermocouple_c` is null whenever the amp's fault register is nonzero, since the
  value is junk then (no probe reads as 1372 C). `fault_status` keeps the raw register. Bit 0x01
  means an open circuit, usually an unplugged probe
- **Amp resets**: the amp's settings are checked before every reading and rewritten if they're
  gone. A failed read skips that sample and keeps going

### Power and network loss

Setup leaves the SD card read-only, as described in [Cast Receiver](cast-receiver.md), so
pulling the plug can't corrupt it.

- **Plug in and go**: the service starts at boot with no network dependency, and systemd
  restarts it forever if it exits
- **Wi-Fi or fart-pi down**: readings wait in memory, up to a week's worth, then go out in
  batches of 500 when the connection's back
- **What can be lost**: readings not yet sent when castpi loses power, because the queue is in
  RAM. Normally that's the last 5 s or so. During an outage it's everything since the outage began
- **Undervoltage**: castpi has reported undervoltage on its current supply, which can cause
  reboots. Check `vcgencmd get_throttled` (`0x50005` means undervoltage)

## Data

Everything's in the backend's SQLite database, and nothing gets deleted:

- **`kiln_readings`**: every raw reading, one row each, 17,280 rows per day of logging. This is the
  permanent record. Graphs are drawn from it, so there are no saved images, and later analysis can
  use the full data
- **`kiln_firings`**: one row per firing, a time range plus its peak

### Firing detection

`app/kiln_firings.py` works out firings as readings arrive, so nothing needs starting or stopping.
A firing takes about a day to heat and up to a day to cool, the probe usually gets pulled around
400 F, and the next firing is at least a few days later, so time is the main signal:

- **Starts** at the first reading at or above 150 F. Hot readings from the 48 hours before that count too
- **Same firing** for any reading within 48 hours of its last one. A hot reading (150 F or more) in
  that window reopens a firing marked finished, so a re-plugged probe or a long outage doesn't split it
- **Finishes after 6 hours with no temperature**, at its last real reading. That covers the normal
  ending, the probe getting pulled during cooldown, and needs no cold reading
- **Also finishes** at the first reading below 120 F, if the probe stays in all the way down
- **New firing** needs a reading at or above 150 F, more than 48 hours after the last firing's last reading
- Faults don't start or end anything, and neither does the logger rebooting

So after the probe's pulled, the page shows that firing as in progress for up to 6 more hours.

Storing readings needs the `KILN_TOKEN` shared secret, and raw readings need an admin login. Status
and firings are public. See [the API docs](../api/website-backend-api.md#kiln).

## Setup

Needs castpi already set up (see [Cast Receiver](cast-receiver.md)), the amp wired, and fart-pi's
backend running with `KILN_TOKEN` set in its `.env` (`openssl rand -hex 32`).

Run these from the repo root on the Windows PC. Replace `<castpi>` with its address, and run them
one at a time, waiting about a minute after each reboot:

```bash
# 1. make the sd card writable
ssh tyler@<castpi> "sudo raspi-config nonint disable_overlayfs && sudo reboot"

# 2. copy the token across, without it showing up in a command line
ssh tyler@192.168.1.116 "grep '^KILN_TOKEN=' ~/tyler-schwenk.github.io/pi/services/website-backend/.env | cut -d= -f2" \
  | ssh tyler@<castpi> "sudo install -d -m 755 /etc/kiln-logger && sudo tee /etc/kiln-logger/token >/dev/null"

# 3. install it (this makes the card read-only again, from the next boot)
scp -r pi/services/kiln-logger tyler@<castpi>:~/
ssh tyler@<castpi> "sudo ~/kiln-logger/setup-kiln-logger.sh"
ssh tyler@<castpi> "rm -rf ~/kiln-logger && sudo reboot"
```

`setup-kiln-logger.sh` is idempotent. It installs `python3-spidev`, turns SPI on with
`dtoverlay=spi0-1cs,cs0_pin=5` in `config.txt`, installs and enables the service, and turns
read-only mode back on. To change anything later, start again from step 1.

## Checking It

```bash
ssh tyler@<castpi> "systemctl is-active kiln-logger; journalctl -u kiln-logger -n 20 --no-pager"
ssh tyler@192.168.1.116 "sudo sqlite3 /mnt/ssd/db/website_backend.db \
  'select * from kiln_readings order by recorded_at desc limit 5'"
```

Logs are in RAM, so they're gone after a reboot. While running, the logger logs a line every 5 minutes.

## Troubleshooting

- **`can't send to ...: HTTP Error 401`**: `/etc/kiln-logger/token` doesn't match `KILN_TOKEN` in
  the backend's `.env`
- **`HTTP Error 503`**: `KILN_TOKEN` isn't set on the backend. Set it, then run `docker compose up -d`
- **`can't read the amp`, or `didn't keep its config`**: the amp's wiring or power. Check the
  table above
- **Fault register 0x01**: the probe's unplugged or broken, or the wire to the socket is loose
- **Temperature drops as the kiln heats**: the yellow and red wires are swapped at the amp
- **Can't find castpi**: it may not be at its usual address. Check the router, or run
  `ip neigh | grep b8:27:eb` on fart-pi after pinging the subnet
