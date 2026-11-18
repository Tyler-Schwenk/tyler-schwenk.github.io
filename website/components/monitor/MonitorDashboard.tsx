"use client";

import type { MonitorDevice } from "@/app/monitor/monitorApi";
import { formatDiskBytes, formatPercent, orderDevices, storageTotals } from "@/app/monitor/monitorFormat";
import { useMonitor } from "@/lib/useMonitor";
import DeviceStorage from "./DeviceStorage";
import DeviceVitals from "./DeviceVitals";
import { DeviceHeader, StorageLegend } from "./MonitorParts";
import styles from "./monitor.module.css";

/**
 * the /monitor page body: storage totals across the house, then a card per
 * machine with its vitals and every disk. polls the backend every 30 s.
 */

/**
 * the headline numbers across every machine.
 * @param props.devices - the machines.
 */
function Summary({ devices }: { devices: MonitorDevice[] }) {
  const totals = storageTotals(devices);
  const online = devices.filter((device) => device.online).length;
  const fill = totals.usableBytes > 0 ? totals.usedBytes / totals.usableBytes : 0;
  return (
    <div className={styles.kpis}>
      <div className={styles.tile}>
        <div className={styles.tileLabel}>storage used</div>
        <div className={styles.tileValue}>{formatDiskBytes(totals.usedBytes)}</div>
        <div className={styles.tileSub}>
          of {formatDiskBytes(totals.usableBytes)} usable ({formatPercent(fill)})
        </div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tileLabel}>not in use</div>
        <div className={styles.tileValue}>{formatDiskBytes(totals.idleBytes)}</div>
        <div className={styles.tileSub}>unmounted partitions and unallocated space</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tileLabel}>raw disk space</div>
        <div className={styles.tileValue}>{formatDiskBytes(totals.diskBytes)}</div>
        <div className={styles.tileSub}>across every disk</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tileLabel}>machines online</div>
        <div className={styles.tileValue}>
          {online} of {devices.length}
        </div>
        <div className={styles.tileSub}>each reports every 30 s</div>
      </div>
    </div>
  );
}

/**
 * one machine: header, then vitals beside its storage.
 * @param props.device - the machine.
 * @param props.nowMs - the backend's clock.
 */
function DeviceCard({ device, nowMs }: { device: MonitorDevice; nowMs: number }) {
  return (
    <section className={styles.card} aria-label={device.name}>
      <DeviceHeader device={device} nowMs={nowMs} />
      <div className={`${styles.cardBody} ${device.online ? "" : styles.stale}`}>
        <DeviceVitals device={device} />
        <div>
          <p className={styles.sectionLabel}>storage</p>
          <DeviceStorage device={device} />
        </div>
      </div>
    </section>
  );
}

/** the whole page body. */
export default function MonitorDashboard() {
  const { state, error } = useMonitor();
  const devices = state ? orderDevices(state.devices) : [];
  return (
    <main className={`${styles.theme} ${styles.page}`}>
      <div className={styles.pageInner}>
        <h1 className={styles.pageTitle}>system monitor</h1>
        <p className={styles.pageIntro}>
          The machines that run the house and this site. Each one reports its own storage, memory, cpu and
          temperature every 30 seconds.
        </p>
        {error && (
          <p className={styles.notice}>
            {error}. {state ? "showing the last numbers it sent," : ""} it&apos;ll keep trying.
          </p>
        )}
        {state && devices.length === 0 && (
          <p className={styles.notice}>No machines have reported since the backend last started.</p>
        )}
        {state && devices.length > 0 && (
          <>
            <Summary devices={devices} />
            <div className={styles.devices}>
              <StorageLegend />
              {devices.map((device) => (
                <DeviceCard key={device.name} device={device} nowMs={state.now_ms} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
