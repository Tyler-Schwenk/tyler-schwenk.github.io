#!/bin/bash
# installs or updates the speaker agent on displaytop. safe to re-run, and stored clips are kept.
# setup-displaytop.sh calls this on a full rebuild. to update just the agent, from the repo root:
#   scp -r pi/services/speaker-agent tyler@192.168.1.192:~/setup/
#   ssh tyler@192.168.1.192 "sudo bash ~/setup/speaker-agent/install.sh"
#
# see pi/docs/services/speaker-agent.md.
set -euo pipefail

KIOSK_USER="tyler"
INSTALL_DIR="/home/$KIOSK_USER/speaker-agent"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (sudo): it installs a systemd unit." >&2
  exit 1
fi

install -d -o "$KIOSK_USER" -g "$KIOSK_USER" "$INSTALL_DIR"
install -m 755 -o "$KIOSK_USER" -g "$KIOSK_USER" "$SCRIPT_DIR/speaker_agent.py" "$INSTALL_DIR/speaker_agent.py"
install -m 644 "$SCRIPT_DIR/speaker-agent.service" /etc/systemd/system/speaker-agent.service

systemctl daemon-reload
systemctl enable speaker-agent.service >/dev/null
systemctl restart speaker-agent.service
echo "speaker agent running. check it: journalctl -u speaker-agent -n 20 --no-pager"
