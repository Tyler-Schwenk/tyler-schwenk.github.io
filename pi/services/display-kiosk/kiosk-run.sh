#!/bin/bash
# runs the kiosk browser and the surfcam agent. started from openbox autostart (so
# it inherits the x session), installed as ~/kiosk-run.sh. sleeps (no browser,
# monitor off) overnight to save power. see pi/docs/services/display-kiosk.md.

SLEEP_START_HOUR=0   # inclusive, local time
SLEEP_END_HOUR=6     # exclusive, local time
POLL_INTERVAL_S=30
RELAUNCH_DELAY_S=5
DISPLAY_URL="https://tyler-schwenk.com/display"

# debian's chromium on the pi, google chrome (deb) on the laptop -- same flags, different names.
# BROWSER_PROC is the process name pkill matches, BROWSER_DIR the folder name under ~/.cache and ~/.config
if command -v chromium >/dev/null; then
  BROWSER=chromium; BROWSER_PROC=chromium; BROWSER_DIR=chromium
else
  BROWSER=google-chrome-stable; BROWSER_PROC=chrome; BROWSER_DIR=google-chrome
fi

# true during the overnight window. 10# avoids octal parsing of "08"/"09"
in_sleep_window() {
  local hour=$((10#$(date +%H)))
  [ "$hour" -ge "$SLEEP_START_HOUR" ] && [ "$hour" -lt "$SLEEP_END_HOUR" ]
}

# dpms is normally disabled for the always-on display; enable it just long enough to force the monitor off
monitor_off() { xset +dpms; xset dpms force off; }
monitor_on() { xset dpms force on; xset -dpms; xset s off; xset s noblank; }

# on the laptop, show only on the external monitor when one's plugged in (its own
# screen would otherwise mirror/extend). no-op on the pi, which has no internal panel.
use_external_monitor_only() {
  local internal external
  internal=$(xrandr | awk '/^eDP/ {print $1; exit}')
  external=$(xrandr | awk '/ connected/ && $1 !~ /^eDP/ {print $1; exit}')
  [ -n "$internal" ] && [ -n "$external" ] || return 0
  xrandr --output "$external" --auto --primary --output "$internal" --off
}

# starts the browser and waits; kills it if the sleep window begins. returns when the browser is gone.
run_browser() {
  # the site is served with max-age=600, so clear the cache or a restart can show a stale deploy
  rm -rf ~/.cache/$BROWSER_DIR ~/.config/$BROWSER_DIR/Default/Cache ~/.config/$BROWSER_DIR/Default/Code\ Cache
  $BROWSER --kiosk --noerrdialogs --disable-infobars \
    --disable-session-crashed-bubble --no-first-run \
    --check-for-update-interval=31536000 --password-store=basic \
    "$DISPLAY_URL" &
  local pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    if in_sleep_window; then
      pkill -x "$BROWSER_PROC"
      break
    fi
    sleep "$POLL_INTERVAL_S"
  done
  wait "$pid" 2>/dev/null
}

# surf cam player agent; restarted if it ever dies. see pi/services/surfcam-agent/README.md
( while true; do python3 ~/surfcam-agent/surfcam_agent.py; sleep $RELAUNCH_DELAY_S; done ) &

use_external_monitor_only
# make sure the monitor is on at startup, in case a previous run left it blanked
monitor_on

while true; do
  if in_sleep_window; then
    monitor_off
    while in_sleep_window; do sleep "$POLL_INTERVAL_S"; done
    monitor_on
  fi
  run_browser
  sleep "$RELAUNCH_DELAY_S"
done
