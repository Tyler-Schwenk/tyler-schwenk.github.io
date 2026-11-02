"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchKilnCurve,
  fetchKilnFirings,
  fetchKilnStatus,
  type KilnFiring,
  type KilnFiringCurve,
  type KilnStatus,
} from "@/app/kiln/kilnApi";
import {
  formatAgo,
  formatDate,
  formatDateTime,
  formatDuration,
  formatRate,
  formatTemp,
  NO_VALUE,
} from "@/app/kiln/kilnFormat";
import FiringCard from "./FiringCard";
import TemperatureChart from "./TemperatureChart";

/** matches the logger's 5 s readings, with a little slack. */
const STATUS_POLL_MS = 10_000;
const CURVE_POLL_MS = 30_000;
const FIRINGS_POLL_MS = 60_000;
/** the fault register's bit for no thermocouple connected. */
const FAULT_OPEN_CIRCUIT = 0x01;
/** the kiln art's real size. both images share it, so swapping them doesn't move the kiln. */
const KILN_ART_WIDTH_PX = 672;
const KILN_ART_HEIGHT_PX = 979;
const JUDE_INSTAGRAM_URL = "https://www.instagram.com/judecastilloceramics/";

/**
 * runs something now and on an interval, skipping ticks while the tab's hidden.
 *
 * @param {() => void} task - what to run.
 * @param {number} intervalMs - how often.
 * @param {unknown} key - restarts the schedule when it changes.
 */
function usePolling(task: () => void, intervalMs: number, key: unknown): void {
  useEffect(() => {
    task();
    const timer = setInterval(() => {
      if (!document.hidden) task();
    }, intervalMs);
    return () => clearInterval(timer);
    // the task closes over nothing that changes without `key` changing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, key]);
}

/**
 * one number in the row under the title.
 *
 * @param {object} props - component props.
 * @param {string} props.label - what the number is.
 * @param {string} props.value - the formatted number.
 * @returns {JSX.Element} the stat.
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="kiln-stat">
      <div className="kiln-stat-label">{label}</div>
      <div className="kiln-stat-value">{value}</div>
    </div>
  );
}

/**
 * says whether the numbers are live, and why not if they aren't.
 *
 * @param {object} props - component props.
 * @param {KilnStatus | null} props.status - the live readout, null before it's loaded.
 * @param {boolean} props.unreachable - the backend isn't answering.
 * @param {number} props.nowMs - the time of the last check.
 * @returns {JSX.Element} the status line.
 */
function StatusLine({
  status,
  unreachable,
  nowMs,
}: {
  status: KilnStatus | null;
  unreachable: boolean;
  nowMs: number;
}) {
  let tone = "off";
  let text = "Connecting";
  if (unreachable) {
    text = "Can't reach the kiln right now. Trying again.";
  } else if (status && !status.last_reading_at) {
    text = "No readings yet";
  } else if (status && !status.online) {
    text = `Logger offline. Last reading ${formatAgo(nowMs - new Date(status.last_reading_at as string).getTime())}`;
  } else if (status && status.thermocouple_c === null) {
    tone = "fault";
    const openCircuit = ((status.fault_status ?? 0) & FAULT_OPEN_CIRCUIT) !== 0;
    text = openCircuit ? "Probe disconnected" : "Probe fault";
  } else if (status) {
    tone = "live";
    text = status.firing ? "Live, firing in progress" : "Live, no firing in progress";
  }
  return (
    <p className="kiln-status" role="status">
      <span className={`kiln-status-dot kiln-status-${tone}`} aria-hidden="true" />
      {text}
    </p>
  );
}

/**
 * the "what's this?" dropdown explaining who the page is for and how the readings get here.
 *
 * @returns {JSX.Element} the dropdown, closed to start.
 */
function AboutKiln() {
  return (
    <details className="kiln-about">
      <summary>What&apos;s this?</summary>
      <div className="kiln-about-body">
        <p>
          I made this for my roommate,{" "}
          <a href={JUDE_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            Jude Castillo
          </a>
          , so you can follow along with his kiln firings live.
        </p>
        <p>
          A temperature probe in the kiln plugs into a MAX31856 breakout board, which turns the probe&apos;s
          signal into a temperature. A Raspberry Pi reads that every 5 seconds and streams it over Wi-Fi to
          fart-pi, my home server. fart-pi stores every reading, works out when each firing starts and ends,
          and calculates how fast the temperature&apos;s rising. This page pulls that data from fart-pi and
          shows it here.
        </p>
      </div>
    </details>
  );
}

/**
 * the kiln page: live temperature and rates, the current firing's curve, and past firings.
 * with ?firing=<id> in the url it shows that firing instead of the live readout.
 *
 * @returns {JSX.Element} the page content.
 */
export default function KilnConsole() {
  const firingParam = useSearchParams().get("firing");
  const selectedId = firingParam && /^\d+$/.test(firingParam) ? Number(firingParam) : null;

  const [status, setStatus] = useState<KilnStatus | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [firings, setFirings] = useState<KilnFiring[]>([]);
  const [curve, setCurve] = useState<KilnFiringCurve | null>(null);
  const [curveMissing, setCurveMissing] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  usePolling(
    () => {
      fetchKilnStatus()
        .then((next) => {
          setStatus(next);
          setUnreachable(false);
          setNowMs(Date.now());
        })
        .catch((error) => {
          console.warn("couldn't load the kiln status:", error);
          setUnreachable(true);
        });
    },
    STATUS_POLL_MS,
    "status",
  );

  usePolling(
    () => {
      fetchKilnFirings()
        .then(setFirings)
        .catch((error) => console.warn("couldn't load past firings:", error));
    },
    FIRINGS_POLL_MS,
    "firings",
  );

  const liveFiringId = status?.firing?.id ?? null;
  const shownFiringId = selectedId ?? liveFiringId;

  usePolling(
    () => {
      if (shownFiringId === null) {
        setCurve(null);
        return;
      }
      fetchKilnCurve(shownFiringId)
        .then((next) => {
          setCurve(next);
          setCurveMissing(false);
        })
        .catch((error) => {
          console.warn(`couldn't load the curve for firing ${shownFiringId}:`, error);
          setCurveMissing(true);
        });
    },
    CURVE_POLL_MS,
    shownFiringId,
  );

  const shownCurve = curve && curve.firing.id === shownFiringId ? curve : null;
  const shownFiring = shownCurve?.firing ?? status?.firing ?? null;
  const elapsedMs = shownFiring
    ? new Date(shownFiring.ended_at ?? shownFiring.last_reading_at).getTime() - new Date(shownFiring.started_at).getTime()
    : null;
  const pastFirings = firings.filter((firing) => firing.ended_at !== null && firing.id !== selectedId);
  const isLiveView = selectedId === null;

  return (
    <div className="kiln-theme">
      <header className="kiln-header">
        <Link href="/kiln" className="kiln-wordmark">
          The Kiln
        </Link>
        <nav className="kiln-nav" aria-label="Page">
          <Link href="/">Home</Link>
          <Link href="/kiln" className={isLiveView ? "kiln-nav-current" : undefined}>
            Live
          </Link>
          <a href="#past-firings">Past firings</a>
        </nav>
      </header>

      <main className="kiln-main">
        {isLiveView ? (
          <div className="kiln-hero">
            <div className="kiln-hero-head">
              <h1 className="kiln-title">Kiln</h1>
              <StatusLine status={status} unreachable={unreachable} nowMs={nowMs} />
            </div>
            <AboutKiln />
            {/* waits for the status, so a firing kiln doesn't flash idle first */}
            <div className="kiln-art">
              {status && (
                <Image
                  src={status.firing ? "/images/kiln/kiln-firing.png" : "/images/kiln/kiln-idle.png"}
                  alt={status.firing ? "The kiln firing, with flames and smoke" : "The kiln, cold and idle"}
                  width={KILN_ART_WIDTH_PX}
                  height={KILN_ART_HEIGHT_PX}
                />
              )}
            </div>
            <div className="kiln-stats">
              <div className="kiln-stat kiln-stat-hero">
                <div className="kiln-stat-label">Current temperature</div>
                <div className="kiln-stat-value">{formatTemp(status?.thermocouple_c ?? null)}</div>
              </div>
              <Stat label="Rise, last 30 min" value={formatRate(status?.rise_30m_c_per_h ?? null)} />
              <Stat label="Rise, last hour" value={formatRate(status?.rise_60m_c_per_h ?? null)} />
              <Stat label="Firing time" value={elapsedMs === null ? NO_VALUE : formatDuration(elapsedMs)} />
              <Stat label="Peak" value={formatTemp(status?.firing?.peak_c ?? null)} />
            </div>
          </div>
        ) : (
          <>
            <h1 className="kiln-title">{shownFiring ? formatDate(shownFiring.started_at) : "Firing"}</h1>
            <p className="kiln-status">
              <Link href="/kiln" className="kiln-back">
                Back to live
              </Link>
            </p>
            {curveMissing && !shownCurve && <p className="kiln-status">Couldn&apos;t find that firing.</p>}
            <div className="kiln-stats">
              <Stat label="Peak" value={formatTemp(shownFiring?.peak_c ?? null)} />
              <Stat label="Firing time" value={elapsedMs === null ? NO_VALUE : formatDuration(elapsedMs)} />
              <Stat label="Started" value={shownFiring ? formatDateTime(shownFiring.started_at) : NO_VALUE} />
              <Stat
                label="Finished"
                value={shownFiring?.ended_at ? formatDateTime(shownFiring.ended_at) : shownFiring ? "In progress" : NO_VALUE}
              />
            </div>
          </>
        )}

        <section className="kiln-section" aria-label="Temperature over time">
          <h2 className="kiln-section-title">
            {isLiveView ? "This firing" : "Temperature over time"}
            <span className="kiln-section-note">°F</span>
          </h2>
          {shownCurve ? (
            <TemperatureChart points={shownCurve.points} bucketS={shownCurve.bucket_s} />
          ) : (
            <div className="kiln-chart kiln-chart-placeholder">
              <p className="kiln-chart-empty">
                {shownFiringId === null
                  ? "No firing in progress. The curve starts by itself once the kiln heats up."
                  : "Loading the curve."}
              </p>
            </div>
          )}
        </section>

        <section id="past-firings" className="kiln-section" aria-label="Past firings">
          <div className="kiln-grid-header">
            <h2 className="kiln-section-title">Past firings</h2>
            <span className="kiln-section-note">
              {pastFirings.length} {pastFirings.length === 1 ? "firing" : "firings"}
            </span>
          </div>
          {pastFirings.length === 0 ? (
            <p className="kiln-empty">Finished firings get saved here automatically.</p>
          ) : (
            <div className="kiln-cards">
              {pastFirings.map((firing) => (
                <FiringCard key={firing.id} firing={firing} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
