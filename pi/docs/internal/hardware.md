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

## Status

All systems operational and verified working:
- Boot from SD card
- SSH over Wi-Fi
- SSH over Ethernet
- Raspberry Pi Connect remote terminal
- Raspberry Pi Connect remote desktop
- Headless operation
