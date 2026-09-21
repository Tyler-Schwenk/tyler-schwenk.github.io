# Hardware and Network Configuration

## Hardware Specifications

### Device
- **Model**: Raspberry Pi 5
- **Power Supply**: Official Raspberry Pi 5 USB-C (5V 5A)
- **Storage**: MicroSD card with Raspberry Pi OS (64-bit); external USB SSD for media (see [External SSD](#external-ssd-media-storage))
- **Operation Mode**: Headless (no monitor)

### Boot Behavior
- Green ACT LED flickers heavily during boot
- Occasional flicker during normal operation
- Power cycle: unplug USB-C, wait 5 seconds, reconnect

## Network Configuration

### Local Network Details
- **Subnet**: 192.168.1.0/24
- **Router**: 192.168.1.254
- **Default Gateway**: 192.168.1.254

### Ethernet Interface (eth0)
- **MAC Address**: 88:a2:9e:09:3b:ea
- **IP Address**: 192.168.1.116 (DHCP)
- **Speed**: 1000 Mbps Full Duplex
- **Stability**: Most stable, preferred for heavy workloads

### Wi-Fi Interface (wlan0)
- **MAC Address**: 88:a2:9e:09:3b:eb
- **IP Address**: DHCP-assigned, drifts over time (192.168.1.167 at last check)
- **SSID**: what is joel's favorite snack
- **Frequency**: 5 GHz (5240 MHz)
- **Signal Strength**: Excellent (-18 dBm)
- **Stability**: Fully functional, suitable for normal development

### Interface Behavior
When both interfaces are connected:
- Ethernet (eth0) typically becomes primary route
- Wi-Fi (wlan0) remains active as backup

## System Identity

- **Hostname**: fart-pi
- **Primary User**: tyler
- **OS**: Raspberry Pi OS (64-bit)
- **SSH**: Enabled with password authentication

## Access Methods

### Local SSH Access
SSH only works from the home network (192.168.1.0/24).

Primary (Ethernet, DHCP lease that has stayed at .116):
```bash
ssh tyler@192.168.1.116
```

Alternate (Wi-Fi, address drifts - run `ip -4 -br addr` on the Pi or check the router for the current one):
```bash
ssh tyler@192.168.1.167
```

### Remote Access (off the home network)
SSH and the private service ports (8000, 8090) are not reachable from outside the LAN. **Raspberry Pi Connect** is the way in from anywhere:
- URL: https://connect.raspberrypi.com
- Device Name: fart-pi
- Capabilities: Remote terminal and remote desktop

## Network Diagnostics

### Check Network Interfaces
```bash
ip a
```

### Check Wi-Fi Status
```bash
iw dev wlan0 link
```

### Check Routing Table
```bash
ip route
```

### Verify SSH Sessions
```bash
ss -tnp | grep ssh
```

### Test Connectivity
```bash
ping 192.168.1.116
```

## Recommended Improvements

Future network enhancements:
- Static DHCP reservation on the router for consistent Ethernet and Wi-Fi IPs
- SSH key authentication instead of password

## Current Network Services

### DNS Configuration
- **Managed by**: NetworkManager (`/etc/resolv.conf` is generated, don't edit it by hand)
- **Nameserver**: router at 192.168.1.254 (plus the router's IPv6 address)
- **Search Domain**: attlocal.net

## External SSD (media storage)

All media (photos, videos, recipe photos) and the website-backend SQLite database live on a 500 GB USB SSD, mounted at `/mnt/ssd`. The SD card holds the OS, Docker, this repo, and small per-service state (for example Beszel's `./data`).

| Partition | Filesystem | Use |
|---|---|---|
| `/dev/sda2` | ext4, label `fartdata`, ~268 GB usable | mounted at `/mnt/ssd` |
| `/dev/sda1` | NTFS, 193 GB, corrupt MFT | unused, never mounted |

`sda1` is left untouched on purpose: Linux can't read it (`$MFTMirr does not match $MFT`). If you ever want to check it for data, plug the SSD into Windows and run `chkdsk /f`.

### Layout

```
/mnt/ssd/
├── db/               # website-backend sqlite database (website_backend.db)
├── public-gallery/   # website photo galleries (+ thumbnails/ per gallery)
├── videos/           # website videos (+ thumbnails/)
├── recipe-photos/    # The Kitchen photos
└── photos/           # Immich library (not deployed yet)
```

Compose files read these locations from variables, so each path is defined in one place per service: `MEDIA_ROOT` (website-backend media, default `/mnt/ssd`), `DB_DIR` (website-backend database, default `/mnt/ssd/db`), and `UPLOAD_LOCATION` (Immich `.env`).

### Mount configuration

`/etc/fstab`:
```
UUID=4a936e8f-d789-4a00-80b9-93e5a82a8302 /mnt/ssd ext4 defaults,noatime,nofail 0 2
```

- Mounted by UUID, not `/dev/sdX`, so it survives device renaming.
- `nofail` so a missing or dead drive doesn't hang boot.
- The empty `/mnt/ssd` directory on the SD card is marked immutable (`chattr +i`). If the SSD isn't mounted, nothing can create files under that path, so a container fails to start ("bind source path does not exist") instead of silently filling the SD card.
- `/etc/systemd/system/docker.service.d/wait-for-ssd.conf` orders Docker after `mnt-ssd.mount` (`After=` + `Wants=`, not `Requires=`, so a dead SSD only takes down the containers that need it).

### Health checks

```bash
findmnt /mnt/ssd           # should show /dev/sda2 ext4
df -h /mnt/ssd             # free space
sudo findmnt --verify      # fstab sanity check
sudo dmesg | grep -i sda   # kernel errors for the drive
```

### If the SSD is missing or unmounted

1. Check the USB cable, then `lsblk -f` to confirm `sda2` shows up.
2. `sudo mount /mnt/ssd`
3. `cd ~/tyler-schwenk.github.io/pi/services/website-backend && docker compose up -d`

Don't delete or recreate the immutable mount-point directory unless you're replacing the drive.

### Replacing the drive

1. Format the new partition as ext4: `sudo mkfs.ext4 -m 1 -L fartdata /dev/sdXN`
2. Get its UUID with `sudo blkid` and update the `/etc/fstab` line.
3. `sudo mount /mnt/ssd`, then copy data over with `sudo rsync -aHAX old-source/ /mnt/ssd/` (preserves ownership and permissions).
4. `docker compose up -d` in each service.

## GPIO Pin Usage

Full map of physical pins in use. Check here before wiring anything new.

| Physical Pin | GPIO | Function | Used by |
|---|---|---|---|
| 1 | 3.3V | Power | OLED display (VCC) |
| 2 | 5V | Power | I2S amps (VIN via breadboard + rail) |
| 3 | GPIO 2 | I2C SDA | OLED display |
| 5 | GPIO 3 | I2C SCL | OLED display |
| 6 | GND | Ground | OLED display (GND) |
| 9 | GND | Ground | I2S amps (GND via breadboard - rail) |
| 11 | GPIO 17 | Input (pull-up) | Trash reminder button |
| 12 | GPIO 18 | I2S BCLK | Both MAX98357A amps |
| 35 | GPIO 19 | I2S LRCLK | Both MAX98357A amps |
| 40 | GPIO 21 | I2S DOUT | Both MAX98357A amps |

### Connected peripherals

**OLED display** (Adafruit SSD1306, 128x64, I2C)
- Bus: I2C, address `0x3C`
- Pins: 1, 3, 5, 6
- Service: mallard-counter (systemd)

**Button** (momentary pushbutton)
- Pin: 11 (GPIO 17) → one leg of button
- Other leg of button → GND rail on breadboard
- Pull-up: internal (software configured)
- Service: trash-reminder (systemd)

**Stereo audio** (2x Adafruit MAX98357A I2S amp + 8 ohm 5W speakers)
- Bus: I2S
- Service: trash-reminder (systemd)
- Both amps share all three I2S signal lines in parallel

| Pi physical pin | Pi GPIO | Amp pin | Notes |
|---|---|---|---|
| 2 | 5V | VIN | both amps share 5V rail |
| 9 | GND | GND | both amps share GND rail |
| 12 | GPIO 18 | BCLK | both amps |
| 35 | GPIO 19 | LRC | both amps |
| 40 | GPIO 21 | DIN | both amps |

Channel select (SD pin on each amp):
- Left amp SD → 5V rail (selects left channel)
- Right amp SD → GND rail (selects right channel)

## Status

All systems operational and verified working:
- Boot from SD card
- SSH over Wi-Fi
- SSH over Ethernet
- Raspberry Pi Connect remote terminal
- Raspberry Pi Connect remote desktop
- Headless operation
