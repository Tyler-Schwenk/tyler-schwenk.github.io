# Cast Receiver (castpi)

The TV in the opium den. A Raspberry Pi 3B+ behind it acts as an AirPlay receiver: on
an iPhone, open Control Center, tap **Screen Mirroring**, and pick **Opium Den TV**. The
phone's screen and audio play on the TV over HDMI. When nobody's casting, the TV shows a
status splash screen.

This handles iPhones (and Macs) only. Android's casting (Google Cast) is proprietary
and has no open-source receiver.

It gets unplugged a lot, so it's built for that. Pulling the power at any moment is safe,
and it comes back on its own when power returns. It also notices when the TV's HDMI
cable is plugged in or swapped, in any order.

## Hardware

- **Device**: Raspberry Pi 3 Model B+ (1 GB RAM), hostname `castpi`. This is the same
  board that used to be the display kiosk, before that moved to displaytop
- **Output**: HDMI to the TV, video and audio
- **Network**: Wi-Fi on the home network (5 GHz), `192.168.1.114` (reserved in the
  router against the Wi-Fi MAC `b8:27:eb:71:26:18`, step 4 below). Ethernet has its own
  MAC (`b8:27:eb:24:73:4d`) and gets a different address, so a reservation for one
  doesn't cover the other. The splash screen always shows the current address
- **OS**: Raspberry Pi OS Lite (Debian 13 trixie, 64-bit), no desktop
- **Access**: user `tyler`, SSH key auth only (same key as fart-pi),
  `ssh tyler@castpi.local` (works whatever the address) or `ssh tyler@192.168.1.114`.
  Passwordless sudo. Home LAN only

## How It Works

- **[UxPlay](https://github.com/FDH2/UxPlay)** (Debian package `uxplay`) is an
  open-source AirPlay mirroring server. It runs as the systemd service `uxplay.service`
  under user `tyler`, starts on boot, and restarts if it ever exits
- **Discovery**: avahi advertises the receiver over mDNS as `_airplay._tcp` and
  `_raop._tcp`. This is how iPhones find it, so the phone has to be on the same network
  (`192.168.1.0/24`). Guest Wi-Fi networks usually block mDNS
- **Video**: the iPhone streams H.264, decoded on the Pi's hardware decoder
  (`-vd v4l2h264dec`), since the Pi 3's CPU can't keep up in software. `-vs kmssink`
  draws the decoder's output straight to HDMI through DRM/KMS on an overlay plane,
  scaled in hardware, with no X or Wayland. UxPlay asks the phone for 1920x1080 at up
  to 30 fps. Two flags matter on a Pi 3:
  - **`-bt709`**: iPhones tag the stream as full-range color (`colorimetry=1:3:7:1`),
    which the Pi's decoder rejects with `not-negotiated`. The video pipeline dies and
    the phone disconnects right after connecting. This flag relabels the stream as plain bt709
  - **`-vc identity`** (no converter): UxPlay's `-v4l2` shortcut puts `v4l2convert`
    (the Pi's ISP, `/dev/video12`) between decoder and screen. It fails with
    `S_FMT failed` whenever the video size changes mid-stream, which happens every time
    the phone rotates. The decoder's output goes to kmssink directly instead
- **Crash recovery**: `Restart=always` with `RestartSec=1`, so if UxPlay dies mid-cast,
  it's back in about a second and the phone can reconnect
- **Audio**: AAC from the phone, decoded by `gstreamer1.0-libav` and played on
  `hdmi:CARD=vc4hdmi,DEV=0`. Use the `hdmi:` alias, not `hw:`, because it adds the
  IEC958 conversion the vc4 HDMI driver needs
- **Takeover**: `-nohold` means a new phone that connects bumps whoever is casting,
  rather than getting refused
- **Clean console**: tty1 has no getty (masked) and no kernel console, and the cursor
  and boot logos are off (`/boot/firmware/cmdline.txt`), so nothing but the splash and
  casts ever draws on the TV

Current service command (written by the setup script):

```
uxplay -n "Opium Den TV" -nh -vd v4l2h264dec -vc identity -bt709 -vs kmssink -as "alsasink device=hdmi:CARD=vc4hdmi,DEV=0" -nohold
```

### Idle splash screen

`castpi-splash.service` runs `/usr/local/bin/castpi_splash.py` (source:
`pi/services/cast-receiver/castpi_splash.py`). It draws a status screen straight into
the Linux framebuffer (`/dev/fb0`, RGB565 at 1920x1080), using Pillow and DejaVu fonts. kmssink
draws video on an overlay plane above the framebuffer, so the splash sits underneath
casts. Every 2 seconds it checks status, and redraws only when something on screen changed.
It shows:

- **Status**: "Ready to cast" (green) when UxPlay is running, "Waiting for the TV" or
  "Receiver starting (state)" (yellow) otherwise
- How to connect from an iPhone
- Wi-Fi network and signal, hostname, and IP addresses
- **Receiver restarts since boot**: systemd's `NRestarts` for `uxplay.service`. If this
  climbs, UxPlay is crashing (it resets on reboot)
- The date and time

While a phone is mirroring (UxPlay has an established TCP connection), the splash
blanks to black so it doesn't show beside portrait video.

### HDMI detection

kmssink opens the display once, when UxPlay starts, and holds it from then on. So
UxPlay has to start after a screen is connected, and restart when a new one appears.
`/usr/local/bin/castpi-hdmi.sh` (source: `pi/services/cast-receiver/castpi-hdmi.sh`)
handles both:

- **`wait`** (the service's `ExecStartPre`) holds UxPlay in `activating` until a
  connector in `/sys/class/drm/card*-HDMI-A-*/status` reads `connected`. With no TV,
  the receiver doesn't show up on phones, since there'd be nothing to show the cast on
- **`hotplug`** is run on every DRM change event by the udev rule
  `/etc/udev/rules.d/90-castpi-hdmi.rules`, through `systemd-run` because udev kills
  long-running handlers. It waits 2 s for the kernel to read the new screen's EDID. If a
  screen is now connected, UxPlay is running, and it started before the event, it
  restarts UxPlay. It never restarts mid-cast (an established UxPlay TCP connection),
  so a TV that flickers its HDMI signal when switching inputs doesn't drop the cast.
  Unplugs are ignored: UxPlay keeps working when the same screen comes back

The kernel command line has `video=HDMI-A-1:1920x1080@60`. That makes 1080p60 the
preferred mode whenever the TV offers it, which is all a Pi 3 can decode anyway. It has no
trailing `D`, which would force the port on and stop the Pi from detecting screens.

### Power loss

- **Read-only SD card**: the root filesystem is an overlay (`overlayroot=tmpfs` on the
  kernel command line, set by `raspi-config nonint enable_overlayfs`). Reads come from
  the card, and all writes go to RAM and vanish on reboot. `/boot/firmware` is mounted
  read-only from `/etc/fstab`. Nothing writes to the card, so pulling the plug can't
  corrupt it, and every boot starts from the same known-good state
- **Comes back by itself**: the Pi powers on whenever it gets power (there's no power
  button), and UxPlay is enabled at boot. Boot to "visible on phones" takes about 30 seconds
- **Wi-Fi retries forever**: `connection.autoconnect-retries 0` on the Wi-Fi connection.
  NetworkManager's default gives up after 4 tries, and after a power cut the router takes
  minutes to boot, longer than the Pi
- **Hangs reboot themselves**: Pi OS's systemd feeds the hardware watchdog
  (`RuntimeWatchdogUSec=1min`), so a frozen Pi resets within a minute
- **Logs are in RAM only** (`Storage=volatile`, capped at 30 MB), so they're lost on
  every reboot. To catch a problem, look at `journalctl` before restarting

## Setting Up From Scratch

`pi/services/cast-receiver/setup-castpi.sh` does everything except flashing and Wi-Fi.
It's idempotent and safe to re-run. It also removes what's left of the old display
kiosk (autologin, X, Chromium, mpv) if any of it is still there. Its last step turns on
the read-only SD card, so see "Making Changes" before re-running it later.

### 1. Flash the SD card

In Raspberry Pi Imager, choose **Raspberry Pi OS Lite (64-bit)**. In its OS
customisation settings, set the hostname to `castpi`, the user to `tyler`, enable SSH
with your public key, and enter the home Wi-Fi name and password. With Wi-Fi set in
Imager, the Pi joins the network on first boot and step 2 isn't needed.

### 2. Wi-Fi (only if Imager didn't set it, or the network changed)

Over Ethernet, or at the Pi with a keyboard (Ctrl+Alt+F2 gives a login prompt, since
tty1 has none):

```bash
sudo nmcli con add type wifi ifname wlan0 con-name home-wifi ssid "YourNetworkName" \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "YourPassword" \
  connection.autoconnect yes connection.autoconnect-retries 0
sudo nmcli con up home-wifi
ip -br a     # wlan0 should show UP with a 192.168.1.x address
```

If the SD card is read-only at this point, this won't survive a reboot. Do it as part of
"Making Changes" below.

### 3. Run the setup script (from the repo root on the Windows PC)

```bash
scp -r pi/services/cast-receiver tyler@<pi-ip>:~/
ssh -t tyler@<pi-ip> "sudo ~/cast-receiver/setup-castpi.sh"
ssh tyler@<pi-ip> "rm -rf ~/cast-receiver && sudo reboot"
```

The script sets up passwordless sudo, sets the hostname (and tells cloud-init to keep
it), removes the old kiosk, and installs UxPlay and the GStreamer plugins. It also quiets
the console, sets up HDMI detection, turns off Wi-Fi power saving, and makes Wi-Fi retry
forever. Then it writes and enables `uxplay.service` and `castpi-splash.service`, switches SSH to keys only once a
key is installed, moves the journal to RAM, and turns on the read-only SD card (from the
next boot).

### 4. Router: reserve the address

This makes the router always hand the Pi the same address (matched by its Wi-Fi MAC),
so SSH and these docs keep working.

1. On a computer or phone on the home network, open `http://192.168.1.254` in a
   browser. That's the AT&T gateway's admin page
2. Click **Home Network** in the top menu, then **IP Allocation** in the left sidebar.
   It lists every device on the network
3. It asks for the **Device Access Code**, printed on the sticker on the side or bottom
   of the gateway (not the Wi-Fi password)
4. Find the Pi's **Wi-Fi** entry: MAC `b8:27:eb:71:26:18`, shown as `castpi` (or
   `displaypi` until its lease renews). Not `b8:27:eb:24:73:4d`, which is the Ethernet
   port. The Pi can appear twice if it has ever been on both. Click **Allocate**
5. In the dropdown, pick **Private fixed: 192.168.1.114** (or any free address, then
   update this doc and `CLAUDE.md`), and click **Save**
6. Unplug and replug the Pi so it picks up the reserved address

### 5. Check it worked

```bash
ssh tyler@castpi.local '
  systemctl is-active uxplay castpi-splash            # active active (activating = no screen on hdmi)
  avahi-browse -rpt _airplay._tcp | grep "Opium"      # advertised on wlan0
  findmnt -no FSTYPE /                                # overlay (read-only card is on)
  journalctl -u uxplay -n 20 --no-pager
'
```

The TV should show the splash with "Ready to cast". Then mirror from an iPhone. The TV
should show the phone's screen within a couple of seconds and play its audio, and it
should keep going when the phone rotates.

## Making Changes

Anything changed on the running Pi is lost on the next reboot, because the SD card is
read-only. To make a lasting change:

```bash
ssh tyler@castpi.local "sudo raspi-config nonint disable_overlayfs && sudo reboot"
# wait ~30 s; the card is writable now. make the change, or re-run the setup script
# (step 3), which turns read-only back on. if you didn't run the script:
ssh tyler@castpi.local "sudo raspi-config nonint enable_overlayfs && sudo reboot"
```

`/boot/firmware` stays read-only either way (from `/etc/fstab`). The setup script
remounts it writable for its own run. To edit something there by hand, run
`sudo mount -o remount,rw /boot/firmware` first.

Things you might change:

- **Receiver name**: change `AIRPLAY_NAME` in `setup-castpi.sh` and re-run it
- **Require a PIN**: add `-pin` to `ExecStart` in the script. The TV shows a 4-digit
  code the phone has to enter. Not used now because only people on the home network can see it
- **Wi-Fi moved**: redo step 2 with the new network, then step 4 on the new router
- **Software updates**: `sudo apt-get update && sudo apt-get upgrade` while the card is
  writable. With read-only on, nothing updates. That's fine for a LAN-only receiver,
  but it's worth doing once in a while

## Troubleshooting

- **"Opium Den TV" isn't in the iPhone's list**: check the phone is on the home Wi-Fi
  (not cellular, guest, or a VPN). Then `systemctl status uxplay avahi-daemon`.
  `activating` with "waiting for one before starting uxplay" in the log means the Pi
  doesn't see a screen: check the HDMI cable and that the TV is on, and look at
  `cat /sys/class/drm/card0-HDMI-A-1/status`. After a power cut, give it about 30 seconds
  (longer if the router is still booting)
- **Look at the splash first**: it shows whether the receiver is ready, the Pi's
  address, the Wi-Fi signal, and a restart counter that climbs if UxPlay keeps crashing
- **Phone connects, then disconnects right away / audio but no video**: the video
  pipeline is failing. UxPlay's normal log doesn't show GStreamer errors, so run it by
  hand with them on (the service has to be stopped, since only one can hold the display):

  ```bash
  sudo systemctl stop uxplay
  GST_DEBUG=2 uxplay -n "Opium Den TV" -nh -vd v4l2h264dec -vc identity -bt709 -vs kmssink \
    -as "alsasink device=hdmi:CARD=vc4hdmi,DEV=0" -nohold 2>&1 | grep -E "ERROR|error:"
  # cast from a phone, then Ctrl+C and: sudo systemctl start uxplay
  ```

  `not-negotiated` means the decoder rejected the stream's format (that's what `-bt709`
  fixes). `S_FMT failed` from `v4l2convert` means a converter got into the pipeline
  (that's what `-vc identity` avoids). Add `-d` for UxPlay's own connection log.
  Harmless noise: "Dropping frame due to QoS", "Failed to probe pixel aspect ratio",
  kmsbufferpool size warnings, and an alsalib "DEV must be an integer" line
- **TV swapped but the picture is wrong or missing**: the hotplug handler restarts UxPlay
  when a screen connects, but not mid-cast. Stop mirroring and start again, or run
  `sudo systemctl restart uxplay`
- **Video doesn't fill the screen**: kmssink uses the display mode the kernel set from
  the TV's EDID. Check `cat /sys/class/drm/card0-HDMI-A-1/modes` and the `video=`
  argument in `cmdline.txt`
- **No sound**: `aplay -l` should list `vc4hdmi`. Test with
  `speaker-test -D hdmi:CARD=vc4hdmi,DEV=0 -c 2 -t sine -l 1`. Check the TV isn't muted
  and its audio input is HDMI
- **Stutter**: usually Wi-Fi. `nmcli -f IN-USE,SSID,CHAN,SIGNAL dev wifi` shows the
  signal. It should be on 5 GHz with a strong signal. Ethernet fixes it if a cable can reach
- **Someone's stuck connected**: casting from another phone takes over (`-nohold`), or run
  `sudo systemctl restart uxplay`
- **Splash missing (TV black while idle)**: `systemctl status castpi-splash` and
  `journalctl -u castpi-splash -n 20`. It logs why it couldn't draw and retries
- **Random reboots or slowness**: `vcgencmd get_throttled` shows power and heat
  problems since boot. `0x50000` or `0x50005` means undervoltage, so use the official
  2.5 A supply. `0x80000` means it got warm enough to throttle a little, which is harmless
