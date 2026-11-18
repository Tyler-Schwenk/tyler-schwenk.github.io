import type { MonitorDevice, MonitorDisk, MonitorVolume } from "./monitorApi";

/**
 * everything the monitor page and the display panels work out from the raw
 * stats: names, units, how full things are and when that's worth flagging.
 *
 * disks are in decimal units (1 GB = 1000^3 bytes), the way drives are sold,
 * so the 500GB ssd reads 500 GB. memory is in binary units (1 GB = 1024^3),
 * the way ram is sold, so the 8GB pi reads 7.9 GB rather than 8.5.
 */

const DISK_UNIT_BYTES = 1000;
const MEMORY_UNIT_BYTES = 1024;
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];
// one decimal under 10 (7.9 GB), none above (293 GB)
const ONE_DECIMAL_BELOW = 10;

const S_PER_MIN = 60;
const S_PER_HOUR = 3600;
const S_PER_DAY = 86_400;
const MS_PER_S = 1000;

// how full storage or memory gets before it's flagged
const WARNING_FRACTION = 0.8;
const CRITICAL_FRACTION = 0.9;
// pis start throttling at 80-85 C, so warn well before
const WARNING_TEMPERATURE_C = 70;
const CRITICAL_TEMPERATURE_C = 80;

/** whether a number needs attention. always shown with a word, never just a color. */
export type Severity = "ok" | "warning" | "critical";

/** what each machine is for, shown under its name. keyed by hostname. */
const DEVICE_ROLES: Record<string, string> = {
  "fart-pi": "home server: the website's backend, photos, and everything else",
  displaytop: "display kiosk: the two console screens and the big speakers",
  castpi: "opium den tv receiver and kiln logger",
};
// machines listed first, in this order. anything else follows by name
const DEVICE_ORDER = Object.keys(DEVICE_ROLES);

// how a disk is attached, in words. anything else falls back to its kernel name
const TRANSPORT_NAMES: Record<string, string> = {
  mmc: "sd card",
  nvme: "nvme ssd",
  usb: "usb drive",
  sata: "sata drive",
};

/**
 * formats a byte count in the given unit system.
 * @param {number} bytes - the count.
 * @param {number} unit - 1000 or 1024.
 * @returns {string} like "7.9 GB" or "293 GB".
 */
function formatInUnits(bytes: number, unit: number): string {
  let value = bytes;
  let index = 0;
  while (value >= unit && index < BYTE_UNITS.length - 1) {
    value /= unit;
    index += 1;
  }
  const digits = value < ONE_DECIMAL_BELOW && index > 0 ? 1 : 0;
  return `${value.toFixed(digits)} ${BYTE_UNITS[index]}`;
}

/**
 * formats a disk size, in decimal units.
 * @param {number} bytes - the size.
 * @returns {string} like "500 GB".
 */
export function formatDiskBytes(bytes: number): string {
  return formatInUnits(bytes, DISK_UNIT_BYTES);
}

/**
 * formats a memory size, in binary units.
 * @param {number} bytes - the size.
 * @returns {string} like "7.9 GB".
 */
export function formatMemoryBytes(bytes: number): string {
  return formatInUnits(bytes, MEMORY_UNIT_BYTES);
}

/**
 * formats a fraction as a whole percent.
 * @param {number} fraction - 0 to 1.
 * @returns {string} like "39%".
 */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * formats how long a machine's been up.
 * @param {number} seconds - uptime.
 * @returns {string} like "15d 22h", "3h 12m" or "4m".
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / S_PER_DAY);
  const hours = Math.floor((seconds % S_PER_DAY) / S_PER_HOUR);
  const minutes = Math.floor((seconds % S_PER_HOUR) / S_PER_MIN);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * formats how long ago something happened.
 * @param {number} thenMs - when, epoch ms.
 * @param {number} nowMs - now, epoch ms, on the same clock.
 * @returns {string} like "just now", "5 min ago" or "2 days ago".
 */
export function formatAgo(thenMs: number, nowMs: number): string {
  const seconds = Math.max(0, (nowMs - thenMs) / MS_PER_S);
  if (seconds < S_PER_MIN) return "just now";
  if (seconds < S_PER_HOUR) return `${Math.floor(seconds / S_PER_MIN)} min ago`;
  if (seconds < S_PER_DAY) return `${Math.floor(seconds / S_PER_HOUR)} h ago`;
  const days = Math.floor(seconds / S_PER_DAY);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * how worrying a fill level is.
 * @param {number} fraction - how full, 0 to 1.
 * @returns {Severity} warning from 80%, critical from 90%.
 */
export function fillSeverity(fraction: number): Severity {
  if (fraction >= CRITICAL_FRACTION) return "critical";
  if (fraction >= WARNING_FRACTION) return "warning";
  return "ok";
}

/**
 * how worrying a cpu temperature is.
 * @param {number} celsius - the temperature.
 * @returns {Severity} warning from 70 C, critical from 80 C.
 */
export function temperatureSeverity(celsius: number): Severity {
  if (celsius >= CRITICAL_TEMPERATURE_C) return "critical";
  if (celsius >= WARNING_TEMPERATURE_C) return "warning";
  return "ok";
}

/**
 * what a machine is for.
 * @param {string} name - hostname.
 * @returns {string | null} its role, or null for a machine this page doesn't know.
 */
export function deviceRole(name: string): string | null {
  return DEVICE_ROLES[name] ?? null;
}

/**
 * puts machines in display order: the known ones first, the rest by name.
 * @param {MonitorDevice[]} devices - as the backend sends them (by name).
 * @returns {MonitorDevice[]} a new, ordered list.
 */
export function orderDevices(devices: MonitorDevice[]): MonitorDevice[] {
  const rank = (name: string) => {
    const index = DEVICE_ORDER.indexOf(name);
    return index === -1 ? DEVICE_ORDER.length : index;
  };
  return [...devices].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

/**
 * a disk's name in words.
 * @param {MonitorDisk} disk - the disk.
 * @returns {string} like "usb drive", or its kernel name if the transport's unknown.
 */
export function diskLabel(disk: MonitorDisk): string {
  return (disk.transport && TRANSPORT_NAMES[disk.transport]) || disk.name;
}

/**
 * a volume's name: where it's mounted, or what kind of unused space it is.
 * @param {MonitorVolume} volume - the volume.
 * @returns {string} like "/mnt/ssd", "swap" or "unallocated".
 */
export function volumeLabel(volume: MonitorVolume): string {
  if (volume.kind === "filesystem" && volume.mount) return volume.mount;
  if (volume.kind === "unmounted") return "not mounted";
  return volume.kind;
}

/**
 * whether a volume is space nothing's using: not mounted, or not in any partition or volume.
 * @param {MonitorVolume} volume - the volume.
 * @returns {boolean} true for space that could be put to use.
 */
export function isIdleSpace(volume: MonitorVolume): boolean {
  return volume.kind === "unmounted" || volume.kind === "unallocated" || volume.kind === "unpartitioned";
}

/**
 * how full a mounted filesystem is, the way df counts it: used out of what's usable.
 * @param {MonitorVolume} volume - the volume.
 * @returns {number | null} 0 to 1, or null if it isn't a filesystem with known usage.
 */
export function volumeFill(volume: MonitorVolume): number | null {
  if (volume.used_bytes === null || volume.available_bytes === null) return null;
  const usable = volume.used_bytes + volume.available_bytes;
  return usable > 0 ? volume.used_bytes / usable : null;
}

/**
 * how much of a machine's ram is in use.
 * @param {MonitorDevice} device - the machine.
 * @returns {number} 0 to 1, counting reclaimable cache as free.
 */
export function memoryFill(device: MonitorDevice): number {
  const { total_bytes, available_bytes } = device.memory;
  return total_bytes > 0 ? (total_bytes - available_bytes) / total_bytes : 0;
}

/** storage totals across machines, for the page's summary. */
export type StorageTotals = {
  /** used space on mounted filesystems. */
  usedBytes: number;
  /** used plus free space on mounted filesystems. */
  usableBytes: number;
  /** space nothing's using: unmounted partitions, unallocated and unpartitioned space. */
  idleBytes: number;
  /** every disk's raw size. */
  diskBytes: number;
};

/**
 * adds up storage across machines.
 * @param {MonitorDevice[]} devices - the machines.
 * @returns {StorageTotals} the totals.
 */
export function storageTotals(devices: MonitorDevice[]): StorageTotals {
  const totals: StorageTotals = { usedBytes: 0, usableBytes: 0, idleBytes: 0, diskBytes: 0 };
  const volumes = devices.flatMap((device) => device.disks.flatMap((disk) => disk.volumes));
  for (const volume of volumes) {
    if (isIdleSpace(volume)) totals.idleBytes += volume.size_bytes;
    if (volume.used_bytes === null || volume.available_bytes === null) continue;
    totals.usedBytes += volume.used_bytes;
    totals.usableBytes += volume.used_bytes + volume.available_bytes;
  }
  totals.diskBytes = devices.reduce((sum, device) => sum + device.disks.reduce((s, d) => s + d.size_bytes, 0), 0);
  return totals;
}
