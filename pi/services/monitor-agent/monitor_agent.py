"""monitor agent: reports this machine's storage, memory, cpu and temperature.

runs as a systemd service on each house machine (fart-pi, displaytop, castpi). every 30 s
it reads its stats and pushes them to the website backend, which shows them on
tyler-schwenk.com/monitor and the display. nothing's written to disk.

storage is reported per physical disk, partition by partition, so space that isn't in
use shows up too: a partition nobody mounted, unallocated lvm space, or the end of a disk
no partition covers.

see pi/docs/services/monitor-agent.md.

usage:
    python3 monitor_agent.py                       run the agent
    python3 monitor_agent.py --api-url URL         push somewhere else (default: fart-pi on the lan)
    python3 monitor_agent.py --print               print one report as json and exit, sends nothing

stdlib only, plus lsblk (util-linux), which every linux install has.
"""

import argparse
import json
import logging
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("monitor-agent")


# ---- config ----

TOKEN_PATH = Path("/etc/monitor-agent/token")
# fart-pi's ethernet address. fart-pi itself passes --api-url http://127.0.0.1:8000
DEFAULT_API_URL = "http://192.168.1.116:8000"
REPORT_PATH = "/monitor/report"
REPORT_INTERVAL_S = 30
REQUEST_TIMEOUT_S = 10
LSBLK_TIMEOUT_S = 10
# how long --print measures the cpu over
PRINT_CPU_SAMPLE_S = 1

# leftover space smaller than this is just partition alignment, not worth showing
MIN_GAP_BYTES = 1024**3

# block devices that aren't real disks: ram disks, loop mounts (snaps), compressed swap in ram
SKIPPED_DISK_PREFIXES = ("loop", "ram", "zram")
# what lsblk shows as the mount point of active swap
SWAP_MOUNT = "[SWAP]"

# the cpu temperature sensor on a pi, then on intel laptops. anything else gets no temperature
PREFERRED_THERMAL_TYPES = ("cpu-thermal", "x86_pkg_temp")
MILLIDEGREES_PER_DEGREE = 1000

KIB = 1024
MS_PER_S = 1000

MODEL_PATHS = (Path("/proc/device-tree/model"), Path("/sys/class/dmi/id/product_name"))
THERMAL_DIR = Path("/sys/class/thermal")
POWER_SUPPLY_DIR = Path("/sys/class/power_supply")


# ---- small readers ----

def read_text(path: Path) -> str | None:
    """read a small sysfs/procfs file.

    Args:
        path: the file.

    Returns:
        its contents, stripped (device tree strings end in a nul), or None if it can't be read.
    """
    try:
        return path.read_text().strip().strip("\x00")
    except OSError:
        return None


def read_model() -> str | None:
    """what kind of machine this is, like "Raspberry Pi 5 Model B Rev 1.1".

    Returns:
        the model, or None if the device tree and dmi don't say.
    """
    for path in MODEL_PATHS:
        model = read_text(path)
        if model:
            return model
    return None


def read_uptime_s() -> float:
    """seconds since boot.

    Returns:
        uptime from /proc/uptime.
    """
    return float(Path("/proc/uptime").read_text().split()[0])


def read_meminfo() -> dict[str, int]:
    """memory and swap, in bytes.

    available is what the kernel says programs can still get without swapping, which counts
    reclaimable cache. that's the honest "free", plain MemFree looks scarier than it is.

    Returns:
        `{"total_bytes", "available_bytes", "swap_total_bytes", "swap_free_bytes"}`.
    """
    values = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        key, _, rest = line.partition(":")
        values[key] = int(rest.split()[0]) * KIB
    return {
        "total_bytes": values["MemTotal"],
        "available_bytes": values["MemAvailable"],
        "swap_total_bytes": values.get("SwapTotal", 0),
        "swap_free_bytes": values.get("SwapFree", 0),
    }


def read_cpu_times() -> tuple[int, int]:
    """the cpu's busy and total time since boot, all cores together.

    Returns:
        (busy jiffies, total jiffies). iowait counts as idle.
    """
    fields = [int(value) for value in Path("/proc/stat").read_text().splitlines()[0].split()[1:]]
    idle = fields[3] + fields[4]
    total = sum(fields)
    return total - idle, total


def cpu_usage_pct(previous: tuple[int, int] | None, current: tuple[int, int]) -> float | None:
    """how busy the cpu was between two samples.

    Args:
        previous: the last (busy, total) sample, None on the first report.
        current: the (busy, total) sample now.

    Returns:
        percent busy, or None with nothing to compare to.
    """
    if previous is None:
        return None
    total_delta = current[1] - previous[1]
    if total_delta <= 0:
        return None
    return round(100 * (current[0] - previous[0]) / total_delta, 1)


def read_temperature_c() -> float | None:
    """the cpu temperature.

    Returns:
        degrees c from the first preferred sensor found, or None if there's none.
    """
    zones = {}
    for zone in sorted(THERMAL_DIR.glob("thermal_zone*")):
        zone_type = read_text(zone / "type")
        if zone_type and zone_type not in zones:
            zones[zone_type] = zone
    for zone_type in PREFERRED_THERMAL_TYPES:
        raw = read_text(zones[zone_type] / "temp") if zone_type in zones else None
        if raw:
            return round(int(raw) / MILLIDEGREES_PER_DEGREE, 1)
    return None


def read_battery() -> dict | None:
    """the battery, on machines that have one.

    Returns:
        `{"percent", "status", "on_power"}` (status as the kernel says it: "Charging",
        "Discharging", "Full", "Not charging"), or None with no battery.
    """
    supplies = sorted(POWER_SUPPLY_DIR.glob("*"))
    battery = next((path for path in supplies if read_text(path / "type") == "Battery"), None)
    if battery is None:
        return None
    capacity = read_text(battery / "capacity")
    on_power = any(
        read_text(path / "type") == "Mains" and read_text(path / "online") == "1" for path in supplies
    )
    return {
        "percent": int(capacity) if capacity else None,
        "status": read_text(battery / "status"),
        "on_power": on_power,
    }


# ---- storage ----

def list_block_devices() -> list[dict]:
    """the block device tree, from lsblk.

    Returns:
        lsblk's top-level devices, each with nested "children".

    Raises:
        RuntimeError: if lsblk can't run or its output isn't json.
    """
    command = [
        "lsblk", "--json", "--bytes",
        "--output", "NAME,TYPE,SIZE,FSTYPE,MOUNTPOINT,MODEL,TRAN",
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=LSBLK_TIMEOUT_S, check=True)
        return json.loads(result.stdout)["blockdevices"]
    except (OSError, subprocess.SubprocessError, ValueError, KeyError) as exc:
        raise RuntimeError(f"lsblk failed ({exc}): is util-linux installed?") from exc


def filesystem_usage(mount: str) -> dict:
    """how full a mounted filesystem is, like df.

    used + available is less than the filesystem's size: ext4 keeps ~5% back for root.

    Args:
        mount: where it's mounted.

    Returns:
        `{"used_bytes", "available_bytes"}`, both None if it can't be read.
    """
    try:
        stats = os.statvfs(mount)
    except OSError as exc:
        logger.warning("can't read usage of %s (%s), reporting its size only", mount, exc)
        return {"used_bytes": None, "available_bytes": None}
    return {
        "used_bytes": (stats.f_blocks - stats.f_bfree) * stats.f_frsize,
        "available_bytes": stats.f_bavail * stats.f_frsize,
    }


def leaf_volume(node: dict) -> dict:
    """one partition (or lvm volume, or whole-disk filesystem) with nothing inside it.

    Args:
        node: its lsblk entry.

    Returns:
        the volume: name, size, fstype, mount, kind, and usage if it's a mounted filesystem.
    """
    mount = node.get("mountpoint")
    volume = {
        "name": node["name"],
        "size_bytes": node["size"],
        "fstype": node.get("fstype"),
        "mount": None,
        "kind": "unmounted",
        "used_bytes": None,
        "available_bytes": None,
    }
    if mount == SWAP_MOUNT:
        volume["kind"] = "swap"
    elif mount:
        volume.update({"kind": "filesystem", "mount": mount, **filesystem_usage(mount)})
    return volume


def gap_volume(name: str, kind: str, gap_bytes: int) -> dict:
    """space inside a container that nothing uses.

    Args:
        name: what it's inside of, like "nvme0n1p3".
        kind: "unallocated" (free lvm/container space) or "unpartitioned" (end of a disk).
        gap_bytes: how big it is.

    Returns:
        the volume.
    """
    return {
        "name": name,
        "size_bytes": gap_bytes,
        "fstype": None,
        "mount": None,
        "kind": kind,
        "used_bytes": None,
        "available_bytes": None,
    }


def flatten_volumes(node: dict, gap_kind: str) -> list[dict]:
    """everything inside a disk or container, leaves first, then any space left over.

    lvm volumes show up as children of their partition, so a partition that's an lvm
    physical volume turns into its logical volumes plus its unallocated space.

    Args:
        node: lsblk entry for a disk or a partition.
        gap_kind: what to call leftover space at this level.

    Returns:
        its volumes, in lsblk order.
    """
    children = node.get("children") or []
    if not children:
        return [leaf_volume(node)]
    volumes = []
    for child in children:
        volumes.extend(flatten_volumes(child, "unallocated"))
    gap_bytes = node["size"] - sum(child["size"] for child in children)
    if gap_bytes >= MIN_GAP_BYTES:
        volumes.append(gap_volume(node["name"], gap_kind, gap_bytes))
    return volumes


def read_disks() -> list[dict]:
    """every physical disk and what's on it.

    Returns:
        each disk: `{"name", "model", "transport", "size_bytes", "volumes"}`. empty
        drives (a card reader with no card) are left out.
    """
    disks = []
    for device in list_block_devices():
        if device.get("type") != "disk" or device["name"].startswith(SKIPPED_DISK_PREFIXES):
            continue
        if not device.get("size"):
            continue
        disks.append({
            "name": device["name"],
            "model": (device.get("model") or "").strip() or None,
            "transport": device.get("tran"),
            "size_bytes": device["size"],
            "volumes": flatten_volumes(device, "unpartitioned"),
        })
    return disks


# ---- reporting ----

def build_report(previous_cpu: tuple[int, int] | None) -> tuple[dict, tuple[int, int]]:
    """read everything for one report.

    Args:
        previous_cpu: the cpu sample from the last report, None on the first.

    Returns:
        (the report, this report's cpu sample for next time).
    """
    cpu_now = read_cpu_times()
    load_1m, load_5m, load_15m = os.getloadavg()
    try:
        disks = read_disks()
    except RuntimeError as exc:
        logger.error("can't read disks: %s", exc)
        disks = []
    report = {
        "name": socket.gethostname(),
        "model": read_model(),
        "uptime_s": round(read_uptime_s()),
        "cpu": {
            "cores": os.cpu_count() or 1,
            "usage_pct": cpu_usage_pct(previous_cpu, cpu_now),
            "load_1m": round(load_1m, 2),
            "load_5m": round(load_5m, 2),
            "load_15m": round(load_15m, 2),
        },
        "temperature_c": read_temperature_c(),
        "memory": read_meminfo(),
        "battery": read_battery(),
        "disks": disks,
    }
    return report, cpu_now


def read_token(path: Path = TOKEN_PATH) -> str:
    """read the shared secret the backend expects.

    Args:
        path: file holding MONITOR_TOKEN from the backend's .env.

    Returns:
        the token.

    Raises:
        ValueError: if the file's missing or empty.
    """
    try:
        token = path.read_text().strip()
    except OSError as exc:
        raise ValueError(f"can't read {path} ({exc}): put MONITOR_TOKEN from the backend's .env in it") from exc
    if not token:
        raise ValueError(f"{path} is empty: put MONITOR_TOKEN from the backend's .env in it")
    return token


def push_report(report: dict, url: str, token: str) -> None:
    """send one report to the backend.

    a failed push just gets logged. the next one's only 30 s away, and there's no point
    catching up on old stats.

    Args:
        report: from build_report.
        url: the backend's report endpoint.
        token: the backend's MONITOR_TOKEN.
    """
    request = urllib.request.Request(
        url,
        data=json.dumps(report).encode(),
        method="PUT",
        headers={"Content-Type": "application/json", "X-Monitor-Token": token},
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S):
            pass
    except urllib.error.HTTPError as exc:
        logger.error("backend refused the report: HTTP %d %s", exc.code, exc.read().decode(errors="replace"))
    except (urllib.error.URLError, OSError) as exc:
        logger.error("can't reach the backend at %s (%s): is fart-pi up and website-backend running?", url, exc)


def run(api_url: str) -> None:
    """report forever.

    Args:
        api_url: the backend's origin, like http://192.168.1.116:8000.
    """
    token = read_token()
    url = api_url.rstrip("/") + REPORT_PATH
    logger.info("reporting as %s to %s every %d s", socket.gethostname(), url, REPORT_INTERVAL_S)
    previous_cpu = None
    while True:
        report, previous_cpu = build_report(previous_cpu)
        push_report(report, url, token)
        time.sleep(REPORT_INTERVAL_S)


def main() -> None:
    """parse args and either print one report or run the agent."""
    parser = argparse.ArgumentParser(description="report this machine's stats to the website backend.")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help=f"backend origin (default {DEFAULT_API_URL})")
    parser.add_argument("--print", action="store_true", help="print one report as json and exit")
    args = parser.parse_args()
    if args.print:
        # an earlier cpu sample so the usage isn't empty
        first_cpu = read_cpu_times()
        time.sleep(PRINT_CPU_SAMPLE_S)
        print(json.dumps(build_report(first_cpu)[0], indent=2))
        return
    run(args.api_url)


if __name__ == "__main__":
    main()
