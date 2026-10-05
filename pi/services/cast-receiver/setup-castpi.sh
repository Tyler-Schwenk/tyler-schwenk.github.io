#!/bin/bash
# one-shot, idempotent setup that turns a Raspberry Pi 3B+ on Raspberry Pi OS (Lite) into
# an AirPlay screen mirroring receiver for the opium den tv. safe to re-run.
#
# from the repo root on a machine that can ssh in:
#   scp -r pi/services/cast-receiver tyler@<castpi>:~/
#   ssh -t tyler@<castpi> "sudo ~/cast-receiver/setup-castpi.sh"
#
# the last step makes the sd card read-only (changes live in ram and vanish on reboot),
# so the pi survives being unplugged at any moment. to re-run this script later, turn
# that off first: sudo raspi-config nonint disable_overlayfs && sudo reboot
#
# wifi credentials aren't handled here (they're a secret). see
# pi/docs/services/cast-receiver.md for the one nmcli command that adds them.
set -euo pipefail

CAST_USER="tyler"
CAST_HOSTNAME="castpi"
# what shows up in the iphone's screen mirroring list
AIRPLAY_NAME="Opium Den TV"
# the pi 3's hdmi audio card. the hdmi: alias wraps it in the iec958 conversion the
# vc4 driver needs, so a plain hw: device would play silence
HDMI_AUDIO_DEVICE="hdmi:CARD=vc4hdmi,DEV=0"
# prefer 1080p60 when the screen offers it (a pi 3 can't decode much past that anyway).
# no trailing D, which would force the port on and stop the pi detecting screens
HDMI_VIDEO_ARG="video=HDMI-A-1:1920x1080@60"
# extra kernel args: no blinking cursor, no raspberry logos, and never blank the console
# (the tv just shows black between casts)
QUIET_CMDLINE_ARGS=(vt.global_cursor_default=0 logo.nologo consoleblank=0)
CMDLINE_FILE="/boot/firmware/cmdline.txt"
# logs live in ram only (the sd card is read-only anyway), capped so they can't eat it
JOURNAL_RUNTIME_MAX_USE="30M"
# short, so a crash mid-cast costs a phone only a second or two before it can reconnect
UXPLAY_RESTART_DELAY_S=1
SPLASH_RESTART_DELAY_S=5

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HDMI_HELPER_SRC="$SCRIPT_DIR/castpi-hdmi.sh"
HDMI_HELPER="/usr/local/bin/castpi-hdmi.sh"
HDMI_UDEV_RULE="/etc/udev/rules.d/90-castpi-hdmi.rules"
SPLASH_SRC="$SCRIPT_DIR/castpi_splash.py"
SPLASH="/usr/local/bin/castpi_splash.py"

PACKAGES=(
  uxplay avahi-daemon avahi-utils alsa-utils overlayroot
  gstreamer1.0-libav gstreamer1.0-plugins-base gstreamer1.0-plugins-good
  gstreamer1.0-plugins-bad gstreamer1.0-alsa gstreamer1.0-tools
  python3-pil fonts-dejavu-core
)
# left over from when this pi was the display kiosk (displaypi)
OLD_KIOSK_PACKAGES=(chromium mpv openbox unclutter xinit xserver-xorg-core labwc)
OLD_KIOSK_FILES=(kiosk-run.sh kiosk-run.sh.bak surfcam-agent .xinitrc .config/openbox .config/labwc .config/chromium)
CAST_HOME="/home/$CAST_USER"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (sudo). it installs packages and writes system config." >&2
  exit 1
fi
if ! id "$CAST_USER" >/dev/null 2>&1; then
  echo "user $CAST_USER doesn't exist. create it in raspberry pi imager's settings when flashing, then re-run." >&2
  exit 1
fi
for helper_src in "$HDMI_HELPER_SRC" "$SPLASH_SRC"; do
  if [ ! -f "$helper_src" ]; then
    echo "can't find $helper_src. copy the whole cast-receiver folder over, not just this script (see header)." >&2
    exit 1
  fi
done
# raspi-config reports 0 when the read-only overlay is active
if [ "$(raspi-config nonint get_overlay_now)" -eq 0 ]; then
  echo "the sd card is read-only right now, so nothing this script writes would survive a reboot." >&2
  echo "turn it off first: sudo raspi-config nonint disable_overlayfs && sudo reboot, then re-run." >&2
  exit 1
fi
# /boot/firmware stays read-only (from fstab) even with the overlay off, and the kernel
# command line lives there. this remount only lasts until the next reboot
mount -o remount,rw /boot/firmware

echo "== passwordless sudo for $CAST_USER (so the pi can be maintained over ssh)"
sudoers_file="/etc/sudoers.d/$CAST_USER-nopasswd"
echo "$CAST_USER ALL=(ALL) NOPASSWD:ALL" > "$sudoers_file.tmp"
# visudo validates first: a broken sudoers file would lock sudo out entirely
visudo -cf "$sudoers_file.tmp" >/dev/null
install -m 440 "$sudoers_file.tmp" "$sudoers_file"
rm -f "$sudoers_file.tmp"

echo "== hostname $CAST_HOSTNAME"
# pi os runs cloud-init, which would put the imager's hostname back on a later boot
install -d /etc/cloud/cloud.cfg.d
echo "preserve_hostname: true" > /etc/cloud/cloud.cfg.d/99-preserve-hostname.cfg
hostnamectl set-hostname "$CAST_HOSTNAME"
if grep -q '^127\.0\.1\.1' /etc/hosts; then
  sed -i "s/^127\.0\.1\.1.*/127.0.1.1\t$CAST_HOSTNAME/" /etc/hosts
else
  printf '127.0.1.1\t%s\n' "$CAST_HOSTNAME" >> /etc/hosts
fi

echo "== remove the old display kiosk (autologin, x session, browser)"
rm -rf /etc/systemd/system/getty@tty1.service.d
rm -f "$CAST_HOME/.bash_profile"
for old_file in "${OLD_KIOSK_FILES[@]}"; do
  rm -rf "${CAST_HOME:?}/$old_file"
done
installed_old_packages=()
for pkg in "${OLD_KIOSK_PACKAGES[@]}"; do
  if dpkg -s "$pkg" >/dev/null 2>&1; then
    installed_old_packages+=("$pkg")
  fi
done
if [ "${#installed_old_packages[@]}" -gt 0 ]; then
  DEBIAN_FRONTEND=noninteractive apt-get purge -y "${installed_old_packages[@]}"
fi

echo "== packages"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y "${PACKAGES[@]}"
DEBIAN_FRONTEND=noninteractive apt-get autoremove --purge -y

echo "== kernel command line: quiet console, detect hdmi screens instead of forcing one"
# uxplay draws straight to the screen with kmssink, so nothing needs a console on tty1.
# boot messages still go to the serial console and the journal
systemctl mask getty@tty1.service
sed -i 's/ *console=tty1//' "$CMDLINE_FILE"
sed -i 's/ *video=HDMI-A-1:[^ ]*//' "$CMDLINE_FILE"
for arg in "$HDMI_VIDEO_ARG" "${QUIET_CMDLINE_ARGS[@]}"; do
  if ! grep -qF -- " $arg" "$CMDLINE_FILE"; then
    sed -i "1 s/\$/ $arg/" "$CMDLINE_FILE"
  fi
done

echo "== network: no wifi power saving, retry wifi forever, keep cloud-init off our config"
# wifi power save adds latency spikes, which show up as stutter while mirroring
cat > /etc/NetworkManager/conf.d/wifi-powersave-off.conf <<'EOF'
[connection]
wifi.powersave = 2
EOF
echo "network: {config: disabled}" > /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
# networkmanager gives up after 4 tries by default. after a power cut the router takes
# minutes to come back, so the pi would boot, give up, and sit offline
wifi_connections="$(nmcli -t -f NAME,TYPE connection show | awk -F: '$2 == "802-11-wireless" {print $1}')"
while IFS= read -r wifi_con; do
  if [ -n "$wifi_con" ]; then
    nmcli connection modify "$wifi_con" connection.autoconnect yes connection.autoconnect-retries 0
  fi
done <<< "$wifi_connections"

echo "== hdmi hotplug helper"
install -m 755 "$HDMI_HELPER_SRC" "$HDMI_HELPER"
# drm change events fire when a screen is plugged in or unplugged
cat > "$HDMI_UDEV_RULE" <<EOF
ACTION=="change", SUBSYSTEM=="drm", KERNEL=="card[0-9]*", RUN+="/usr/bin/systemd-run --no-block --collect --unit=castpi-hdmi-hotplug-\$env{SEQNUM} $HDMI_HELPER hotplug"
EOF
udevadm control --reload

echo "== uxplay airplay receiver service"
# video: v4l2h264dec is the pi's hardware decoder (software can't keep up on a pi 3), and
# kmssink draws its output straight to hdmi with no x or wayland, scaling in hardware.
#   -bt709        iphones tag their stream as full-range color, which the pi's decoder
#                 rejects (not-negotiated). this relabels it as plain bt709
#   -vc identity  no converter. uxplay's -v4l2 default puts v4l2convert (the pi's isp)
#                 between decoder and screen, and it fails whenever the phone rotates
#                 and the video size changes mid-stream
# -nohold lets whoever casts next take over instead of being refused while someone else
# is still connected. it waits for a screen first since kmssink can't open the display
# without one
cat > /etc/systemd/system/uxplay.service <<EOF
[Unit]
Description=UxPlay AirPlay mirroring receiver ($AIRPLAY_NAME)
Wants=network-online.target avahi-daemon.service
After=network-online.target avahi-daemon.service
StartLimitIntervalSec=0

[Service]
User=$CAST_USER
SupplementaryGroups=video render audio
ExecStartPre=$HDMI_HELPER wait
TimeoutStartSec=infinity
ExecStart=/usr/bin/uxplay -n "$AIRPLAY_NAME" -nh -vd v4l2h264dec -vc identity -bt709 -vs kmssink -as "alsasink device=$HDMI_AUDIO_DEVICE" -nohold
Restart=always
RestartSec=$UXPLAY_RESTART_DELAY_S

[Install]
WantedBy=multi-user.target
EOF

echo "== idle splash screen (status on the tv while nothing's casting)"
install -m 755 "$SPLASH_SRC" "$SPLASH"
cat > /etc/systemd/system/castpi-splash.service <<EOF
[Unit]
Description=castpi idle splash screen
After=uxplay.service

[Service]
User=$CAST_USER
SupplementaryGroups=video
ExecStart=/usr/bin/python3 $SPLASH
Restart=always
RestartSec=$SPLASH_RESTART_DELAY_S

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable avahi-daemon.service uxplay.service castpi-splash.service >/dev/null

echo "== ssh: keys only (skipped if no key is installed, so we can't lock ourselves out)"
authorized_keys="$CAST_HOME/.ssh/authorized_keys"
if [ -s "$authorized_keys" ]; then
  # 10- sorts before any later drop-in, and sshd takes the first value it sees
  cat > /etc/ssh/sshd_config.d/10-castpi.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
  sshd -t
  systemctl reload ssh
else
  echo "no $authorized_keys yet, leaving password ssh login on. add your key (see the runbook) and re-run." >&2
fi

echo "== journal in ram only"
install -d /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/castpi.conf <<EOF
[Journal]
Storage=volatile
RuntimeMaxUse=$JOURNAL_RUNTIME_MAX_USE
EOF
systemctl restart systemd-journald

if ! nmcli -t -f TYPE connection show | grep -q '802-11-wireless'; then
  echo "no wifi connection saved yet. add one before moving the pi off ethernet (see the runbook)." >&2
fi

echo "== read-only sd card (takes effect on reboot, so pulling the plug can't corrupt it)"
# root becomes a ram overlay on top of the card and /boot/firmware is mounted read-only.
# the hardware watchdog (pi os default, 1 min) already reboots the pi if it hangs
raspi-config nonint enable_overlayfs
# enable_bootro appends ",ro" every time it runs, so only call it when it isn't set yet
# (raspi-config reports 0 when it is)
if [ "$(raspi-config nonint get_bootro_conf)" -ne 0 ]; then
  raspi-config nonint enable_bootro
fi

echo "done. reboot to apply: sudo reboot"
