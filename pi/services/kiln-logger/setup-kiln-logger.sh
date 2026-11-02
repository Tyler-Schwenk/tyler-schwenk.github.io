#!/bin/bash
# one-shot, idempotent setup that adds the kiln logger to castpi. safe to re-run. run it
# after setup-castpi.sh, which handles wifi retries, the ram journal and so on.
#
# the sd card has to be writable first, and the token has to be in place. see
# pi/docs/services/kiln-logger.md for the full steps. the last step makes the card
# read-only again, from the next boot.
set -euo pipefail

KILN_USER="tyler"
TOKEN_FILE="/etc/kiln-logger/token"
CONFIG_FILE="/boot/firmware/config.txt"
# spi0 with chip select on gpio5 (pin 29)
SPI_OVERLAY_LINE="dtoverlay=spi0-1cs,cs0_pin=5"
RESTART_DELAY_S=5

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGGER_SRC="$SCRIPT_DIR/kiln_logger.py"
LOGGER="/usr/local/bin/kiln_logger.py"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (sudo). it installs a package and writes system config." >&2
  exit 1
fi
if [ ! -f "$LOGGER_SRC" ]; then
  echo "can't find $LOGGER_SRC. copy the whole kiln-logger folder over, not just this script." >&2
  exit 1
fi
if [ ! -s "$TOKEN_FILE" ]; then
  echo "$TOKEN_FILE is missing or empty. put KILN_TOKEN from fart-pi's backend .env in it (see the runbook), then re-run." >&2
  exit 1
fi
# raspi-config reports 0 when the read-only overlay is active
if [ "$(raspi-config nonint get_overlay_now)" -eq 0 ]; then
  echo "the sd card is read-only right now, so nothing this script writes would survive a reboot." >&2
  echo "turn it off first: sudo raspi-config nonint disable_overlayfs && sudo reboot, then re-run." >&2
  exit 1
fi
# /boot/firmware stays read-only (from fstab) even with the overlay off. this remount
# only lasts until the next reboot
mount -o remount,rw /boot/firmware

echo "== packages"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y python3-spidev

echo "== spi on at boot"
if ! grep -qxF "$SPI_OVERLAY_LINE" "$CONFIG_FILE"; then
  printf '\n[all]\n%s\n' "$SPI_OVERLAY_LINE" >> "$CONFIG_FILE"
fi

echo "== token permissions"
chown "$KILN_USER:$KILN_USER" "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

echo "== kiln-logger service"
install -m 755 "$LOGGER_SRC" "$LOGGER"
# no dependency on the network: it samples from boot and buffers until wifi and fart-pi
# are there. StartLimitIntervalSec=0 means systemd never gives up restarting it
cat > /etc/systemd/system/kiln-logger.service <<UNIT
[Unit]
Description=kiln temperature logger
StartLimitIntervalSec=0

[Service]
User=$KILN_USER
SupplementaryGroups=spi
ExecStart=/usr/bin/python3 -u $LOGGER
Restart=always
RestartSec=$RESTART_DELAY_S

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable kiln-logger.service >/dev/null

echo "== read-only sd card (takes effect on reboot, so pulling the plug can't corrupt it)"
raspi-config nonint enable_overlayfs
# enable_bootro appends ",ro" every time it runs, so only call it when it isn't set yet
# (raspi-config reports 0 when it is)
if [ "$(raspi-config nonint get_bootro_conf)" -ne 0 ]; then
  raspi-config nonint enable_bootro
fi

echo "done. reboot to apply: sudo reboot"
