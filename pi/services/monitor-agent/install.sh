#!/bin/bash
# installs or updates the monitor agent on one machine. safe to re-run. same script on every
# machine, only the backend url differs. from the repo root on the windows pc:
#
#   scp -r pi/services/monitor-agent tyler@<machine>:~/setup/
#   ssh tyler@<machine> "sudo bash ~/setup/monitor-agent/install.sh [backend-url]"
#
# backend-url defaults to fart-pi on the lan (http://192.168.1.116:8000). on fart-pi itself
# pass http://127.0.0.1:8000. /etc/monitor-agent/token has to hold MONITOR_TOKEN first.
# castpi's sd card is read-only, so turn that off before running this and back on after.
#
# see pi/docs/services/monitor-agent.md.
set -euo pipefail

AGENT_USER="tyler"
TOKEN_FILE="/etc/monitor-agent/token"
AGENT="/usr/local/bin/monitor_agent.py"
UNIT="/etc/systemd/system/monitor-agent.service"
DEFAULT_API_URL="http://192.168.1.116:8000"
RESTART_DELAY_S=10

API_URL="${1:-$DEFAULT_API_URL}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_SRC="$SCRIPT_DIR/monitor_agent.py"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (sudo): it installs a systemd unit." >&2
  exit 1
fi
if [ ! -f "$AGENT_SRC" ]; then
  echo "can't find $AGENT_SRC. copy the whole monitor-agent folder over, not just this script." >&2
  exit 1
fi
if [ ! -s "$TOKEN_FILE" ]; then
  echo "$TOKEN_FILE is missing or empty. put MONITOR_TOKEN from fart-pi's backend .env in it (see the runbook), then re-run." >&2
  exit 1
fi
for tool in python3 lsblk; do
  if ! command -v "$tool" >/dev/null; then
    echo "$tool isn't installed. install it (apt install python3 / util-linux), then re-run." >&2
    exit 1
  fi
done
# raspi-config reports 0 when the read-only overlay is on (castpi). nothing written now would last
if command -v raspi-config >/dev/null && [ "$(raspi-config nonint get_overlay_now)" -eq 0 ]; then
  echo "the sd card is read-only right now, so nothing this script writes would survive a reboot." >&2
  echo "turn it off first: sudo raspi-config nonint disable_overlayfs && sudo reboot, then re-run." >&2
  exit 1
fi

chown "$AGENT_USER:$AGENT_USER" "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
install -m 755 "$AGENT_SRC" "$AGENT"

# StartLimitIntervalSec=0: systemd never gives up restarting it
cat > "$UNIT" <<UNIT_FILE
[Unit]
Description=Monitor Agent
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
ExecStart=/usr/bin/python3 -u $AGENT --api-url $API_URL
Restart=always
RestartSec=$RESTART_DELAY_S
User=$AGENT_USER

[Install]
WantedBy=multi-user.target
UNIT_FILE

systemctl daemon-reload
systemctl enable monitor-agent.service >/dev/null
systemctl restart monitor-agent.service
echo "monitor agent reporting to $API_URL. check it: journalctl -u monitor-agent -n 20 --no-pager"
