#!/bin/bash
# runs the kiosk browsers (one per screen) and the surfcam agent. started from openbox
# autostart (so it inherits the x session), installed as ~/kiosk-run.sh. sleeps (no
# browser, monitors off) overnight to save power. see pi/docs/services/display-kiosk.md.

SLEEP_START_HOUR=0   # inclusive, local time
SLEEP_END_HOUR=6     # exclusive, local time
POLL_INTERVAL_S=30
RELAUNCH_DELAY_S=5
DISPLAY_URL="https://tyler-schwenk.com/display"

# resolution for the external monitor. a 4k monitor behind the usb-c/hdmi adapter only gets 30 Hz
# at 3840x2160 (hdmi 1.4 bandwidth), so 1440p at 60 Hz is the sharp-and-smooth choice
EXTERNAL_MODE="2560x1440"

# BROWSER_PROC is the process name pkill matches, BROWSER_DIR the profile folder prefix under ~/.config
BROWSER=google-chrome-stable
BROWSER_PROC=chrome
BROWSER_DIR=google-chrome

# true during the overnight window. 10# avoids octal parsing of "08"/"09"
in_sleep_window() {
  local hour=$((10#$(date +%H)))
  [ "$hour" -ge "$SLEEP_START_HOUR" ] && [ "$hour" -lt "$SLEEP_END_HOUR" ]
}

# dpms is normally disabled for the always-on display; enable it just long enough to force the monitor off
monitor_off() { xset +dpms; xset dpms force off; }
monitor_on() { xset dpms force on; xset -dpms; xset s off; xset s noblank; }

# lay the external monitor out to the right of the built-in screen (both stay on, each
# gets its own browser) and make it primary, which is where mpv opens the surf cams.
# with no external monitor the built-in screen just runs alone. re-run on every browser
# relaunch so a monitor plugged in later gets picked up.
arrange_outputs() {
  local internal external
  internal=$(xrandr | awk '/^eDP/ {print $1; exit}')
  external=$(xrandr | awk '/ connected/ && $1 !~ /^eDP/ {print $1; exit}')
  [ -n "$external" ] || return 0
  # fall back to the monitor's preferred mode if it doesn't offer EXTERNAL_MODE
  xrandr --output "$internal" --auto --pos 0x0 \
    --output "$external" --mode "$EXTERNAL_MODE" --primary --right-of "$internal" ||
    xrandr --output "$internal" --auto --pos 0x0 \
      --output "$external" --auto --primary --right-of "$internal"
}

# one "x y width height" line per active monitor, from `xrandr --listmonitors` rows like
# " 0: +*eDP-1 2256/285x1504/190+0+0  eDP-1"
monitor_geometries() {
  xrandr --listmonitors | awk 'NR > 1 { split($3, g, /[\/x+]/); print g[5], g[6], g[1], g[3] }'
}

# true if any of the given pids is no longer running
any_dead() {
  local pid
  for pid in "$@"; do
    kill -0 "$pid" 2>/dev/null || return 0
  done
  return 1
}

# starts one browser per monitor and waits; kills them all if one dies or the sleep window
# begins. each needs its own profile dir or chrome would hand the second window to the first.
run_browsers() {
  local x y w h dir index=0 pids=()
  while read -r x y w h; do
    dir="$HOME/.config/$BROWSER_DIR-screen$index"
    # the site is served with max-age=600, so clear the cache or a restart can show a stale
    # deploy. singleton files are stale locks left by an unclean shutdown
    rm -rf "$dir/Default/Cache" "$dir/Default/Code Cache" "$dir"/Singleton*
    $BROWSER --kiosk --user-data-dir="$dir" --window-position="$x,$y" --window-size="$w,$h" \
      --noerrdialogs --disable-infobars --disable-session-crashed-bubble --no-first-run \
      --check-for-update-interval=31536000 --password-store=basic \
      "$DISPLAY_URL" &
    pids+=($!)
    index=$((index + 1))
  done < <(monitor_geometries)
  while ! any_dead "${pids[@]}"; do
    in_sleep_window && break
    sleep "$POLL_INTERVAL_S"
  done
  pkill -x "$BROWSER_PROC"
  wait "${pids[@]}" 2>/dev/null
}

# surf cam player agent; restarted if it ever dies. see pi/services/surfcam-agent/README.md
( while true; do python3 ~/surfcam-agent/surfcam_agent.py >> /tmp/surfcam-agent.log 2>&1; sleep $RELAUNCH_DELAY_S; done ) &

# make sure the monitor is on at startup, in case a previous run left it blanked
monitor_on

while true; do
  if in_sleep_window; then
    monitor_off
    while in_sleep_window; do sleep "$POLL_INTERVAL_S"; done
    monitor_on
  fi
  arrange_outputs
  run_browsers
  sleep "$RELAUNCH_DELAY_S"
done
