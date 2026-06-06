# Hardware and Network Configuration

## Hardware Specifications

### Device
- **Model**: Raspberry Pi 5
- **Power Supply**: Official Raspberry Pi 5 USB-C (5V 5A)
- **Storage**: MicroSD card with Raspberry Pi OS (64-bit)
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
- **IP Address**: 192.168.1.115 (DHCP)
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
Primary (Wi-Fi):
```bash
ssh tyler@192.168.1.115
```

Alternate (Ethernet):
```bash
ssh tyler@192.168.1.116
```

### Remote Access
**Raspberry Pi Connect** is configured for remote access from anywhere:
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
ping 192.168.1.115
```

## Recommended Improvements

Future network enhancements:
- Static DHCP reservation for consistent Wi-Fi IP
- SSH key authentication instead of password

## Current Network Services

### NetBird VPN
- **Status**: Active (system service)
- **NetBird IP**: 100.124.76.27/16
- **FQDN**: fart-pi.johnserv.garrepi.dev
- **Interface**: wt0 (WireGuard kernel)
- **Network**: Bird Wide Web (self-hosted by John)
- **Management**: https://johnserv.garrepi.dev

### DNS Configuration
- **Primary**: NetBird DNS (100.124.76.27) - unreachable locally due to WireGuard limitation
- **Fallback**: 8.8.8.8 (Google), 1.1.1.1 (Cloudflare) - automatically added on NetBird restart
- **Automation**: Systemd override runs /usr/local/bin/netbird-dns-fix.sh after NetBird starts
- **Search Domains**: johnserv.garrepi.dev, attlocal.net
- **Original Router DNS**: 192.168.1.254 (backed up in /etc/resolv.conf.original.netbird)
- Automatic system updates configuration

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
