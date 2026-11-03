"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchKilnCurve, type KilnCurvePoint } from "@/app/kiln/kilnApi";
import { toChartPoints, type ChartPoint } from "@/app/kiln/kilnCurve";
import {
  buildForecast,
  DEFAULT_OUTSIDE_F,
  estimateTemp,
  estimateTime,
  learnTypicalDrop,
  MAX_TARGET_F,
  MIN_TARGET_F,
  noEstimateReason,
  referenceHours,
  type KilnForecast,
  type KilnPhase,
  type TypicalDrop,
} from "@/app/kiln/kilnForecast";
import { formatDateTime, formatDuration, toFahrenheit } from "@/app/kiln/kilnFormat";

const MS_PER_HOUR = 3_600_000;
const MIN_HOURS_AHEAD = 0.25;
const MAX_HOURS_AHEAD = 72;
const DEFAULT_HOURS_AHEAD = 2;
const HOURS_AHEAD_STEP = 0.5;
const TEMP_STEP_F = 25;
const HOUR_PRESETS = [1, 2, 4, 8];
/** enough to see how firings vary, while the page stays quick to load. */
const MAX_LEARNING_FIRINGS = 5;
/** plenty for fitting a cooldown, and much lighter than a whole curve per firing. */
const LEARNING_CURVE_POINTS = 500;
/** where people usually want to know about: the probe gets pulled around 400, then opening up. */
const COOLING_PRESETS_F = [800, 600, 400, 300, 200];
/** 2,345 f is cone 10. */
const HEATING_PRESETS_F = [1000, 1500, 2000, 2200, 2345];
const DEFAULT_TARGET_F: Record<KilnPhase, number> = { cooling: 400, heating: 2345, holding: 400 };
const PHASE_LABELS: Record<KilnPhase, string> = {
  cooling: "Full drop",
  heating: "Heating",
  holding: "Holding steady",
};
const HELD_UP_COOLING_LABEL = "Cooling slowly, held up";
const PACE_CHANGED_LABEL = "Pace just changed";

const formatF = (tempF: number): string => `${Math.round(tempF).toLocaleString()} °F`;

/**
 * parses what's typed in a number box, keeping it inside a range.
 *
 * @param {string} text - what's in the box.
 * @param {number} min - lowest allowed value.
 * @param {number} max - highest allowed value.
 * @returns {number | null} the number, or null if it's empty or out of range.
 */
function parseInRange(text: string, min: number, max: number): number | null {
  const value = Number(text);
  if (text.trim() === "" || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

/**
 * row of quick-pick buttons for a number box.
 *
 * @param {object} props - component props.
 * @param {number[]} props.values - the values to offer.
 * @param {string} props.selected - what's in the box right now.
 * @param {(value: number) => string} props.format - how to label a value.
 * @param {(value: number) => void} props.onPick - called with the picked value.
 * @returns {JSX.Element} the buttons.
 */
function Presets({
  values,
  selected,
  format,
  onPick,
}: {
  values: number[];
  selected: string;
  format: (value: number) => string;
  onPick: (value: number) => void;
}) {
  return (
    <div className="kiln-chips">
      {values.map((value) => (
        <button key={value} type="button" aria-pressed={selected === String(value)} onClick={() => onPick(value)}>
          {format(value)}
        </button>
      ))}
    </div>
  );
}

/**
 * the "when will it reach this temperature?" card.
 *
 * @param {object} props - component props.
 * @param {KilnForecast} props.forecast - the current trend.
 * @param {number} props.nowMs - when the current temperature was read.
 * @param {ChartPoint[] | null} props.referencePoints - the last finished firing's curve, if any.
 * @returns {JSX.Element} the card.
 */
function TimeCard({
  forecast,
  nowMs,
  referencePoints,
}: {
  forecast: KilnForecast;
  nowMs: number;
  referencePoints: ChartPoint[] | null;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  // follows the phase until someone's picked their own, so it flips to a useful temp by itself
  const isCooling = forecast.phase !== "heating";
  const presets = (isCooling ? COOLING_PRESETS_F : HEATING_PRESETS_F).filter((preset) =>
    isCooling ? preset < forecast.tempF : preset > forecast.tempF,
  );
  const defaultTargetF = DEFAULT_TARGET_F[forecast.phase];
  // once it's past the usual target, the next one down is the useful question
  const text = typed ?? String(isCooling && defaultTargetF >= forecast.tempF && presets.length > 0 ? presets[0] : defaultTargetF);
  const targetF = parseInRange(text, MIN_TARGET_F, MAX_TARGET_F);
  const estimate = targetF === null ? null : estimateTime(forecast, targetF);
  const reason = targetF === null ? null : noEstimateReason(forecast, targetF);
  const reference =
    estimate && referencePoints && targetF !== null
      ? referenceHours(referencePoints, forecast.phase, forecast.tempF, targetF)
      : null;

  let message = `Enter a temperature from ${MIN_TARGET_F} to ${MAX_TARGET_F.toLocaleString()} °F.`;
  if (reason === "holding") message = "It's holding steady, so there's no trend to go on.";
  if (reason === "passed") message = isCooling ? "It's already below that." : "It's already past that.";
  if (reason === "near-outside") message = "That's too close to the temperature outside to estimate.";

  return (
    <div className="kiln-calc-card">
      <label className="kiln-calc-question" htmlFor="kiln-target-temp">
        When will it reach
      </label>
      <div className="kiln-calc-input">
        <input
          id="kiln-target-temp"
          type="number"
          inputMode="numeric"
          min={MIN_TARGET_F}
          max={MAX_TARGET_F}
          step={TEMP_STEP_F}
          value={text}
          onChange={(event) => setTyped(event.target.value)}
        />
        <span>°F</span>
      </div>
      <Presets values={presets} selected={text} format={(value) => value.toLocaleString()} onPick={(value) => setTyped(String(value))} />
      <div className="kiln-calc-answer" aria-live="polite">
        {estimate && forecast.heldUp ? (
          <>
            <div className="kiln-calc-result">At least {formatDuration(estimate.lowHours * MS_PER_HOUR)}</div>
            <p>No sooner than {formatDateTime(nowMs + estimate.lowHours * MS_PER_HOUR)}</p>
            <p className="kiln-calc-range">If it&apos;s let drop now. Every hour it&apos;s held up pushes this back.</p>
            {reference !== null && (
              <p className="kiln-calc-range">The same change took {formatDuration(reference * MS_PER_HOUR)} last firing</p>
            )}
          </>
        ) : estimate ? (
          <>
            <div className="kiln-calc-result">About {formatDuration(estimate.hours * MS_PER_HOUR)}</div>
            <p>Around {formatDateTime(nowMs + estimate.hours * MS_PER_HOUR)}</p>
            <p className="kiln-calc-range">
              Likely {formatDuration(estimate.lowHours * MS_PER_HOUR)} to {formatDuration(estimate.highHours * MS_PER_HOUR)}
            </p>
            {reference !== null && (
              <p className="kiln-calc-range">The same change took {formatDuration(reference * MS_PER_HOUR)} last firing</p>
            )}
          </>
        ) : (
          <p className="kiln-calc-range">{message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * the "how hot will it be in a while?" card.
 *
 * @param {object} props - component props.
 * @param {KilnForecast} props.forecast - the current trend.
 * @param {number} props.nowMs - when the current temperature was read.
 * @returns {JSX.Element} the card.
 */
function TempCard({ forecast, nowMs }: { forecast: KilnForecast; nowMs: number }) {
  const [text, setText] = useState(String(DEFAULT_HOURS_AHEAD));
  const hours = parseInRange(text, MIN_HOURS_AHEAD, MAX_HOURS_AHEAD);
  const estimate = hours === null ? null : estimateTemp(forecast, hours);
  // a straight line keeps climbing forever, past anything a kiln can do
  const isOffTheTop = estimate !== null && estimate.tempF > MAX_TARGET_F;

  let message = `Enter between ${MIN_HOURS_AHEAD} and ${MAX_HOURS_AHEAD} hours.`;
  if (forecast.phase === "holding") message = "It's holding steady, so there's no trend to go on.";
  if (isOffTheTop) message = `That's past ${MAX_TARGET_F.toLocaleString()} °F if it kept this pace, so it's too far out to say.`;

  return (
    <div className="kiln-calc-card">
      <label className="kiln-calc-question" htmlFor="kiln-hours-ahead">
        How hot will it be in
      </label>
      <div className="kiln-calc-input">
        <input
          id="kiln-hours-ahead"
          type="number"
          inputMode="decimal"
          min={MIN_HOURS_AHEAD}
          max={MAX_HOURS_AHEAD}
          step={HOURS_AHEAD_STEP}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <span>hours</span>
      </div>
      <Presets values={HOUR_PRESETS} selected={text} format={(value) => `${value} hr`} onPick={(value) => setText(String(value))} />
      <div className="kiln-calc-answer" aria-live="polite">
        {estimate && hours !== null && forecast.heldUp ? (
          <>
            <div className="kiln-calc-result">No lower than about {formatF(estimate.lowF)}</div>
            <p>At {formatDateTime(nowMs + hours * MS_PER_HOUR)}</p>
            <p className="kiln-calc-range">If it&apos;s let drop now. It&apos;ll be hotter if it&apos;s held up longer.</p>
          </>
        ) : estimate && hours !== null && !isOffTheTop ? (
          <>
            <div className="kiln-calc-result">About {formatF(estimate.tempF)}</div>
            <p>At {formatDateTime(nowMs + hours * MS_PER_HOUR)}</p>
            <p className="kiln-calc-range">
              Likely {formatF(estimate.lowF)} to {formatF(Math.min(estimate.highF, MAX_TARGET_F))}
            </p>
          </>
        ) : (
          <p className="kiln-calc-range">{message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * says how the estimates are made, which depends on the phase.
 *
 * @param {object} props - component props.
 * @param {KilnForecast} props.forecast - the current trend.
 * @param {TypicalDrop} props.typicalDrop - what the held up limits are based on.
 * @param {boolean} props.hasOutdoorForecast - whether the outdoor temp's a real forecast.
 * @returns {JSX.Element} the note.
 */
function ForecastNote({
  forecast,
  typicalDrop,
  hasOutdoorForecast,
}: {
  forecast: KilnForecast;
  typicalDrop: TypicalDrop;
  hasOutdoorForecast: boolean;
}) {
  const outside = hasOutdoorForecast
    ? `It's using the forecast of about ${formatF(forecast.outsideF)} outside.`
    : `The forecast isn't available, so it's assuming ${formatF(forecast.outsideF)} outside.`;
  let learnedFrom = "the first firing";
  if (typicalDrop.firingCount === 1) learnedFrom = "the last firing";
  if (typicalDrop.firingCount > 1) learnedFrom = `the last ${typicalDrop.firingCount} firings`;
  if (forecast.heldUp) {
    return (
      <p className="kiln-calc-note">
        It isn&apos;t falling as fast as a full drop, so it looks like the heat&apos;s being held up. There&apos;s no telling when
        that ends, so these are limits based on how fast {learnedFrom} fell once let go. Real estimates start once the full drop
        shows up in the readings.
      </p>
    );
  }
  if (forecast.paceChanged) {
    return (
      <p className="kiln-calc-note">
        The pace just changed, maybe from the vents or the gas. For now this goes off the last 15 minutes instead of the last
        hour, and assumes the new pace keeps up, so the range is wider. {outside}
      </p>
    );
  }
  if (forecast.phase === "cooling") {
    return (
      <p className="kiln-calc-note">
        It looks like a full drop. Cooling slows down as the kiln gets closer to the temperature outside, and the estimate
        allows for that. {outside} The weather matters most below about 300 °F, so ranges get wider down there. Tested against
        the first firing&apos;s cooldown, this was usually within about 10%.
      </p>
    );
  }
  if (forecast.phase === "heating") {
    return (
      <p className="kiln-calc-note">
        This assumes the last hour&apos;s pace holds. Heating depends on how the burner&apos;s set, and it usually slows down near
        the top, so treat it as a rough guide.
      </p>
    );
  }
  return <p className="kiln-calc-note">Estimates come back once the temperature starts moving again.</p>;
}

/**
 * the info bubble explaining how the estimates are made.
 *
 * @returns {JSX.Element} a dropdown, closed until someone opens it.
 */
function HowItWorks() {
  return (
    <details className="kiln-calc-info">
      <summary>
        <span className="kiln-calc-info-icon" aria-hidden="true">
          i
        </span>
        How do these estimates work?
      </summary>
      <div className="kiln-calc-info-body">
        <p>
          <strong>Cooling.</strong> A kiln cools fastest when it&apos;s hottest. Each hour it closes about the same share of the
          gap to the temperature outside, so it slows down as it goes. The page measures that share from the last hour of
          readings and follows the curve forward.
        </p>
        <p>
          <strong>Holding the heat up.</strong> Jude can keep some gas on before letting it fall. While it&apos;s falling slower
          than a full drop, nobody can say when that&apos;ll end, so you get limits like &quot;at least 9 hours&quot; if it&apos;s let drop
          right now. Real estimates start once the readings show the full drop.
        </p>
        <p>
          <strong>Vents and gas changes.</strong> It also compares the last 15 minutes against the last hour. If they disagree a
          lot, the pace has changed, so it goes off the last 15 minutes with a wider range. When the vents opened in the first
          firing, its estimate for the next big step down was on target within about 10 minutes.
        </p>
        <p>
          <strong>Heating.</strong> A straight line at the last hour&apos;s pace. It depends on how the burner&apos;s set, so it&apos;s
          only a rough guide.
        </p>
        <p>
          <strong>Weather.</strong> The kiln&apos;s outdoors, so it cools toward the San Diego forecast for the next 12 hours. That
          hardly matters up high but matters a lot below about 300 °F, so ranges get wider there. Wind isn&apos;t included.
        </p>
        <p>
          <strong>Past firings.</strong> Finished firings teach it how fast a full drop usually goes, which sets the limits above.
        </p>
        <p>
          <strong>What it can&apos;t do.</strong> It can&apos;t know what Jude will do next. Every number assumes things carry on as they
          are right now, and it&apos;s only been tested on one firing so far.
        </p>
      </div>
    </details>
  );
}

/**
 * calculator for how long until a temperature, and how hot it'll be later, from the current trend.
 * works during heating and cooling. compares against the last finished firing when there is one.
 *
 * @param {object} props - component props.
 * @param {KilnCurvePoint[]} props.points - the live firing's curve, oldest first.
 * @param {number | null} props.tempC - the current temperature, null while it isn't live.
 * @param {string | null} props.lastReadingAt - when that temperature was read.
 * @param {number | null} props.outdoorC - the average outdoor forecast, if there is one.
 * @param {number[]} props.pastFiringIds - finished firings, newest first. estimates learn from them.
 * @returns {JSX.Element} the calculator.
 */
export default function KilnCalculator({
  points,
  tempC,
  lastReadingAt,
  outdoorC,
  pastFiringIds,
}: {
  points: KilnCurvePoint[];
  tempC: number | null;
  lastReadingAt: string | null;
  outdoorC: number | null;
  pastFiringIds: number[];
}) {
  const [pastCurves, setPastCurves] = useState<Array<ChartPoint[] | null>>([]);
  // a new array comes in on every poll, so this is what tells the effect when they really changed
  const learningIds = pastFiringIds.slice(0, MAX_LEARNING_FIRINGS).join(",");

  useEffect(() => {
    if (learningIds === "") return;
    let cancelled = false;
    // estimates work without past firings, so one failing just means less to go on
    const load = (id: string) =>
      fetchKilnCurve(Number(id), LEARNING_CURVE_POINTS)
        .then((curve) => toChartPoints(curve.points))
        .catch((error) => {
          console.warn(`couldn't load firing ${id} to learn from, leaving it out:`, error);
          return null;
        });
    Promise.all(learningIds.split(",").map(load)).then((curves) => {
      if (!cancelled) setPastCurves(curves);
    });
    return () => {
      cancelled = true;
    };
  }, [learningIds]);

  const referencePoints = pastCurves[0] ?? null;
  const typicalDrop = useMemo(
    () => learnTypicalDrop(pastCurves.filter((curve): curve is ChartPoint[] => curve !== null)),
    [pastCurves],
  );

  const chartPoints = useMemo(() => toChartPoints(points), [points]);
  const nowMs = lastReadingAt ? new Date(lastReadingAt).getTime() : null;
  const outsideF = outdoorC === null ? DEFAULT_OUTSIDE_F : toFahrenheit(outdoorC);
  const forecast =
    tempC === null || nowMs === null ? null : buildForecast(chartPoints, toFahrenheit(tempC), nowMs, outsideF, typicalDrop);
  let phaseLabel = forecast ? PHASE_LABELS[forecast.phase] : null;
  if (forecast?.heldUp && forecast.phase === "cooling") phaseLabel = HELD_UP_COOLING_LABEL;
  if (forecast?.paceChanged) phaseLabel = PACE_CHANGED_LABEL;

  return (
    <section className="kiln-section" aria-label="Calculator">
      <div className="kiln-grid-header">
        <h2 className="kiln-section-title">Calculator</h2>
        {forecast && (
          <span className="kiln-section-note">
            {phaseLabel}
            {forecast.phase !== "holding" && `, ${Math.abs(Math.round(forecast.rateFPerH)).toLocaleString()} °F/hr over the last hour`}
          </span>
        )}
      </div>
      {forecast && nowMs !== null ? (
        <>
          <div className="kiln-calc">
            <TimeCard forecast={forecast} nowMs={nowMs} referencePoints={referencePoints} />
            <TempCard forecast={forecast} nowMs={nowMs} />
          </div>
          <ForecastNote forecast={forecast} typicalDrop={typicalDrop} hasOutdoorForecast={outdoorC !== null} />
          <HowItWorks />
        </>
      ) : (
        <p className="kiln-empty">
          {tempC === null
            ? "Estimates need a live temperature, so they'll be back once the probe is reading."
            : "Estimates start once there's about 20 minutes of steady readings."}
        </p>
      )}
    </section>
  );
}
