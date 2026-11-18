import type { MonitorDevice, MonitorDisk, MonitorVolume } from "@/app/monitor/monitorApi";
import {
  diskLabel,
  fillSeverity,
  formatDiskBytes,
  formatPercent,
  isIdleSpace,
  volumeFill,
  volumeLabel,
} from "@/app/monitor/monitorFormat";
import { Meter, SeverityTag, severityClass } from "./MonitorParts";
import styles from "./monitor.module.css";

/**
 * one machine's storage: each physical disk as a bar split into its
 * partitions (in order, sized to scale), then a row per partition with its
 * own meter and figures. space nothing's using is hatched, so a partition
 * that isn't mounted or lvm space that isn't allocated stands out.
 */

/**
 * a volume's part of its disk's bar: used and free for a mounted filesystem,
 * solid for swap, hatched for idle space.
 * @param props.volume - the volume.
 * @param props.diskBytes - the whole disk's size, for its width.
 */
function DiskBarPart({ volume, diskBytes }: { volume: MonitorVolume; diskBytes: number }) {
  const widthPct = diskBytes > 0 ? (volume.size_bytes / diskBytes) * 100 : 0;
  const fill = volumeFill(volume);
  const kindClass = isIdleSpace(volume) ? styles.idle : volume.kind === "swap" ? styles.swapPart : "";
  const severity = fill === null ? "" : severityClass(fillSeverity(fill));
  const usage = fill === null ? "" : `, ${formatPercent(fill)} full`;
  return (
    <div
      className={`${styles.diskPart} ${kindClass} ${severity}`}
      style={{ width: `${widthPct}%` }}
      title={`${volumeLabel(volume)}: ${formatDiskBytes(volume.size_bytes)}${usage}`}
    >
      {fill !== null && <div className={styles.diskUsed} style={{ width: `${fill * 100}%` }} />}
    </div>
  );
}

/**
 * the figures beside a volume: how much is used, or what kind of space it is.
 * @param props.volume - the volume.
 */
function VolumeFigure({ volume }: { volume: MonitorVolume }) {
  const fill = volumeFill(volume);
  if (fill === null || volume.used_bytes === null || volume.available_bytes === null) {
    const fstype = volume.fstype ? `${volume.fstype}, ` : "";
    return <span className={styles.volumeFigure}>{fstype}{formatDiskBytes(volume.size_bytes)}</span>;
  }
  const usable = volume.used_bytes + volume.available_bytes;
  return (
    <span className={styles.volumeFigure}>
      <SeverityTag severity={fillSeverity(fill)} warning="getting full" critical="nearly full" />
      <span>
        {formatDiskBytes(volume.used_bytes)} of {formatDiskBytes(usable)} · {formatPercent(fill)}
      </span>
    </span>
  );
}

/**
 * the bar beside a volume: a meter for a mounted filesystem, hatched for idle space.
 * @param props.volume - the volume.
 */
function VolumeBar({ volume }: { volume: MonitorVolume }) {
  const fill = volumeFill(volume);
  if (fill !== null) {
    return (
      <div className={styles.volumeBar}>
        <Meter fraction={fill} severity={fillSeverity(fill)} label={`${volumeLabel(volume)} used`} />
      </div>
    );
  }
  const barClass = isIdleSpace(volume) ? `${styles.meterIdle} ${styles.idle}` : styles.meterSpacer;
  return <div className={`${styles.volumeBar} ${barClass}`} aria-hidden="true" />;
}

/**
 * one row of a disk's volume list.
 * @param props.volume - the volume.
 */
function VolumeRow({ volume }: { volume: MonitorVolume }) {
  const label = volumeLabel(volume);
  return (
    <li className={styles.volume}>
      <span className={`${styles.volumeName} ${volume.kind === "filesystem" ? styles.mono : styles.muted}`} title={label}>
        {label}
      </span>
      <VolumeBar volume={volume} />
      <VolumeFigure volume={volume} />
    </li>
  );
}

/**
 * one physical disk: its name and size, the split bar, and its volumes.
 * @param props.disk - the disk.
 */
function DiskBlock({ disk }: { disk: MonitorDisk }) {
  return (
    <div>
      <div className={styles.diskHead}>
        <span className={styles.diskName}>{diskLabel(disk)}</span>
        {disk.model && <span className={styles.muted}>{disk.model}</span>}
        <span className={styles.diskSize}>{formatDiskBytes(disk.size_bytes)}</span>
      </div>
      <div className={styles.diskBar} role="img" aria-label={`${diskLabel(disk)} split into partitions`}>
        {disk.volumes.map((volume) => (
          <DiskBarPart key={`${volume.kind}-${volume.name}`} volume={volume} diskBytes={disk.size_bytes} />
        ))}
      </div>
      <ul className={styles.volumes}>
        {disk.volumes.map((volume) => (
          <VolumeRow key={`${volume.kind}-${volume.name}`} volume={volume} />
        ))}
      </ul>
    </div>
  );
}

/**
 * every disk on a machine.
 * @param props.device - the machine.
 */
export default function DeviceStorage({ device }: { device: MonitorDevice }) {
  if (device.disks.length === 0) {
    return <p className={styles.muted}>no disks reported. the agent couldn&apos;t run lsblk, see its log.</p>;
  }
  return (
    <div className={styles.disks}>
      {device.disks.map((disk) => (
        <DiskBlock key={disk.name} disk={disk} />
      ))}
    </div>
  );
}
