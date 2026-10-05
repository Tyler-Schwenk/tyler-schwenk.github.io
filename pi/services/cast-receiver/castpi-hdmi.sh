#!/bin/bash
# hdmi helpers for uxplay.service on castpi. uxplay's kmssink grabs the display once at
# startup and keeps it, so it has to start after a screen is plugged in, and restart when
# one shows up later, to see the new screen.
#
#   castpi-hdmi.sh wait      block until hdmi reports a connected screen (ExecStartPre)
#   castpi-hdmi.sh hotplug   restart uxplay if a screen just got connected and nobody's
#                            mirroring right now (run by the udev rule on drm changes)
set -euo pipefail

HDMI_STATUS_GLOB="/sys/class/drm/card*-HDMI-A-*/status"
HDMI_POLL_S=2
# lets the kernel finish reading the new screen's edid and setting its mode before
# uxplay grabs the display again
HOTPLUG_SETTLE_S=2
UXPLAY_UNIT="uxplay.service"

# succeeds if any hdmi connector reports a connected screen
hdmi_connected() {
  local status_file
  for status_file in $HDMI_STATUS_GLOB; do
    if [ -r "$status_file" ] && [ "$(cat "$status_file")" = "connected" ]; then
      return 0
    fi
  done
  return 1
}

# succeeds if a phone is mirroring (uxplay has an established tcp connection)
mirroring_active() {
  ss -Htnp state established 2>/dev/null | grep -q '"uxplay"'
}

wait_for_hdmi() {
  if ! hdmi_connected; then
    echo "no screen on hdmi yet, waiting for one before starting uxplay"
  fi
  until hdmi_connected; do
    sleep "$HDMI_POLL_S"
  done
}

# prints microseconds since boot, the same clock systemd's *TimestampMonotonic uses
uptime_us() {
  awk '{printf "%d\n", $1 * 1000000}' /proc/uptime
}

handle_hotplug() {
  local event_us started_us
  event_us="$(uptime_us)"
  sleep "$HOTPLUG_SETTLE_S"
  if ! hdmi_connected; then
    # unplugged: leave uxplay be. it keeps working when the same screen comes back,
    # and the next connect event restarts it if needed
    return 0
  fi
  if mirroring_active; then
    echo "hdmi changed mid-cast, not restarting uxplay so the cast isn't dropped"
    return 0
  fi
  # while it's still waiting in ExecStartPre it'll notice the screen on its own
  if [ "$(systemctl is-active "$UXPLAY_UNIT")" != "active" ]; then
    return 0
  fi
  # it was waiting for this very screen and started after it appeared, so it already sees it
  started_us="$(systemctl show -p ActiveEnterTimestampMonotonic --value "$UXPLAY_UNIT")"
  if [ "$started_us" -ge "$event_us" ]; then
    return 0
  fi
  echo "screen connected on hdmi, restarting uxplay so it picks it up"
  systemctl restart --no-block "$UXPLAY_UNIT"
}

case "${1:-}" in
  wait) wait_for_hdmi ;;
  hotplug) handle_hotplug ;;
  *)
    echo "usage: $0 wait|hotplug (see the header of this script)" >&2
    exit 2
    ;;
esac
