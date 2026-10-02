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

### Setting up from a fresh Ubuntu Server install

`pi/services/display-kiosk/setup-displaytop.sh` is idempotent and does everything
described here (timezone, packages, Chrome, policy, autologin, kiosk files, never-suspend,
network settings). From the repo root on a machine that can SSH in:

```bash
scp -r pi/services/display-kiosk pi/services/surfcam-agent tyler@192.168.1.192:~/setup/
ssh tyler@192.168.1.192 "sudo ~/setup/display-kiosk/setup-displaytop.sh"
```

Then reboot. Chrome's policy directory is `/etc/opt/chrome/policies/managed/`; the setup
installs `surfcam.json` there so the display page can call the surfcam agent on
localhost without a permission prompt.

### Multiple screens

`kiosk-run.sh` runs one kiosk browser per active monitor, each with its own profile dir
(`~/.config/google-chrome-screen<N>`, since a second window would otherwise be handed to
the first browser) placed with `--window-position`/`--window-size` from
`xrandr --listmonitors`. With an external monitor connected, `arrange_outputs` places it
to the right of the built-in screen at `EXTERNAL_MODE` (2560x1440), and makes it primary
(mpv opens on the primary screen, so the surf cams play there). With no external monitor
the built-in screen runs alone. Outputs are re-detected every time the browsers relaunch
(crash, or the 06:00 wake), so a monitor plugged in later is picked up then; to pick it
up immediately run `pkill -x chrome`.

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

## Updating the Displayed Page

The kiosk doesn't auto-refresh when the site deploys — the browsers keep running the
page they already loaded. After a deploy:

```bash
ssh tyler@192.168.1.192 "pkill -x chrome"
```

The `kiosk-run.sh` loop clears the caches and relaunches the browsers within ~5-8
seconds, fetching the new deploy fresh (outside the overnight sleep window).

## Troubleshooting

**External monitor not detected (`xrandr` shows only `eDP-1`):** first check the monitor
is powered on and set to the adapter's input. The Surface Laptop 3's USB-C controller
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
