#!/bin/bash
# one-shot, idempotent setup that turns a fresh Ubuntu Server install on displaytop
# (Surface Laptop 3) into the display kiosk. safe to re-run.
#
# from the repo root on a machine that can ssh in (-t lets sudo ask for the password the
# first time; after this run sudo is passwordless):
#   scp -r pi/services/display-kiosk pi/services/surfcam-agent tyler@<displaytop>:~/setup/
#   ssh -t tyler@<displaytop> "sudo ~/setup/display-kiosk/setup-displaytop.sh"
#
# see pi/docs/services/display-kiosk.md for what each piece does.
set -euo pipefail

KIOSK_USER="tyler"
TIMEZONE="America/Los_Angeles"
SITE_ORIGIN="https://tyler-schwenk.com"
CHROME_DEB_URL="https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
CHROME_POLICY_DIR="/etc/opt/chrome/policies/managed"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_SRC_DIR="$SCRIPT_DIR/../surfcam-agent"
AGENT_FILES=(surfcam_agent.py surf_conditions.py)
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
if [ ! -f "$AGENT_SRC_DIR/${AGENT_FILES[0]}" ]; then
  echo "can't find $AGENT_SRC_DIR/${AGENT_FILES[0]}. copy both display-kiosk/ and surfcam-agent/ into the same folder first (see header)." >&2
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

echo "== passwordless sudo for $KIOSK_USER (so the kiosk can be maintained over ssh)"
sudoers_file="/etc/sudoers.d/$KIOSK_USER-nopasswd"
echo "$KIOSK_USER ALL=(ALL) NOPASSWD:ALL" > "$sudoers_file.tmp"
# visudo validates first: a broken sudoers file would lock sudo out entirely
visudo -cf "$sudoers_file.tmp" >/dev/null
install -m 440 "$sudoers_file.tmp" "$sudoers_file"
rm -f "$sudoers_file.tmp"

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
for agent_file in "${AGENT_FILES[@]}"; do
  install_user_file 755 "$AGENT_SRC_DIR/$agent_file" "$KIOSK_HOME/surfcam-agent/$agent_file"
done

echo "== laptop: never suspend, ignore the lid (it runs open and plugged in; closing it changes nothing)"
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

echo "== unattended updates (security patches, including Chrome, with a 03:00 reboot)"
# an always-on browser on the internet needs patching without anyone around. 03:00 is
# inside the overnight sleep window, and kiosk-run.sh stays asleep after the reboot until
# 06:00. WithUsers is required because the autologin session counts as a logged-in user
cat > /etc/apt/apt.conf.d/52kiosk-unattended <<'EOF'
Unattended-Upgrade::Origins-Pattern:: "origin=Google LLC,archive=stable";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
EOF

echo "== ssh: keys only (skipped if no key is installed, so we can't lock ourselves out)"
authorized_keys="$KIOSK_HOME/.ssh/authorized_keys"
if [ -s "$authorized_keys" ]; then
  # 10- sorts before cloud-init's 50- file, and sshd takes the first value it sees
  cat > /etc/ssh/sshd_config.d/10-kiosk.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
  sshd -t
  systemctl reload ssh
else
  echo "no $authorized_keys yet, leaving password ssh login on. add your key (see the runbook) and re-run." >&2
fi

echo "== disable services a kiosk doesn't use, and cap the journal"
# modem manager and multipath have no hardware here, packagekit is a desktop updater
systemctl mask --now ModemManager.service multipathd.service multipathd.socket packagekit.service
install -d /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/kiosk.conf <<'EOF'
[Journal]
SystemMaxUse=200M
EOF
systemctl restart systemd-journald

systemctl daemon-reload
systemctl restart wifi-powersave-off.service
echo "done. reboot to start the kiosk: sudo reboot"
