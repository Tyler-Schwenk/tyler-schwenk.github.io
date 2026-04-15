# Raspberry Pi 5 System Setup Document

## Overview

This document describes the configuration and network environment of a Raspberry Pi 5 system named **fart-pi**. The device is configured for headless operation and is accessible remotely via SSH and Raspberry Pi Connect.

The system is fully operational and reachable over both Ethernet and Wi-Fi.

---

## Hardware

Device:
- Raspberry Pi 5

Power Supply:
- Official Raspberry Pi 5 USB-C power supply (5V 5A)

Storage:
- MicroSD card
- OS installed via Raspberry Pi Imager

Display:
- Headless (no monitor required)

---

## Operating System

Installed Using:
- Raspberry Pi Imager

OS:
- Raspberry Pi OS (64-bit)

SSH:
- Enabled
- Password authentication enabled

Hostname:

```
fart-pi
```

Primary User:

```
tyler
```

---

## Network Configuration

### Local Network

Subnet:

```
192.168.1.0/24
```

Router:

```
192.168.1.254
```

---

### Ethernet Interface

Interface:

```
eth0
```

MAC Address:

```
88:a2:9e:09:3b:ea
```

IP Address (DHCP):

```
192.168.1.116
```

Speed:

```
1000 Mbps Full Duplex
```

---

### Wi-Fi Interface

Interface:

```
wlan0
```

MAC Address:

```
88:a2:9e:09:3b:eb
```

IP Address (DHCP):

```
192.168.1.115
```

SSID:

```
ATTCCfsuMU
```

Frequency:

```
5 GHz (5320 MHz)
```

Signal Strength:

```
~ -71 dBm
```

---

## Access Methods

### Local Network SSH

Primary connection method:

```
ssh tyler@192.168.1.115
```

Alternate (Ethernet):

```
ssh tyler@192.168.1.116
```

---

## Remote Access (Outside Home Network)

Configured:

- Raspberry Pi Connect enabled

Access URL:

```
https://connect.raspberrypi.com
```

Device Name:

```
fart-pi
```

Capabilities:

- Remote terminal
- Remote desktop

---

## Network Behavior

When both interfaces are connected:

- Ethernet (eth0) typically becomes primary route
- Wi-Fi (wlan0) remains active as backup

Default Gateway:

```
192.168.1.254
```

---

## Useful Commands

### Check Network Interfaces

```
ip a
```

### Check Wi-Fi Status

```
iw dev wlan0 link
```

### Check Routing

```
ip route
```

### Verify SSH Sessions

```
ss -tnp | grep ssh
```

---

## Boot Behavior

Normal boot LED behavior:

- Green ACT LED flickers heavily during boot
- Then occasional flicker during operation

Power cycling procedure:

1. Unplug USB-C power
2. Wait 5 seconds
3. Reconnect power

---

## Known Working Configuration

Confirmed Working:

- Boot from SD card
- SSH over Wi-Fi
- SSH over Ethernet
- Raspberry Pi Connect remote terminal
- Raspberry Pi Connect remote desktop

---

## Intended Usage

Primary usage:

- Headless development machine
- Remote-accessible compute node
- SSH-based development
- Docker workloads (planned)

---

## Stability Notes

Ethernet:

- Most stable
- Preferred for heavy workloads

Wi-Fi:

- Fully functional
- Suitable for normal development

---

## Recommended Future Improvements

Suggested upgrades:

- Static DHCP reservation for Wi-Fi IP
- NetBird installation for reliable remote SSH
- Automatic updates configuration
- SSH key authentication

---

## Verification Commands

Test SSH:

```
ssh tyler@192.168.1.115
```

Test connectivity:

```
ping 192.168.1.115
```

---

## System Identity Summary

Hostname:

```
fart-pi
```

Primary User:

```
tyler
```

Wi-Fi IP:

```
192.168.1.115
```

Ethernet IP:

```
192.168.1.116
```

Router:

```
192.168.1.254
```

---

## Status

System Status:

```
Operational
```

Remote Access:

```
Verified Working
```

Headless Operation:

```
Verified Working
```

---

End of Document