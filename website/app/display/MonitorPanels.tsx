"use client";

import type { ReactNode } from "react";
import type { MonitorDevice, MonitorState } from "@/app/monitor/monitorApi";
import { formatDiskBytes, orderDevices, storageTotals } from "@/app/monitor/monitorFormat";
import DeviceStorage from "@/components/monitor/DeviceStorage";
import DeviceVitals from "@/components/monitor/DeviceVitals";
import { DeviceHeader, StorageLegend } from "@/components/monitor/MonitorParts";
import styles from "@/components/monitor/monitor.module.css";
import { useMonitor } from "@/lib/useMonitor";

/**
 * Display panels for the system monitor slot: every machine's storage on the
 * monitor (below), their vitals on the laptop screen (on top). Both use the
 * /monitor page's components, scaled up by one font size each, always dark.
 * Each polls the backend itself, like the other panels.
 */

// everything in the monitor's components is in em, so these size the whole panel.
// the storage screen is 2560 px wide for three columns of disks; the laptop's 2256
// px has less to show, so it goes bigger, while still clearing the blocked bottom strip
const STORAGE_FONT_SIZE_PX = 26;
const VITALS_FONT_SIZE_PX = 28;

/**
 * The panel frame: full screen, dark, title line, then the machines as columns.
 * Says so in place of the columns while nothing's come back yet.
 * @param props.title - The title line.
 * @param props.state - The latest stats, null before the first load.
 * @param props.error - The last fetch error, if any.
 * @param props.fontSizePx - Scales the whole panel.
 * @param props.short - Keep clear of the laptop screen's partly blocked bottom.
 * @param props.extra - Anything after the title (totals, the legend).
 * @param props.renderDevice - One machine's column.
 */
function MonitorPanelFrame({
  title,
  state,
  error,
  fontSizePx,
  short = false,
  extra,
  renderDevice,
}: {
  title: string;
  state: MonitorState | null;
  error: string | null;
  fontSizePx: number;
  short?: boolean;
  extra?: ReactNode;
  renderDevice: (device: MonitorDevice, nowMs: number) => ReactNode;
}) {
  const devices = state ? orderDevices(state.devices) : [];
  const waiting = error ?? "waiting for the machines to report";
  return (
    <div
      className={`${styles.theme} ${styles.dark} ${styles.panel} ${short ? styles.panelShort : ""}`}
      style={{ fontSize: `${fontSizePx}px` }}
    >
      <div className={styles.panelTop}>
        <h1 className={styles.panelTitle}>{title}</h1>
        {extra}
      </div>
      {!state || devices.length === 0 ? (
        <p className={styles.muted}>{waiting}</p>
      ) : (
        <div className={styles.panelColumns}>
          {devices.map((device) => (
            <section key={device.name} className={styles.card}>
              {renderDevice(device, state.now_ms)}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** The monitor (primary, below): every disk on every machine. */
export function MonitorStoragePanel() {
  const { state, error } = useMonitor();
  const totals = state ? storageTotals(state.devices) : null;
  const extra = totals && (
    <>
      <span className={styles.muted}>
        {formatDiskBytes(totals.usedBytes)} used of {formatDiskBytes(totals.usableBytes)},{" "}
        {formatDiskBytes(totals.idleBytes)} not in use
      </span>
      <span className={styles.panelTopEnd}>
        <StorageLegend />
      </span>
    </>
  );
  return (
    <MonitorPanelFrame
      title="storage"
      state={state}
      error={error}
      fontSizePx={STORAGE_FONT_SIZE_PX}
      extra={extra}
      renderDevice={(device, nowMs) => (
        <>
          <DeviceHeader device={device} nowMs={nowMs} />
          <div className={`${styles.panelDeviceBody} ${device.online ? "" : styles.stale}`}>
            <DeviceStorage device={device} />
          </div>
        </>
      )}
    />
  );
}

/** The laptop screen (secondary, on top): memory, cpu, temperature and uptime per machine. */
export function MonitorVitalsPanel() {
  const { state, error } = useMonitor();
  return (
    <MonitorPanelFrame
      title="system monitor"
      state={state}
      error={error}
      fontSizePx={VITALS_FONT_SIZE_PX}
      short
      renderDevice={(device, nowMs) => (
        <>
          <DeviceHeader device={device} nowMs={nowMs} showRole={false} />
          <div className={`${styles.panelDeviceBody} ${device.online ? "" : styles.stale}`}>
            <DeviceVitals device={device} />
          </div>
        </>
      )}
    />
  );
}
