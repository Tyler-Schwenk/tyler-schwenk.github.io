import { API_BASE } from "@/lib/api";

/**
 * client for the backend's monitor endpoint: every house machine's latest
 * storage, memory, cpu and temperature, as its monitor agent last reported
 * them (pi/docs/services/monitor-agent.md).
 */

const MONITOR_URL = `${API_BASE}/monitor`;

/**
 * what a part of a disk is. only a mounted "filesystem" has usage; the rest
 * is space nothing's using (or swap).
 */
export type MonitorVolumeKind = "filesystem" | "swap" | "unmounted" | "unallocated" | "unpartitioned";

/** one part of a disk, in partition order. */
export type MonitorVolume = {
  /** kernel name, like "sda2". for unallocated/unpartitioned space, what it's inside of. */
  name: string;
  kind: MonitorVolumeKind;
  size_bytes: number;
  fstype: string | null;
  mount: string | null;
  /** set for mounted filesystems the agent could read. used + available < size (ext4 keeps ~5% back). */
  used_bytes: number | null;
  available_bytes: number | null;
};

/** one physical disk. */
export type MonitorDisk = {
  name: string;
  model: string | null;
  /** how it's attached, like "usb", "nvme" or "mmc" (an sd card). */
  transport: string | null;
  size_bytes: number;
  volumes: MonitorVolume[];
};

/** one machine's last report, plus when it came in. */
export type MonitorDevice = {
  /** hostname, like "fart-pi". */
  name: string;
  model: string | null;
  uptime_s: number;
  cpu: {
    cores: number;
    /** over the agent's last 30 s, null on its first report. */
    usage_pct: number | null;
    load_1m: number;
    load_5m: number;
    load_15m: number;
  };
  temperature_c: number | null;
  memory: {
    total_bytes: number;
    /** counts reclaimable cache, so it's the real "free". */
    available_bytes: number;
    swap_total_bytes: number;
    swap_free_bytes: number;
  };
  battery: {
    percent: number | null;
    /** the kernel's word, which some laptops get wrong; trust on_power for plugged in. */
    status: string | null;
    on_power: boolean;
  } | null;
  disks: MonitorDisk[];
  /** reported within the last couple of minutes. an offline machine's stats are stale. */
  online: boolean;
  /** epoch ms of its last report. */
  reported_ms: number;
};

/** every machine that's reported since the backend started. */
export type MonitorState = {
  /** the backend's clock, epoch ms, to measure reported_ms against. */
  now_ms: number;
  devices: MonitorDevice[];
};

/**
 * fetches every machine's latest stats.
 * @returns {Promise<MonitorState>} the machines, in name order.
 * @throws {Error} if the pi can't be reached or answers with an error.
 */
export async function fetchMonitorState(): Promise<MonitorState> {
  let res: Response;
  try {
    res = await fetch(MONITOR_URL);
  } catch {
    throw new Error("can't reach the pi");
  }
  if (!res.ok) throw new Error(`the pi answered ${res.status}`);
  return res.json();
}
