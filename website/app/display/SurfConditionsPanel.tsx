"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  fetchSurfConditions,
  type SurfCamId,
  type SurfConditions,
  type SwellReading,
  type TideReading,
  type WindReading,
} from "./surfCams";

/**
 * Display panel: the swell, wind and tide at a surf cam's spot, shown on the
 * other screen while the cam itself plays. Readings come from the surfcam
 * agent (the same ones as the video overlay). Swell and wind each get a
 * compass dial with north up and an arrow pointing the way the swell/wind is
 * heading, next to where it comes from as a compass name and degrees.
 * @param props.camId - Cam whose spot to show.
 */

// compass dial geometry, in svg units with the dial centred on 0,0
const DIAL_SIZE_PX = 320;
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
    <svg
      width={DIAL_SIZE_PX}
      height={DIAL_SIZE_PX}
      viewBox={DIAL_VIEWBOX}
    >
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
 * One column of the panel: a title, a dial (or blank space the same size so
 * the columns line up), and the reading's lines.
 * @param props.title - Column heading.
 * @param props.dial - Dial to show above the numbers, if any.
 * @param props.children - The reading's lines, or a "no reading" note.
 */
function ReadingColumn({ title, dial, children }: { title: string; dial?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-3xl text-gray-400 uppercase tracking-widest mb-6">{title}</div>
      <div className="flex items-center justify-center" style={{ height: DIAL_SIZE_PX }}>
        {dial}
      </div>
      <div className="mt-8 flex flex-col items-center gap-3">{children}</div>
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
 * Swell column: height, period, and where it's from.
 * @param props.swell - The reading, or null when unavailable.
 */
function SwellColumn({ swell }: { swell: SwellReading | null }) {
  if (!swell) return <ReadingColumn title="Swell"><NoReading /></ReadingColumn>;
  return (
    <ReadingColumn
      title="Swell"
      dial={<CompassDial arrowDeg={swell.direction_deg + HEADING_FROM_SOURCE_DEG} />}
    >
      <div className="text-8xl font-bold text-white">{swell.height_ft.toFixed(1)} ft</div>
      <div className="text-4xl text-gray-300">{swell.period_s.toFixed(0)} s period</div>
      <div className="text-4xl text-gray-300">
        from {swell.direction_compass} {Math.round(swell.direction_deg)}&deg;
      </div>
    </ReadingColumn>
  );
}

/**
 * Wind column: speed, gusts, and where it's from.
 * @param props.wind - The reading, or null when unavailable.
 */
function WindColumn({ wind }: { wind: WindReading | null }) {
  if (!wind) return <ReadingColumn title="Wind"><NoReading /></ReadingColumn>;
  return (
    <ReadingColumn
      title="Wind"
      dial={<CompassDial arrowDeg={wind.direction_deg + HEADING_FROM_SOURCE_DEG} />}
    >
      <div className="text-8xl font-bold text-white">{wind.speed_mph.toFixed(0)} mph</div>
      <div className="text-4xl text-gray-300">
        {wind.gusts_mph !== null ? `gusts ${wind.gusts_mph.toFixed(0)} mph` : "no gust data"}
      </div>
      <div className="text-4xl text-gray-300">
        from {wind.direction_compass} {Math.round(wind.direction_deg)}&deg;
      </div>
    </ReadingColumn>
  );
}

/**
 * Tide column: height, rising/falling (as an up/down arrow), and the next turn.
 * @param props.tide - The reading, or null when unavailable.
 */
function TideColumn({ tide }: { tide: TideReading | null }) {
  if (!tide) return <ReadingColumn title="Tide"><NoReading /></ReadingColumn>;
  // reuse the arrow shape: straight up while rising, straight down while falling
  const arrow = (
    <svg
      width={DIAL_SIZE_PX}
      height={DIAL_SIZE_PX}
      viewBox={DIAL_VIEWBOX}
    >
      <polygon points={ARROW_POINTS} fill={DIAL_HIGHLIGHT_COLOR} transform={`rotate(${tide.rising ? 0 : 180})`} />
    </svg>
  );
  return (
    <ReadingColumn title="Tide" dial={arrow}>
      <div className="text-8xl font-bold text-white">{tide.height_ft.toFixed(1)} ft</div>
      <div className="text-4xl text-gray-300">{tide.rising ? "rising" : "falling"}</div>
      <div className="text-4xl text-gray-300">
        {tide.next_turn_kind} at {tide.next_turn_at}
      </div>
      {tide.source && <div className="text-2xl text-gray-500">from {tide.source}</div>}
    </ReadingColumn>
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
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center font-mono px-12">
      <div className="text-7xl font-bold text-white mb-20">{conditions.name}</div>
      <div className="grid grid-cols-3 gap-16 w-full max-w-[2000px]">
        <SwellColumn swell={conditions.swell} />
        <WindColumn wind={conditions.wind} />
        <TideColumn tide={conditions.tide} />
      </div>
    </div>
  );
}
