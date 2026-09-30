# Display Kiosk (displaypi)

An always-on monitor, powered off the home solar battery setup, that shows a rotating
set of panels (photos, mallard count, and more planned). Driven by a dedicated
Raspberry Pi running a kiosk browser pointed at `https://tyler-schwenk.com/display` —
a page on the main website (see `website/docs/DISPLAY.md`), not a separate app.

## Hardware

- **Device**: Raspberry Pi 3 Model B+ (1 GB RAM) — chosen over an old laptop for much
  lower power draw, since it runs off the solar battery setup
- **Hostname**: `displaypi`
- **Display**: External monitor via HDMI
- **Network**: Ethernet only (no Wi-Fi configured)
- **IP**: `192.168.1.187` (DHCP) — home LAN only, same subnet as fart-pi

## OS and Access

- **OS**: Raspberry Pi OS Lite (64-bit), Debian 13 (trixie)
- **User**: `tyler`, SSH key auth (same key as fart-pi) — `ssh tyler@192.168.1.187`
- **Sudo**: passwordless (`/etc/sudoers.d/tyler-nopasswd`), set up so the kiosk can be
  maintained remotely without a monitor/keyboard for routine changes

## Kiosk Software Stack

Minimal X setup — no desktop environment, just enough to run one full-screen browser:

- `xserver-xorg`, `xinit`, `openbox` (window manager), `x11-xserver-utils`, `unclutter`
  (hides the mouse cursor), `chromium`, `fonts-noto-color-emoji` (color emoji support,
  not installed by default on Lite)

**Boot flow:**
1. `/etc/systemd/system/getty@tty1.service.d/autologin.conf` — autologin as `tyler` on
   tty1 (no monitor/keyboard needed to reach a working session)
2. `~/.bash_profile` — on tty1 login with no `$DISPLAY`, runs `startx`
3. `~/.xinitrc` — execs `openbox-session`
4. `~/.config/openbox/autostart` — disables screen blanking/DPMS, starts `unclutter`,
   then loops: clear Chromium's disk cache, launch `chromium --kiosk` pointed at the
   display page, relaunch after a 5s pause if it ever exits or crashes

**Why the cache gets cleared on every launch:** the site is served from GitHub Pages
with `Cache-Control: max-age=600`. Without clearing it, restarting Chromium to pick up
a deploy can still serve a stale disk-cached copy for up to 10 minutes.

### Forced HDMI mode

At boot, the Pi's HDMI hotplug detection didn't reliably pick up the monitor in time —
X would start with no output mode applied, leaving the screen blank even though
everything (X, Openbox, Chromium) was actually running. Fixed by forcing a mode via
the kernel command line rather than relying on hotplug timing:

`/boot/firmware/cmdline.txt` (backup at `cmdline.txt.bak`) has
`video=HDMI-A-1:1920x1080@60D` appended.

## Updating the Displayed Page

The kiosk doesn't auto-refresh when the site deploys — Chromium keeps running the
page it already loaded. After a deploy:

```bash
ssh tyler@192.168.1.187 "pkill chromium"
```

The autostart loop clears the cache and relaunches Chromium within ~5-8 seconds,
fetching the new deploy fresh.

## Hardware Constraints

1 GB of RAM and a quad-core Cortex-A53 is not a lot for a full browser plus whatever
the display page is animating. Observed via `top` during development: animating
hundreds of individually CSS-animated DOM elements pegged CPU (100%+ across cores)
and pushed the system into swap. Takeaways for any panel that animates many elements:

- Prefer a single `<canvas>` with one `requestAnimationFrame` loop over many
  independently-animated DOM nodes — far cheaper for lots of moving sprites
- Pre-render repeated images (e.g. emoji) once to an offscreen canvas and `drawImage`
  them, rather than re-rendering text/emoji glyphs every frame
- Cap how many elements actually get drawn/animated regardless of the "real" number
  behind them (MallardPanel caps at 180 ducks even though the real count is higher)
- Cap the animation frame rate (MallardPanel targets 24fps, not 60)

## Troubleshooting

**Screen blank after boot, but SSH works fine:** check `xrandr` output for the active
mode (`ssh tyler@192.168.1.187` then `DISPLAY=:0 XAUTHORITY=$(ls /tmp/serverauth.* | head -1) xrandr`).
If `HDMI-1` shows no mode marked `*`, the forced-mode kernel cmdline setting may have
been lost (e.g. after a fresh OS reflash) — re-add it per "Forced HDMI mode" above.

**Displayed content looks stale after a push:** Chromium wasn't restarted, or its
cache wasn't actually cleared. Run the restart command above; if still stale, confirm
`~/.config/openbox/autostart` still has the `rm -rf` cache-clear line before the
`chromium` launch.

**Check what's actually on screen without physically looking:** `scrot` is installed
for exactly this — SSH in and run:
```bash
DISPLAY=:0 XAUTHORITY=$(ls /tmp/serverauth.* | head -1) scrot -o /tmp/check.png
```
then `scp` the file off to inspect it.
