# Display Kiosk (displaytop)

An always-on pair of screens, powered off the home solar battery setup, that show a
rotating set of panels (photos, mallard count, live surf cams, and more planned). Driven
by a dedicated laptop running kiosk browsers pointed at
`https://tyler-schwenk.com/display` — a page on the main website (see
`website/docs/DISPLAY.md`), not a separate app.

## Hardware

- **Device**: Surface Laptop 3 (Intel Core i5-1035G7, Iris Plus graphics, 8 GB RAM,
  128 GB SSD), run lid-closed and plugged in. Hostname `displaytop`
- **Screens**: its built-in 2256x1504 panel plus an external monitor on the USB-C port
  through a USB-C to HDMI adapter
- **Network**: Wi-Fi (Intel AX201), `192.168.1.192`. Set a DHCP reservation in the
  router so the address doesn't drift. The laptop has no Ethernet port
- **OS**: Ubuntu Server 26.04 LTS (no desktop environment)
- **Access**: user `tyler`, SSH key auth (same key as fart-pi) — `ssh tyler@192.168.1.192`.
  Passwordless sudo (`/etc/sudoers.d/tyler-nopasswd`) so the kiosk can be maintained
  remotely without a keyboard. Home LAN only, same subnet as fart-pi

## Kiosk Software Stack

Minimal X setup — just enough to run full-screen browsers:

- `xserver-xorg`, `xinit`, `openbox` (window manager), `x11-xserver-utils`, `unclutter`
  (hides the mouse cursor), Google Chrome (from Google's `.deb`, since Ubuntu ships
  Chromium only as a snap), `mpv` (surf cams), `intel-media-va-driver` and `vainfo`
  (hardware video decode), `fonts-noto-color-emoji`, `scrot` (screenshots), `iw`

**Boot flow** (nothing needs doing after a power loss, it all starts by itself):
1. `/etc/systemd/system/getty@tty1.service.d/autologin.conf` — autologin as `tyler` on
   tty1
2. `~/.bash_profile` — on tty1 login with no `$DISPLAY`, runs `startx`
3. `~/.xinitrc` — execs `openbox-session`
4. `~/.config/openbox/autostart` — disables screen blanking/DPMS, starts `unclutter`,
   then launches `~/kiosk-run.sh` in the background
5. `~/kiosk-run.sh` (from `pi/services/display-kiosk/kiosk-run.sh`) — starts the surfcam
   agent (restarted if it dies, logging to `/tmp/surfcam-agent.log`), then loops: lay
   out the screens, clear each browser's disk cache, launch one browser per screen in
   `--kiosk` mode on the display page, relaunch after a 5s pause if any exits or
   crashes. Also handles the overnight sleep window (below)

### Multiple screens

`kiosk-run.sh` runs one kiosk browser per active monitor, each with its own profile dir
(`~/.config/google-chrome-screen<N>`, since a second window would otherwise be handed to
the first browser) placed with `--window-position`/`--window-size` from
`xrandr --listmonitors`. With an external monitor connected, `arrange_outputs` places it
to the right of the built-in screen at `EXTERNAL_MODE` (2560x1440), and makes it primary
(mpv opens on the primary screen, so the surf cams play there). With no external monitor
the built-in screen runs alone. The script also polls the connected outputs every 30
seconds while the browsers run, and when they change (a monitor plugged in, unplugged, or
powered on or off) it relaunches the browsers and lays the screens out again. That covers
a power outage where the laptop boots before the monitor wakes. To force it immediately
run `pkill -x chrome`.

`EXTERNAL_MODE` is 1440p rather than the monitor's native 4K because a 4K monitor behind
the USB-C/HDMI adapter only gets 30 Hz at 3840x2160 (HDMI 1.4 bandwidth).

Both screens currently load the same `/display` page, so they rotate independently and
the surf cam video only appears on the external monitor (the built-in screen shows
"loading surf cam..." during surf cam panels).

### Power and network behavior

The laptop runs lid-closed and plugged in:
- `/etc/systemd/logind.conf.d/kiosk.conf` ignores the lid switch and idle actions, and
  the sleep/suspend/hibernate targets are masked, so it never suspends
- The battery acts as a short-outage UPS. A laptop only powers itself back on after a
  full battery drain if its UEFI has an AC-recovery setting, which should be checked in
  the UEFI menu (`sudo systemctl reboot --firmware-setup`)
- Wi-Fi power saving is turned off by `wifi-powersave-off.service` (it adds latency and
  can drop idle connections)
- `/etc/cloud/cloud.cfg.d/99-disable-network-config.cfg` stops cloud-init regenerating
  `/etc/netplan/50-cloud-init.yaml`, which holds the Wi-Fi credentials, on later boots
- Netplan's Wi-Fi config must not also exist in another file with a `match:` rule or
  `netplan apply` fails with "networkd backend does not support wifi with match:"

### Overnight sleep (battery saver)

From 00:00 to 06:00 local time (Pacific, set by the machine's timezone) the kiosk sleeps
to save solar battery: `kiosk-run.sh` kills the browsers and forces the monitors off with
`xset dpms force off`. At 06:00 it turns the monitors back on and relaunches the browsers
(fresh cache, so it also picks up any overnight deploys).

- The script checks the clock itself (polls every 30s) rather than using cron, so a
  reboot or crash at 3am stays asleep instead of starting the browsers
- The window is the `SLEEP_START_HOUR` / `SLEEP_END_HOUR` constants at the top of
  `~/kiosk-run.sh` (start inclusive, end exclusive)
- DPMS is normally disabled for the always-on display; it's only enabled for the
  duration of the sleep window
- The laptop itself stays powered on (X, openbox, SSH all still work) — only the
  browsers and monitors are off

**Why the cache gets cleared on every launch:** the site is served from GitHub Pages
with `Cache-Control: max-age=600`. Without clearing it, restarting the browsers to pick
up a deploy can still serve a stale disk-cached copy for up to 10 minutes.

### Surf cam playback

Surf cam panels are played by `mpv` (fullscreen, on top of the browser), driven by the
surfcam agent -- a small Python server started from `~/kiosk-run.sh` alongside the
browsers. Video is decoded in hardware (VA-API); all three cams play with zero dropped
frames and near-zero CPU. The agent also draws an info overlay (place name, swell, wind,
tide) on each cam. Setup, the overlay's data sources, and troubleshooting are in
`pi/services/surfcam-agent/README.md`.

## Security and Maintenance

Set by `setup-displaytop.sh`, so a rebuild gets them automatically:

- **SSH is key-only** (`/etc/ssh/sshd_config.d/10-kiosk.conf`). The script skips this if no
  key is installed yet, so it can't lock you out. If your key is ever lost, log in at the
  laptop's own keyboard (Ctrl+Alt+F2 for a console) with the account password and re-add a
  key to `~/.ssh/authorized_keys`
- **Unattended security updates**, including Google Chrome's own repo
  (`/etc/apt/apt.conf.d/52kiosk-unattended`). When an update needs a reboot it happens at
  03:00, inside the overnight sleep window, and the kiosk stays asleep until 06:00
- **No firewall on purpose.** The only listening ports are SSH (key-only) and the surfcam
  agent on `127.0.0.1`, and the router doesn't forward anything to the laptop. A LAN-only
  firewall rule would lock you out of SSH after a move to a different subnet
- **Unused services masked**: ModemManager, multipathd, packagekit. The journal is capped
  at 200 MB
- **Logs**: `journalctl` for the system, `/tmp/surfcam-agent.log` for the agent (cleared on
  reboot)
- **Updating the kiosk's own code**: copy the files over and re-run the script (the same
  two commands as in the runbook); it's idempotent. The overlay and kiosk script changes
  take effect after the agent or browsers restart (`pkill -f "[s]urfcam_agent.py"` and
  `pkill -x chrome`, or a reboot)

## Setting Up From Scratch

Use this when reflashing the laptop, replacing it, or moving the setup somewhere new. It
takes about an hour. Everything after step 6 is automated by
`pi/services/display-kiosk/setup-displaytop.sh` (idempotent, safe to re-run). Steps 1-6
are manual because they happen before the laptop is reachable over SSH.

### What you need

- The laptop (any x86 laptop with Intel graphics works; this one is a Surface Laptop 3),
  its charger, and an external monitor on the USB-C/HDMI adapter
- A USB stick (8 GB or more) for the installer, and the Windows PC to make it
- Your Wi-Fi name and password (the laptop has no Ethernet port; a USB Ethernet adapter
  works too and lets you skip the Wi-Fi config in step 5)
- The router's admin login (see step 7)

### 1. Make the installer stick (on the Windows PC)

Download the latest Ubuntu Server LTS ISO from ubuntu.com/download/server, then write it
with Rufus (ISO mode) or balenaEtcher. Copying the ISO file onto the stick does not work;
it has to be written as a bootable image, which erases the stick. To reuse the stick
afterwards, reformat it (exFAT) in Windows.

### 2. Boot the installer

From a running Linux, `sudo systemctl reboot --firmware-setup` opens the UEFI menu; put
USB first in the boot order. Leave Secure Boot on (Ubuntu supports it). Choose "Try or
Install Ubuntu Server".

### 3. Installer choices (keyboard only: arrows, Enter, Space)

- Ubuntu Server (not the "minimized" one)
- Network: set up Wi-Fi here if offered; it's fine to skip and do step 5 afterwards
- Storage: use the entire disk with the default layout (this erases the laptop)
- Server name `displaytop`, username `tyler`, a password you'll remember (needed for the
  first `sudo`)
- Install the OpenSSH server (yes). Importing SSH keys from GitHub only works when the
  network is up; skip if it isn't
- No featured snaps. When it asks, remove the USB stick and reboot

### 4. First login at the laptop

Log in as `tyler` at the laptop's own keyboard (it shows a text console).

### 5. Wi-Fi (only if the installer didn't get it working)

Write the network file in one go rather than editing it, since YAML indentation is easy
to break by hand. Type this at the console; `sudo tee` waits for input, finish it with
Ctrl+D on an empty line:

```
sudo tee /etc/netplan/50-cloud-init.yaml
network:
  version: 2
  wifis:
    wlp0s20f3:
      dhcp4: true
      access-points:
        "YourNetworkName":
          password: "YourPassword"
```

Use the real interface name from `ip -br a` (a line starting `wlp`), indent with two
spaces and never tabs, and put both the network name and password in double quotes.
Then:

```bash
sudo chmod 600 /etc/netplan/50-cloud-init.yaml
sudo netplan apply
ip -br a          # the wlp line should show UP with a 192.168.x.x address
```

If `netplan apply` says "networkd backend does not support wifi with match:", another file
in `/etc/netplan/` (often `00-installer-config.yaml`) also defines the Wi-Fi interface;
move it out of the way (`sudo mv /etc/netplan/<that file> /root/`). Note the address; it's
needed in the next steps. (The setup script later stops cloud-init from regenerating this
file.)

### 6. SSH key and first run (from the Windows PC)

Put your public key on the laptop (asks for the laptop password once):

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh tyler@<laptop-ip> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Then, from the repo root, copy the setup files over and run the script (`-t` lets sudo
ask for the password this one time; the script then makes sudo passwordless):

```bash
scp -r pi/services/display-kiosk pi/services/surfcam-agent tyler@<laptop-ip>:~/setup/
ssh -t tyler@<laptop-ip> "sudo ~/setup/display-kiosk/setup-displaytop.sh"
ssh tyler@<laptop-ip> "sudo reboot"
```

Once your key is installed the script turns off SSH password logins (see Security and
Maintenance). The script sets the timezone, installs the packages and Google Chrome, writes the Chrome
policy that lets the display page call the surfcam agent, the autologin/startx/openbox
boot chain, `~/kiosk-run.sh`, the agent, never-suspend and lid settings, and the network
settings. It installs Google Chrome from Google's `.deb` because Ubuntu ships Chromium
only as a snap; Chrome's policy directory is `/etc/opt/chrome/policies/managed/`.

### 7. Router: reserve the laptop's address

A DHCP reservation makes the router always hand the laptop the same address (matched by
its Wi-Fi MAC), so SSH, scripts and these docs keep working after reboots and outages.
The router at `192.168.1.254` is an AT&T gateway (login page `/cgi-bin/index.ha`): sign
in with the Device Access Code printed on the gateway, open Home Network, then IP
Allocation, find `displaytop` (the MAC is in `cat /sys/class/net/wlp*/address` on the
laptop), and allocate its current address. Menus differ by model.

### 8. Monitor and UEFI

- The laptop only detects the monitor while it's awake (see Troubleshooting). The kiosk
  re-checks every 30 seconds, so the order you power things on in doesn't matter: if the
  external screen stays blank, check its power and input source first
- In the UEFI menu (`sudo systemctl reboot --firmware-setup`), look for a power-on-after-
  AC-loss setting and a battery charge limit, and enable them if offered. Without
  AC recovery, an outage longer than the battery leaves the laptop off until someone
  presses the power button

### 9. Check it worked

```bash
ssh tyler@<laptop-ip> '
  uptime -p
  pgrep -af "kiosk-run|surfcam_agent"      # both running
  DISPLAY=:0 XAUTHORITY=$(ls /tmp/serverauth.* | head -1) xrandr --listmonitors   # both screens
  curl -s -o /dev/null -w "agent %{http_code}\n" -X OPTIONS -H "Origin: https://tyler-schwenk.com" http://127.0.0.1:8765/cams/pb/show
  tail -3 /tmp/surfcam-agent.log
'
```

Both screens should show the display page, the agent should answer 200, and a surf cam
panel should show the cam with the info bar across the top within a few rotations.

### Moving to a new place

- **Wi-Fi changes** (new router or home): the laptop can't connect, so you can't SSH in.
  Use its own keyboard: press Ctrl+Alt+F2 for a login prompt (tty1 is the kiosk), log in as
  `tyler`, and redo step 5 with the new network. Then redo step 7 on the new router and
  update the address in `docs/development.md`
- **Different timezone for the kiosk:** change `TIMEZONE` in `setup-displaytop.sh` and
  re-run it. This only moves the overnight sleep window. The surf cam overlay always shows
  times in the cams' own time (Pacific), set by `TIMEZONE` in `surf_conditions.py`
- **Different cams or tide station:** see `pi/services/surfcam-agent/README.md`
- **Nothing in the repo is secret:** the Wi-Fi password and SSH key live only on the
  laptop and your PC, so a reflash needs them re-entered

## Files and What They Do

| Where | What |
|---|---|
| `pi/services/display-kiosk/setup-displaytop.sh` | Provisions a fresh Ubuntu install into the kiosk (idempotent) |
| `pi/services/display-kiosk/kiosk-run.sh` | Becomes `~/kiosk-run.sh`: screens, browsers, agent, overnight sleep |
| `pi/services/surfcam-agent/` | The surf cam player agent and its info overlay (own README) |
| `website/app/display/` | The page the browsers show (see `website/docs/DISPLAY.md`) |
| On the laptop only | `/etc/netplan/50-cloud-init.yaml` (Wi-Fi), `/etc/sudoers.d/tyler-nopasswd`, `~/.ssh/authorized_keys` |

## Updating the Displayed Page

The kiosk doesn't auto-refresh when the site deploys — the browsers keep running the
page they already loaded. After a deploy:

```bash
ssh tyler@192.168.1.192 "pkill -x chrome"
```

The `kiosk-run.sh` loop clears the caches and relaunches the browsers within ~5-8
seconds, fetching the new deploy fresh (outside the overnight sleep window).

## Troubleshooting

**External monitor blank or not detected (`xrandr` shows only `eDP-1`, or `DP-2`
disconnected):** the kiosk re-checks every 30 seconds and recovers by itself once the
monitor is back, so first check the monitor is powered on and set to the adapter's input,
and that the USB-C cable is seated. The Surface Laptop 3's USB-C controller
(ACPI id `USBC000`) isn't claimed by any mainline Linux driver, so DisplayPort over USB-C
depends on the firmware and Intel graphics negotiating it themselves, and it only shows
up once the monitor is awake. Check
`/sys/class/drm/card1-{DP-1,DP-2,HDMI-A-1,HDMI-A-2}/status` (one should read
`connected`), re-seat the adapter, then run `pkill -x chrome` to re-detect.

**Screen blank after boot, but SSH works fine:** check `xrandr` for the active modes:
```bash
DISPLAY=:0 XAUTHORITY=$(ls /tmp/serverauth.* | head -1) xrandr
```

**Displayed content looks stale after a push:** the browsers weren't restarted, or their
cache wasn't actually cleared. Run the restart command above; if still stale, confirm
`~/kiosk-run.sh` still has the cache-clearing `rm -rf` line before the browser launch.

**Screen is black / no browser during the day:** check the time and the
`SLEEP_START_HOUR` / `SLEEP_END_HOUR` constants in `~/kiosk-run.sh`, and that
`timedatectl` shows the right timezone. A wrong clock means the sleep window lands at
the wrong time.

**Browser won't start (crash loop in `kiosk-run.sh`):** run it by hand to see the error:
`DISPLAY=:0 XAUTHORITY=$(ls /tmp/serverauth.* | head -1) google-chrome-stable --kiosk https://tyler-schwenk.com/display`.
A past cause was `~/.config` being owned by root, which stops the browser creating its
profile; it must be owned by `tyler`.

**Check what's actually on screen without physically looking:**
```bash
DISPLAY=:0 XAUTHORITY=$(ls /tmp/serverauth.* | head -1) scrot -o /tmp/check.png
```
then `scp` the file off to inspect it (it covers both screens side by side).
