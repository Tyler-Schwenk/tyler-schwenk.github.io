# Display Kiosk (displaytop)

An always-on monitor, powered off the home solar battery setup, that shows a rotating
set of panels (photos, mallard count, live surf cams, and more planned). Driven by a
dedicated machine running a kiosk browser pointed at `https://tyler-schwenk.com/display`
— a page on the main website (see `website/docs/DISPLAY.md`), not a separate app.

There are two machines that can run it, with the same software stack:

| | displaytop (primary) | displaypi (spare) |
|---|---|---|
| Device | Surface Laptop 3 (i5-1035G7, 8 GB RAM, 128 GB SSD) | Raspberry Pi 3 B+ (1 GB RAM) |
| Network | Wi-Fi (Intel AX201) | Ethernet |
| IP | `192.168.1.192` (set a DHCP reservation in the router) | `192.168.1.187` |
| OS | Ubuntu Server 26.04 LTS | Raspberry Pi OS Lite 64-bit (Debian 13) |
| Browser | Google Chrome (deb) | Chromium |
| Video decode | VA-API (Intel) | v4l2m2m (bcm2835 codec) |
| Surf cams | all play smoothly | 30 fps cams drop most frames |

displaytop is the primary because the Pi can't render 30 fps 1080p video smoothly (see
"Why a laptop"). Both use the same scripts from `pi/services/display-kiosk/`.

## Access

- **User**: `tyler`, SSH key auth (same key as fart-pi) — `ssh tyler@192.168.1.192`
- **Sudo**: passwordless (`/etc/sudoers.d/tyler-nopasswd`) so the kiosk can be maintained
  remotely without a keyboard
- Both machines are on the home LAN only, same subnet as fart-pi

## Kiosk Software Stack

Minimal X setup — no desktop environment, just enough to run one full-screen browser:

- `xserver-xorg`, `xinit`, `openbox` (window manager), `x11-xserver-utils`, `unclutter`
  (hides the mouse cursor), the browser, `mpv` (surf cams), `fonts-noto-color-emoji`,
  `scrot` (screenshots), plus `intel-media-va-driver` and `vainfo` on the laptop

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

### Multiple screens (laptop)

`kiosk-run.sh` runs one kiosk browser per active monitor, each with its own profile dir
(`~/.config/google-chrome-screen<N>`, since a second window would otherwise be handed to
the first browser) placed with `--window-position`/`--window-size` from
`xrandr --listmonitors`. With an external monitor connected, `arrange_outputs` places it
to the right of the built-in screen, makes it primary, and writes its output name to
`/tmp/surfcam-screen` so the surfcam agent plays surf cam video on it. With no external
monitor the built-in screen runs alone. Outputs are re-detected every time the browsers
relaunch (crash, or the 06:00 wake), so a monitor plugged in later is picked up then;
to pick it up immediately run `pkill -x chrome`.

Both screens currently load the same `/display` page, so they rotate independently and
the surf cam video only appears on the external monitor (the other screen shows
"loading surf cam..." during surf cam panels).

### Setting up displaytop from a fresh Ubuntu Server install

`pi/services/display-kiosk/setup-displaytop.sh` is idempotent and does everything below
(timezone, packages, Chrome, policy, autologin, kiosk files, never-suspend). From the
repo root on a machine that can SSH in:

```bash
scp -r pi/services/display-kiosk pi/services/surfcam-agent tyler@192.168.1.192:~/setup/
ssh tyler@192.168.1.192 "sudo ~/setup/display-kiosk/setup-displaytop.sh"
```

Then reboot. It installs Google Chrome from Google's `.deb` because Ubuntu ships
Chromium only as a snap. Chrome's policy directory is `/etc/opt/chrome/policies/managed/`
(Debian's Chromium uses `/etc/chromium/policies/managed/`).

### Laptop network and power behavior

- Wi-Fi power saving is turned off by `wifi-powersave-off.service` (it adds latency and
  can drop idle connections)
- `/etc/cloud/cloud.cfg.d/99-disable-network-config.cfg` stops cloud-init regenerating
  `/etc/netplan/50-cloud-init.yaml`, which holds the Wi-Fi credentials, on later boots
- Netplan's Wi-Fi config must not also exist in another file with a `match:` rule or
  `netplan apply` fails with "networkd backend does not support wifi with match:"


It runs lid-closed and plugged in:
- `/etc/systemd/logind.conf.d/kiosk.conf` ignores the lid switch and idle actions, and
  the sleep/suspend/hibernate targets are masked, so it never suspends
- The battery acts as a short-outage UPS. A laptop only powers itself back on after a
  full battery drain if its UEFI has an AC-recovery setting, which should be checked in
  the UEFI menu (`sudo systemctl reboot --firmware-setup`)

### Overnight sleep (battery saver)

From 00:00 to 06:00 local time (Pacific, set by the machine's timezone) the kiosk sleeps
to save solar battery: `kiosk-run.sh` kills the browser and forces the monitor off with
`xset dpms force off`. At 06:00 it turns the monitor back on and relaunches the browser
(fresh cache, so it also picks up any overnight deploys).

- The script checks the clock itself (polls every 30s) rather than using cron, so a
  reboot or crash at 3am stays asleep instead of starting the browser
- The window is the `SLEEP_START_HOUR` / `SLEEP_END_HOUR` constants at the top of
  `~/kiosk-run.sh` (start inclusive, end exclusive)
- DPMS is normally disabled for the always-on display; it's only enabled for the
  duration of the sleep window
- The machine itself stays powered on (X, openbox, SSH all still work) — only the
  browser and monitor are off

**Why the cache gets cleared on every launch:** the site is served from GitHub Pages
with `Cache-Control: max-age=600`. Without clearing it, restarting the browser to pick
up a deploy can still serve a stale disk-cached copy for up to 10 minutes.

### Surf cam playback

Surf cam panels are played by `mpv` (fullscreen, on top of the browser), driven by the
surfcam agent -- a small Python server started from `~/kiosk-run.sh` alongside the
browser. Setup, the browser local-network-access policy it needs, and troubleshooting
are in `pi/services/surfcam-agent/README.md`.

## Updating the Displayed Page

The kiosk doesn't auto-refresh when the site deploys — the browser keeps running the
page it already loaded. After a deploy:

```bash
ssh tyler@192.168.1.192 "pkill -x chrome"
```

The `kiosk-run.sh` loop clears the cache and relaunches the browser within ~5-8 seconds,
fetching the new deploy fresh (outside the overnight sleep window). On displaypi the
process name is `chromium`.

## Why a laptop

Hardware video decode on the Pi 3B+ (v4l2m2m) handles 20 fps 1080p but not 30 fps: the
30 fps cams drop about two thirds of their frames no matter which mpv video output is
used, because copying and rendering 1080p frames is the bottleneck. On the laptop's
Intel GPU the same streams play with zero dropped frames and near-zero CPU. The laptop
also has the RAM and CPU headroom for planned panels (BPM visualizer, a surf conditions
overlay).

## Troubleshooting

**External monitor not detected on the laptop (`xrandr` shows only `eDP-1`):** the
Surface Laptop 3's USB-C controller (ACPI id `USBC000`) isn't claimed by any mainline
Linux driver (`ucsi_acpi` only matches `PNP0CA0`), so DisplayPort over USB-C depends on
the firmware and Intel graphics negotiating it themselves. Check
`/sys/class/drm/card1-{DP-1,DP-2,HDMI-A-1,HDMI-A-2}/status`; all `disconnected` means
nothing is negotiated. Re-seat the adapter, check the monitor's input source, and try
another adapter or the other port.

**Screen blank after boot, but SSH works fine:** check `xrandr` output for the active
mode:
```bash
DISPLAY=:0 XAUTHORITY=$(ls /tmp/serverauth.* | head -1) xrandr
```
On the laptop, make sure the external monitor shows as `connected` (the USB-C adapter
and cable matter) -- the kiosk script turns the built-in screen off once one is
detected at startup, so plug the monitor in before boot or restart the session.

**Displayed content looks stale after a push:** the browser wasn't restarted, or its
cache wasn't actually cleared. Run the restart command above; if still stale, confirm
`~/kiosk-run.sh` still has the `rm -rf` cache-clear line before the browser launch.

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
then `scp` the file off to inspect it.

## displaypi (spare Raspberry Pi)

The previous kiosk, kept as a fallback. It runs the same boot flow with Chromium and its
own `~/kiosk-run.sh` and `~/surfcam-agent/`.

- **Hardware**: Pi 3 B+ (1 GB), Ethernet only, `192.168.1.187`, OS Raspberry Pi OS Lite
  64-bit (Debian 13)
- **Forced HDMI mode**: at boot the Pi's HDMI hotplug detection didn't reliably pick up
  the monitor in time, so a mode is forced in `/boot/firmware/cmdline.txt` (backup at
  `cmdline.txt.bak`) by appending `video=HDMI-A-1:1920x1080@60D`. Re-add it after any
  fresh OS reflash if the screen is blank while SSH works
- **Power**: needs a short, thick micro-USB cable and a solid 5 V / 2.5 A supply.
  `vcgencmd get_throttled` should read `0x0`; undervoltage caused dropped frames and
  random reboots on a thin cable
- **Chromium policy** for the surfcam agent: `/etc/chromium/policies/managed/surfcam.json`
- **Resource limits**: 1 GB of RAM and a quad-core Cortex-A53. Animating hundreds of
  individually CSS-animated DOM elements pegged the CPU and pushed it into swap.
  Panels that animate many elements should draw on one `<canvas>` with a single
  `requestAnimationFrame` loop, pre-render repeated images once to an offscreen canvas,
  cap how many elements render regardless of the real count, and cap the frame rate
  (MallardPanel does all four: 180 ducks max, 24 fps)
