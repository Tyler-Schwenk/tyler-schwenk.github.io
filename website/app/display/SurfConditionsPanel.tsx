"use client";

import { useEffect, useState, type ReactNode } from "react";
import TideGraph from "./TideGraph";
import {
  fetchSurfConditions,
  type SurfCamId,
  type SurfConditions,
  type TideReading,
  type WavesReading,
  type WindReading,
} from "./surfCams";

/**
 * Display panel: the waves, wind and tide at a surf cam's spot, shown on the
 * other screen while the cam itself plays. Readings come from the surfcam
 * agent (the same ones as the video overlay). Waves and wind each get a
 * compass dial with north up and an arrow pointing the way the waves/wind are
 * heading, next to where they come from as a compass name and degrees. The
 * tide gets a chart of the past and predicted curve across the bottom.
 * @param props.camId - Cam whose spot to show.
 */

// compass dial geometry, in svg units with the dial centred on 0,0
const DIAL_SIZE_PX = 260;
const DIAL_VIEWBOX_HALF = 100;
const DIAL_RING_RADIUS = 92;
const DIAL_LABEL_RADIUS = 74;
const DIAL_TICK_INNER_RADIUS = 86;
const DIAL_TICK_COUNT = 16;
const DIAL_LABEL_FONT = 16;
const DIAL_VIEWBOX = `${-DIAL_VIEWBOX_HALF} ${-DIAL_VIEWBOX_HALF} ${DIAL_VIEWBOX_HALF * 2} ${DIAL_VIEWBOX_HALF * 2}`;

// tailwind gray-600 / gray-500 / white, matching the panel's text
const DIAL_LINE_COLOR = "#4b5563";
const DIAL_LABEL_COLOR = "#6b7280";
const DIAL_HIGHLIGHT_COLOR = "#ffffff";

// the arrow is drawn pointing up (north) and rotated into place
const ARROW_POINTS = "0,-60 20,-22 7,-22 7,52 -7,52 -7,-22 -20,-22";

// directions are "comes from", so the arrow points the opposite way: where it's going
const HEADING_FROM_SOURCE_DEG = 180;

const CARDINAL_LABELS = [
  { label: "N", deg: 0 },
  { label: "E", deg: 90 },
  { label: "S", deg: 180 },
  { label: "W", deg: 270 },
];

/**
 * Point on a circle around the dial centre, with 0 degrees straight up and
 * angles going clockwise, like a compass.
 * @param radius - Distance from the centre in svg units.
 * @param deg - Compass bearing.
 * @returns [x, y] in svg units.
 */
function compassPoint(radius: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [radius * Math.sin(rad), -radius * Math.cos(rad)];
}

/**
 * Compass dial, north up, with an arrow at the given bearing.
 * @param props.arrowDeg - Bearing the arrow points at, degrees clockwise from north.
 */
function CompassDial({ arrowDeg }: { arrowDeg: number }) {
  const ticks = Array.from({ length: DIAL_TICK_COUNT }, (_, i) => (360 / DIAL_TICK_COUNT) * i);
  return (
    <svg width={DIAL_SIZE_PX} height={DIAL_SIZE_PX} viewBox={DIAL_VIEWBOX}>
      <circle r={DIAL_RING_RADIUS} fill="none" stroke={DIAL_LINE_COLOR} strokeWidth={2} />
      {ticks.map((deg) => {
        const [x1, y1] = compassPoint(DIAL_TICK_INNER_RADIUS, deg);
        const [x2, y2] = compassPoint(DIAL_RING_RADIUS, deg);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={DIAL_LINE_COLOR} strokeWidth={2} />;
      })}
      {CARDINAL_LABELS.map(({ label, deg }) => {
        const [x, y] = compassPoint(DIAL_LABEL_RADIUS, deg);
        return (
          <text
            key={label}
            x={x}
            y={y}
            fontSize={DIAL_LABEL_FONT}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="central"
            fill={label === "N" ? DIAL_HIGHLIGHT_COLOR : DIAL_LABEL_COLOR}
          >
            {label}
          </text>
        );
      })}
      <polygon points={ARROW_POINTS} fill={DIAL_HIGHLIGHT_COLOR} transform={`rotate(${arrowDeg})`} />
    </svg>
  );
}

/**
 * Small grey line saying where a reading comes from.
 * @param props.children - The note text.
 */
function SourceNote({ children }: { children: ReactNode }) {
  return <div className="text-2xl text-gray-500">{children}</div>;
}

/**
 * One reading with a dial: a title, the dial beside the reading's lines.
 * @param props.title - Heading.
 * @param props.dial - Dial to show, if the reading exists.
 * @param props.children - The reading's lines, or a "no reading" note.
 */
function DialReading({ title, dial, children }: { title: string; dial?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-3xl text-gray-400 uppercase tracking-widest mb-4">{title}</div>
      <div className="flex items-center gap-10">
        {dial}
        <div className="flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

/**
 * Shown in place of a reading the agent couldn't get.
 */
function NoReading() {
  return <div className="text-4xl text-gray-600">no reading</div>;
}

/**
 * Waves: height, period, where they're from, and when the nowcast is for.
 * @param props.waves - The reading, or null when unavailable.
 */
function WavesReadingView({ waves }: { waves: WavesReading | null }) {
  if (!waves) return <DialReading title="Waves"><NoReading /></DialReading>;
  return (
    <DialReading title="Waves" dial={<CompassDial arrowDeg={waves.direction_deg + HEADING_FROM_SOURCE_DEG} />}>
      <div className="text-8xl font-bold text-white">{waves.height_ft.toFixed(1)} ft</div>
      <div className="text-4xl text-gray-300">{waves.period_s.toFixed(0)} s period</div>
      <div className="text-4xl text-gray-300">
        from {waves.direction_compass} {Math.round(waves.direction_deg)}&deg;
      </div>
      <SourceNote>CDIP nearshore nowcast, {waves.as_of}</SourceNote>
    </DialReading>
  );
}

/**
 * Wind: speed, gusts, where it's from, and whether it's measured or modelled.
 * @param props.wind - The reading, or null when unavailable.
 */
function WindReadingView({ wind }: { wind: WindReading | null }) {
  if (!wind) return <DialReading title="Wind"><NoReading /></DialReading>;
  return (
    <DialReading title="Wind" dial={<CompassDial arrowDeg={wind.direction_deg + HEADING_FROM_SOURCE_DEG} />}>
      <div className="text-8xl font-bold text-white">{wind.speed_mph.toFixed(0)} mph</div>
      <div className="text-4xl text-gray-300">
        {wind.gusts_mph !== null ? `gusts ${wind.gusts_mph.toFixed(0)} mph` : "no gust data"}
      </div>
      <div className="text-4xl text-gray-300">
        from {wind.direction_compass} {Math.round(wind.direction_deg)}&deg;
      </div>
      <SourceNote>{wind.note}</SourceNote>
    </DialReading>
  );
}

/**
 * Tide: the height now and next turn on the left, the chart filling the rest.
 * @param props.tide - The reading, or null when unavailable.
 */
function TideView({ tide }: { tide: TideReading | null }) {
  return (
    <div className="flex flex-col w-full">
      <div className="text-3xl text-gray-400 uppercase tracking-widest mb-2">Tide</div>
      {!tide ? (
        <NoReading />
      ) : (
        <div className="flex items-center gap-8 w-full">
          <div className="flex flex-col gap-2 shrink-0 w-[420px]">
            <div className="text-8xl font-bold text-white">{tide.height_ft.toFixed(1)} ft</div>
            <div className="text-4xl text-gray-300">
              {tide.rising ? "rising" : "falling"}, {tide.next_turn_kind} at {tide.next_turn_at}
            </div>
            <SourceNote>
              {tide.measured ? "measured" : "predicted"}
              {tide.source ? ` at ${tide.source}` : ""}
            </SourceNote>
          </div>
          <div className="flex-1 min-w-0">
            <TideGraph tide={tide} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SurfConditionsPanel({ camId }: { camId: SurfCamId }) {
  const [conditions, setConditions] = useState<SurfConditions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSurfConditions(camId).then((result) => {
      setConditions(result.data ?? null);
      setError(result.error ?? null);
    });
  }, [camId]);

  if (!conditions) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center font-mono text-3xl text-gray-300 text-center px-8">
        {error ?? "loading surf conditions..."}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-12 font-mono px-16">
      <div className="text-7xl font-bold text-white">{conditions.name}</div>
      <div className="grid grid-cols-2 gap-16 w-full">
        <WavesReadingView waves={conditions.waves} />
        <WindReadingView wind={conditions.wind} />
      </div>
      <TideView tide={conditions.tide} />
    </div>
  );
}
