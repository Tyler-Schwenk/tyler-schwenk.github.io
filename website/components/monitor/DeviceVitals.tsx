import type { ReactNode } from "react";
import type { MonitorDevice } from "@/app/monitor/monitorApi";
import {
  fillSeverity,
  formatMemoryBytes,
  formatPercent,
  formatUptime,
  memoryFill,
  temperatureSeverity,
} from "@/app/monitor/monitorFormat";
import { Meter, SeverityTag } from "./MonitorParts";
import styles from "./monitor.module.css";

/**
 * one machine's vitals as small tiles: memory (with a meter), cpu, temperature,
 * uptime, and the battery on machines that have one.
 */

const NOT_AVAILABLE = "n/a";

/**
 * one tile: a label, a big value, and a line or two under it.
 * @param props.label - what it is.
 * @param props.value - the headline figure.
 * @param props.wide - spans both columns.
 * @param props.children - anything under the value.
 */
function Tile({ label, value, wide = false, children }: { label: string; value: string; wide?: boolean; children?: ReactNode }) {
  return (
    <div className={`${styles.tile} ${wide ? styles.vitalWide : ""}`}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={styles.tileValue}>{value}</div>
      {children}
    </div>
  );
}

/**
 * ram in use, as a meter, with swap underneath once any's in use.
 * @param props.device - the machine.
 */
function MemoryTile({ device }: { device: MonitorDevice }) {
  const { total_bytes, available_bytes, swap_total_bytes, swap_free_bytes } = device.memory;
  const fill = memoryFill(device);
  const severity = fillSeverity(fill);
  const swapUsed = swap_total_bytes - swap_free_bytes;
  return (
    <Tile label="memory" value={formatPercent(fill)} wide>
      <div className={styles.tileSub}>
        {formatMemoryBytes(total_bytes - available_bytes)} of {formatMemoryBytes(total_bytes)} in use{" "}
        <SeverityTag severity={severity} warning="running low" critical="almost out" />
      </div>
      <div className={styles.tileSub}>
        <Meter fraction={fill} severity={severity} label="memory in use" />
      </div>
      {swapUsed > 0 && <div className={styles.tileSub}>{formatMemoryBytes(swapUsed)} in swap</div>}
    </Tile>
  );
}

/**
 * the cpu temperature, flagged when it's getting hot.
 * @param props.celsius - the temperature, null if the machine has no sensor the agent knows.
 */
function TemperatureTile({ celsius }: { celsius: number | null }) {
  if (celsius === null) return <Tile label="cpu temp" value={NOT_AVAILABLE} />;
  return (
    <Tile label="cpu temp" value={`${Math.round(celsius)}°C`}>
      <div className={styles.tileSub}>
        <SeverityTag severity={temperatureSeverity(celsius)} warning="running warm" critical="hot, may throttle" />
      </div>
    </Tile>
  );
}

/**
 * the battery: charge and whether it's plugged in. the kernel's status word
 * isn't used, displaytop says "Discharging" at 100% on the charger.
 * @param props.battery - the battery.
 */
function BatteryTile({ battery }: { battery: NonNullable<MonitorDevice["battery"]> }) {
  const value = battery.percent === null ? NOT_AVAILABLE : `${battery.percent}%`;
  return (
    <Tile label="battery" value={value}>
      <div className={styles.tileSub}>{battery.on_power ? "plugged in" : "on battery"}</div>
    </Tile>
  );
}

/**
 * every vital for one machine.
 * @param props.device - the machine.
 */
export default function DeviceVitals({ device }: { device: MonitorDevice }) {
  const { cpu } = device;
  const usage = cpu.usage_pct === null ? NOT_AVAILABLE : `${Math.round(cpu.usage_pct)}%`;
  return (
    <div className={styles.vitals}>
      <MemoryTile device={device} />
      <Tile label="cpu" value={usage}>
        <div className={styles.tileSub}>
          load {cpu.load_1m.toFixed(2)} on {cpu.cores} cores
        </div>
      </Tile>
      <TemperatureTile celsius={device.temperature_c} />
      <Tile label="up for" value={formatUptime(device.uptime_s)} />
      {device.battery && <BatteryTile battery={device.battery} />}
    </div>
  );
}
