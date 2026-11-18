# Monitor Agent

Each house machine reports its own storage, memory, cpu and temperature to the backend, for
`tyler-schwenk.com/monitor` and the system monitor slot on the display kiosk
(`website/docs/MONITOR.md`). Code: `pi/services/monitor-agent/monitor_agent.py`.

```
monitor-agent.service on each machine -> PUT /monitor/report (every 30 s) -> backend (memory) -> GET /monitor -> /monitor page, display
```

| Machine | Backend URL it reports to | Notes |
|---------|---------------------------|-------|
| fart-pi | `http://127.0.0.1:8000` | the backend's on the same Pi |
| displaytop | `http://192.168.1.116:8000` (the default) | |
| castpi | `http://192.168.1.116:8000` (the default) | read-only SD card, see Setup |

Beszel (`beszel.md`) also watches fart-pi, with history graphs, but only fart-pi and only on the
LAN. This covers every machine and feeds the public page.

## What it reports

Every 30 s (`REPORT_INTERVAL_S`), one JSON report, named by the machine's hostname. The shape is
in `pi/docs/api/website-backend-api.md` ("Monitor").

- **Storage**, per physical disk, from `lsblk`: every partition in order. A mounted filesystem
  gets its used and available space from `statvfs`, counted like `df` (used + available is a
  bit under the partition's size, since ext4 keeps ~5% back for root). Space nothing uses is
  reported too:
  - `unmounted`: a partition with nothing mounted (fart-pi's SSD has a 207 GB NTFS one)
  - `unallocated`: space in an LVM volume group with no logical volume (displaytop's root
    volume only takes about half its NVMe; Ubuntu's installer leaves the rest)
  - `unpartitioned`: the end of a disk no partition covers
  - Gaps under 1 GB (`MIN_GAP_BYTES`) are partition alignment and get left out
  - RAM disks, loop mounts (snaps) and zram swap aren't disks and get skipped. Swap partitions
    show as `swap`
- **Memory**: `/proc/meminfo`. "Available" counts reclaimable cache, so it's the real free
  memory, not `MemFree`
- **CPU**: core count, load averages, and how busy it was since the last report (`/proc/stat`,
  null on the first report)
- **Temperature**: the `cpu-thermal` zone on a Pi, `x86_pkg_temp` on displaytop, null if
  neither exists
- **Battery** (displaytop): charge and whether the charger's in. The kernel's status word is
  sent too, but the page doesn't use it, since displaytop says "Discharging" at 100% on the
  charger
- **Model and uptime**

It only reads: nothing's written to disk, and a failed push is just logged (the next one is
30 s away, and old stats aren't worth catching up on).

The backend keeps the newest report per hostname in memory (`app/monitor.py`). A machine counts
as online if it reported in the last 2 min (`DEVICE_ONLINE_WINDOW_S`). One that stops reporting
stays listed, marked offline with its last numbers, until the backend restarts. A backend
restart forgets every machine until its next report, 30 s at most.

## Setup

The agent is stdlib Python plus `lsblk`, which every Linux install has. Same script and install
on every machine.

**1. The shared secret, on fart-pi** (once):

```bash
cd ~/tyler-schwenk.github.io/pi/services/website-backend
grep -q '^MONITOR_TOKEN=.' .env || echo "MONITOR_TOKEN=$(openssl rand -hex 32)" >> .env
docker compose up -d
grep '^MONITOR_TOKEN=' .env | cut -d= -f2   # copy this for the other machines
```

**2. Each machine.** Put the token in `/etc/monitor-agent/token`, copy the folder over, and run
the install script. From the repo root on the Windows PC:

```bash
# fart-pi (reports to itself)
ssh tyler@192.168.1.116 "sudo mkdir -p /etc/monitor-agent && grep '^MONITOR_TOKEN=' ~/tyler-schwenk.github.io/pi/services/website-backend/.env | cut -d= -f2 | sudo tee /etc/monitor-agent/token >/dev/null"
scp -r pi/services/monitor-agent tyler@192.168.1.116:~/setup/
ssh tyler@192.168.1.116 "sudo bash ~/setup/monitor-agent/install.sh http://127.0.0.1:8000"

# displaytop
ssh tyler@192.168.1.192 "sudo mkdir -p /etc/monitor-agent && echo <token> | sudo tee /etc/monitor-agent/token >/dev/null"
scp -r pi/services/monitor-agent tyler@192.168.1.192:~/setup/
ssh tyler@192.168.1.192 "sudo bash ~/setup/monitor-agent/install.sh"
```

**castpi** has a read-only SD card (`cast-receiver.md`), so turn that off first and back on after:

```bash
ssh tyler@192.168.1.114 "sudo raspi-config nonint disable_overlayfs && sudo reboot"
# wait ~30 s
ssh tyler@192.168.1.114 "sudo mkdir -p /etc/monitor-agent && echo <token> | sudo tee /etc/monitor-agent/token >/dev/null"
scp -r pi/services/monitor-agent tyler@192.168.1.114:~/setup/
ssh tyler@192.168.1.114 "sudo bash ~/setup/monitor-agent/install.sh"
ssh tyler@192.168.1.114 "sudo raspi-config nonint enable_overlayfs && sudo reboot"
```

The install script refuses to run while castpi's card is read-only, since nothing it wrote would
survive a reboot. It installs the agent as `/usr/local/bin/monitor_agent.py` and
`monitor-agent.service`, and is safe to re-run. Updates are the same `scp` and install (castpi
needs the overlay off again); `pi/scripts/deploy.sh` doesn't handle it.

**Check it:** `journalctl -u monitor-agent -n 20 --no-pager` says "reporting as <name> to ...",
and the machine shows up on `/monitor` within 30 s.

**See what it would send**, without sending anything (works on any machine, no install needed):

```bash
ssh tyler@<machine> 'python3 - --print' < pi/services/monitor-agent/monitor_agent.py
```

## Adding a machine

Any Linux machine on the LAN works: run step 2 on it. It appears on the page under its hostname.
To give it a role line and a place in the order, add it to `DEVICE_ROLES` in
`website/app/monitor/monitorFormat.ts` (unknown machines go last, by name). A machine off the LAN
can report to `https://api.tyler-schwenk.com` instead (`install.sh https://api.tyler-schwenk.com`).

Renaming a machine leaves the old name listed as offline until the backend restarts.

## Troubleshooting

- **`backend refused the report: HTTP 401`**: `/etc/monitor-agent/token` doesn't match
  `MONITOR_TOKEN` in the backend's `.env`. Copy it over again and `sudo systemctl restart monitor-agent`.
- **`HTTP 503`**: `MONITOR_TOKEN` isn't set on the backend. Set it and run `docker compose up -d`.
- **`HTTP 422`**: the report didn't fit the backend's schema (an agent newer or older than the
  backend). Deploy both from the same commit.
- **`can't reach the backend`**: fart-pi's down, website-backend isn't running (`docker ps`), or
  the machine's off the LAN.
- **`can't read disks: lsblk failed`**: `util-linux` is missing. The rest of the report still goes out.
- **A machine shows "offline"**: it's off, asleep, or the agent stopped. Check
  `systemctl status monitor-agent` on it.
