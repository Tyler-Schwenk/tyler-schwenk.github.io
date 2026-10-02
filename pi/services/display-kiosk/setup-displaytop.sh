#!/bin/bash
# one-shot, idempotent setup that turns a fresh Ubuntu Server install on displaytop
# (Surface Laptop 3) into the display kiosk. safe to re-run.
#
# from the repo root on a machine that can ssh in:
#   scp -r pi/services/display-kiosk pi/services/surfcam-agent tyler@<displaytop>:~/setup/
#   ssh tyler@<displaytop> "sudo ~/setup/display-kiosk/setup-displaytop.sh"
#
# see pi/docs/services/display-kiosk.md for what each piece does.
set -euo pipefail

KIOSK_USER="tyler"
TIMEZONE="America/Los_Angeles"
SITE_ORIGIN="https://tyler-schwenk.com"
CHROME_DEB_URL="https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
CHROME_POLICY_DIR="/etc/opt/chrome/policies/managed"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_SRC="$SCRIPT_DIR/../surfcam-agent/surfcam_agent.py"
KIOSK_HOME="/home/$KIOSK_USER"

PACKAGES=(
  xserver-xorg xinit openbox x11-xserver-utils unclutter
  mpv intel-media-va-driver vainfo fonts-noto-color-emoji scrot
  python3 curl iw
)

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (sudo). it installs packages and writes system config." >&2
  exit 1
fi
if [ ! -f "$AGENT_SRC" ]; then
  echo "can't find $AGENT_SRC. copy both display-kiosk/ and surfcam-agent/ into the same folder first (see header)." >&2
  exit 1
fi

# writes a file owned by the kiosk user. parents are created as the user too, since
# `install -d` would leave new intermediate dirs (like ~/.config) owned by root and
# chrome then can't create its profile there
install_user_file() {
  local mode="$1" src="$2" dest="$3"
  sudo -u "$KIOSK_USER" mkdir -p "$(dirname "$dest")"
  install -m "$mode" -o "$KIOSK_USER" -g "$KIOSK_USER" "$src" "$dest"
}

echo "== timezone (the overnight sleep window uses local time)"
timedatectl set-timezone "$TIMEZONE"

echo "== packages"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y "${PACKAGES[@]}"

echo "== google chrome (chromium is snap-only on ubuntu)"
if ! command -v google-chrome-stable >/dev/null; then
  chrome_deb="$(mktemp --suffix=.deb)"
  curl -fsSL -o "$chrome_deb" "$CHROME_DEB_URL"
  DEBIAN_FRONTEND=noninteractive apt-get install -y "$chrome_deb"
  rm -f "$chrome_deb"
fi

echo "== chrome policy: let the site call the surfcam agent on localhost without a permission prompt"
install -d "$CHROME_POLICY_DIR"
cat > "$CHROME_POLICY_DIR/surfcam.json" <<EOF
{"LocalNetworkAccessAllowedForUrls": ["$SITE_ORIGIN"]}
EOF

echo "== autologin on tty1 -> startx -> openbox -> ~/kiosk-run.sh"
install -d /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF

bash_profile="$(mktemp)"
cat > "$bash_profile" <<'EOF'
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx
fi
EOF
install_user_file 644 "$bash_profile" "$KIOSK_HOME/.bash_profile"

xinitrc="$(mktemp)"
echo "exec openbox-session" > "$xinitrc"
install_user_file 644 "$xinitrc" "$KIOSK_HOME/.xinitrc"

autostart="$(mktemp)"
cat > "$autostart" <<'EOF'
xset s off
xset s noblank
xset -dpms
unclutter -idle 0.5 -root &

~/kiosk-run.sh &
EOF
install_user_file 644 "$autostart" "$KIOSK_HOME/.config/openbox/autostart"
rm -f "$bash_profile" "$xinitrc" "$autostart"

install_user_file 755 "$SCRIPT_DIR/kiosk-run.sh" "$KIOSK_HOME/kiosk-run.sh"
install_user_file 755 "$AGENT_SRC" "$KIOSK_HOME/surfcam-agent/surfcam_agent.py"

echo "== laptop: never suspend, ignore the lid (it runs closed, plugged in)"
install -d /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/kiosk.conf <<EOF
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
IdleAction=ignore
EOF
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

echo "== network: keep our wifi config, and turn off wifi power saving"
# without this cloud-init can regenerate /etc/netplan/50-cloud-init.yaml on a later boot
# and wipe the wifi credentials, leaving the laptop unreachable
install -d /etc/cloud/cloud.cfg.d
echo "network: {config: disabled}" > /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg

# wifi power save adds latency and can drop idle connections; this is a streaming kiosk
cat > /etc/systemd/system/wifi-powersave-off.service <<'EOF'
[Unit]
Description=Turn off Wi-Fi power saving
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'for d in /sys/class/net/*/wireless; do iw dev "$(basename "$(dirname "$d")")" set power_save off; done'

[Install]
WantedBy=multi-user.target
EOF
systemctl enable wifi-powersave-off.service >/dev/null

systemctl daemon-reload
systemctl restart wifi-powersave-off.service
echo "done. reboot to start the kiosk: sudo reboot"
