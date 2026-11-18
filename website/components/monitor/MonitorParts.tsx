import type { MonitorDevice } from "@/app/monitor/monitorApi";
import { deviceRole, formatAgo, formatPercent, type Severity } from "@/app/monitor/monitorFormat";
import styles from "./monitor.module.css";

/**
 * the small pieces the monitor page and the display panels are built from:
 * meters, severity tags, a machine's header line, and the storage legend.
 */

// the "!" inside the warning triangle. black reads on both the yellow and the red, in either mode
const TAG_MARK_COLOR = "#000";

const SEVERITY_CLASS: Record<Severity, string | undefined> = {
  ok: undefined,
  warning: styles.warning,
  critical: styles.critical,
};

/**
 * the class that colors a meter or disk part for its severity.
 * @param {Severity} severity - how worrying it is.
 * @returns {string} the class, empty when it's fine.
 */
export function severityClass(severity: Severity): string {
  return SEVERITY_CLASS[severity] ?? "";
}

/**
 * a thin bar showing how full something is. the color follows the severity,
 * which always comes with a SeverityTag too, so it's never color alone.
 * @param props.fraction - how full, 0 to 1.
 * @param props.severity - how worrying that is.
 * @param props.label - what it measures, for screen readers.
 */
export function Meter({ fraction, severity, label }: { fraction: number; severity: Severity; label: string }) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <div
      className={`${styles.meter} ${severityClass(severity)}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      title={`${label}: ${formatPercent(clamped)}`}
    >
      <div className={styles.meterFill} style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

/**
 * a warning or critical flag: an icon plus words. renders nothing when things are fine.
 * @param props.severity - how worrying it is.
 * @param props.warning - what to say at warning, like "getting full".
 * @param props.critical - what to say at critical, like "nearly full".
 */
export function SeverityTag({ severity, warning, critical }: { severity: Severity; warning: string; critical: string }) {
  if (severity === "ok") return null;
  const isCritical = severity === "critical";
  return (
    <span className={`${styles.tag} ${isCritical ? styles.tagCritical : styles.tagWarning}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1.5 15 14H1z" fill="currentColor" />
        <path d="M8 6v4M8 11.5v1" stroke={TAG_MARK_COLOR} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {isCritical ? critical : warning}
    </span>
  );
}

/**
 * a machine's name, whether it's reporting, what it's for, and what it is.
 * @param props.device - the machine.
 * @param props.nowMs - the backend's clock, to say how old an offline machine's stats are.
 * @param props.showRole - include the role line (the display leaves it out on the vitals screen).
 */
export function DeviceHeader({ device, nowMs, showRole = true }: { device: MonitorDevice; nowMs: number; showRole?: boolean }) {
  const role = deviceRole(device.name);
  const meta = [showRole ? role : null, device.model].filter(Boolean).join(" · ");
  return (
    <div className={styles.deviceHead}>
      <h2 className={styles.deviceName}>{device.name}</h2>
      <span className={styles.status}>
        <span className={`${styles.statusDot} ${device.online ? "" : styles.statusDotOff}`} aria-hidden="true" />
        {device.online ? "online" : `offline, last report ${formatAgo(device.reported_ms, nowMs)}`}
      </span>
      {meta && <p className={styles.deviceMeta}>{meta}</p>}
    </div>
  );
}

/** what the disk bars' parts mean. shown once above the storage. */
export function StorageLegend() {
  return (
    <div className={styles.legend}>
      <span className={styles.legendItem}>
        <span className={`${styles.swatch} ${styles.swatchUsed}`} aria-hidden="true" />
        used
      </span>
      <span className={styles.legendItem}>
        <span className={`${styles.swatch} ${styles.swatchFree}`} aria-hidden="true" />
        free
      </span>
      <span className={styles.legendItem}>
        <span className={`${styles.swatch} ${styles.swapPart}`} aria-hidden="true" />
        swap
      </span>
      <span className={styles.legendItem}>
        <span className={`${styles.swatch} ${styles.idle}`} aria-hidden="true" />
        not in use (unmounted or unallocated)
      </span>
    </div>
  );
}
