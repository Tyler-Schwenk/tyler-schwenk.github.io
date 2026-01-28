"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const EARTH_RADIUS_METERS = 6371000;
const METERS_PER_KM = 1000;
const METERS_PER_MILE = 1609.34;
const DISPLAY_MERGE_THRESHOLD_KM = 2;
const DISPLAY_MERGE_THRESHOLD_METERS =
  DISPLAY_MERGE_THRESHOLD_KM * METERS_PER_KM;
const ACTIVITY_DATASET_URL = "/data/pac-tyler-activities.json";
const FILTER_MODE_ALL = "all";
const FILTER_MODE_YEAR = "year";
const FILTER_MODE_MONTH = "month";
const GRANULARITY_DAILY = "daily";
const GRANULARITY_WEEKLY = "weekly";
const DAYS_PER_WEEK = 7;
const DAY_INCREMENT = 1;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const CHART_VIEWBOX_WIDTH = 1000;
const CHART_VIEWBOX_HEIGHT = 320;
const CHART_PADDING = 48;
const CHART_POINT_RADIUS = 3;
const CHART_STROKE_WIDTH = 2;
const CHART_X_TICK_COUNT = 6;
const CHART_Y_TICK_COUNT = 4;
const CHART_MIN_RANGE_MILES = 1;
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;
const MONTH_LABEL_INTERVAL = 1;
const MONTH_INDEX_OFFSET = 1;

type LineCoordinates = [number, number][];
type MultiLineCoordinates = [number, number][][];

/**
 * GeoJSON Feature properties from Strava activities
 */
interface ActivityProperties {
  name: string;
  date: string;
  distance: number;
  type: string;
  activity_id?: number;
}

interface LineStringGeometry {
  type: "LineString";
  coordinates: LineCoordinates;
}

interface MultiLineStringGeometry {
  type: "MultiLineString";
  coordinates: MultiLineCoordinates;
}

type ActivityGeometry = LineStringGeometry | MultiLineStringGeometry;

/**
 * GeoJSON Feature representing a single bike ride
 */
interface ActivityFeature {
  type: "Feature";
  geometry: ActivityGeometry;
  properties: ActivityProperties;
}

/**
 * GeoJSON FeatureCollection of all activities
 */
interface GeoJSONData {
  type: "FeatureCollection";
  features: ActivityFeature[];
}

interface DisplayGeoJSONData {
  type: "FeatureCollection";
  features: ActivityFeature[];
}

interface ActivityDatasetEntry {
  activity_id: string | null;
  name?: string;
  date: string;
  distance_m: number;
  distance_mi: number;
  type?: string;
}

interface ActivityDataset {
  generated_at: string;
  activity_count: number;
  activities: ActivityDatasetEntry[];
}

interface MonthlyDistancePoint {
  monthKey: string;
  label: string;
  miles: number;
}

type FilterMode = typeof FILTER_MODE_ALL | typeof FILTER_MODE_YEAR | typeof FILTER_MODE_MONTH;
type MonthGranularity = typeof GRANULARITY_DAILY | typeof GRANULARITY_WEEKLY;

/**
 * Statistics calculated from activity data.
 */
interface RangeStats {
  totalMiles: number;
  activityCount: number;
  longestRide: number;
  averageMilesPerDay: number;
  startDate: string;
  endDate: string;
}

/**
 * Convert degrees to radians.
 *
 * @param value - Angle in degrees.
 * @returns Angle in radians.
 */
const toRadians = (value: number): number => (value * Math.PI) / 180;

/**
 * Compute the haversine distance between two lon/lat points.
 *
 * @param start - Start coordinate in [lon, lat].
 * @param end - End coordinate in [lon, lat].
 * @returns Distance in meters.
 */
const haversineMeters = (
  start: [number, number],
  end: [number, number]
): number => {
  const [startLon, startLat] = start;
  const [endLon, endLat] = end;
  const deltaLat = toRadians(endLat - startLat);
  const deltaLon = toRadians(endLon - startLon);
  const startLatRad = toRadians(startLat);
  const endLatRad = toRadians(endLat);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const aValue =
    sinLat * sinLat +
    Math.cos(startLatRad) * Math.cos(endLatRad) * sinLon * sinLon;
  const cValue = 2 * Math.atan2(Math.sqrt(aValue), Math.sqrt(1 - aValue));
  return EARTH_RADIUS_METERS * cValue;
};

/**
 * Build a stable key for an activity feature.
 *
 * @param props - Activity properties.
 * @returns Stable activity key.
 */
const buildActivityKey = (props: ActivityProperties): string => {
  if (props.activity_id !== undefined) {
    return `id:${props.activity_id}`;
  }

  return `meta:${props.name}|${props.date}|${props.distance}`;
};

/**
 * Merge adjacent line segments when the gap is within a display threshold.
 *
 * @param segments - Line segments to merge.
 * @returns Merged line segments.
 */
const mergeSegmentsForDisplay = (
  segments: LineCoordinates[]
): LineCoordinates[] => {
  if (segments.length <= 1) {
    return segments;
  }

  const merged: LineCoordinates[] = [];
  let current = [...segments[0]];

  for (const segment of segments.slice(1)) {
    const lastPoint = current[current.length - 1];
    const nextPoint = segment[0];
    if (!lastPoint || !nextPoint) {
      merged.push(current);
      current = [...segment];
      continue;
    }

    const gapMeters = haversineMeters(lastPoint, nextPoint);
    if (gapMeters <= DISPLAY_MERGE_THRESHOLD_METERS) {
      current = current.concat(segment);
      continue;
    }

    merged.push(current);
    current = [...segment];
  }

  merged.push(current);
  return merged;
};

/**
 * Build a display-optimized GeoJSON collection by merging segments.
 *
 * @param data - Source GeoJSON data.
 * @returns Display-ready GeoJSON data.
 */
const buildDisplayGeoJson = (data: GeoJSONData): DisplayGeoJSONData => {
  const grouped = new Map<string, LineCoordinates[]>();
  const propertiesByKey = new Map<string, ActivityProperties>();

  for (const feature of data.features) {
    if (feature.geometry.type !== "LineString") {
      continue;
    }

    const key = buildActivityKey(feature.properties);
    const existing = grouped.get(key) ?? [];
    existing.push(feature.geometry.coordinates);
    grouped.set(key, existing);
    if (!propertiesByKey.has(key)) {
      propertiesByKey.set(key, feature.properties);
    }
  }

  const displayFeatures: ActivityFeature[] = [];
  grouped.forEach((segments, key) => {
    const merged = mergeSegmentsForDisplay(segments);
    const properties = propertiesByKey.get(key);
    if (!properties) {
      return;
    }

    if (merged.length === 1) {
      displayFeatures.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: merged[0],
        },
        properties,
      });
      return;
    }

    displayFeatures.push({
      type: "Feature",
      geometry: {
        type: "MultiLineString",
        coordinates: merged,
      },
      properties,
    });
  });

  return {
    type: "FeatureCollection",
    features: displayFeatures,
  };
};

/**
 * Parse an ISO date string into a Date object.
 *
 * @param value - ISO date string.
 * @returns Parsed date or null if invalid.
 */
const parseIsoDate = (value: string): Date | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

/**
 * Format a date as YYYY-MM-DD in UTC.
 *
 * @param date - Date object.
 * @returns Formatted date string.
 */
const formatIsoDate = (date: Date): string => date.toISOString().split("T")[0];

/**
 * Build available year and month options from activity data.
 *
 * @param activities - Activity dataset entries.
 * @returns Available years and months sorted ascending.
 */
const buildRangeOptions = (
  activities: ActivityDatasetEntry[]
): { years: number[]; months: string[] } => {
  const years = new Set<number>();
  const months = new Set<string>();

  for (const activity of activities) {
    const parsedDate = parseIsoDate(activity.date);
    if (!parsedDate) {
      continue;
    }

    years.add(parsedDate.getUTCFullYear());
    months.add(getMonthKey(parsedDate));
  }

  return {
    years: Array.from(years).sort((a, b) => a - b),
    months: Array.from(months).sort(),
  };
};

/**
 * Filter activities by a selected range.
 *
 * @param activities - Activity dataset entries.
 * @param mode - Selected filter mode.
 * @param selectedYear - Selected year (if applicable).
 * @param selectedMonth - Selected month key (if applicable).
 * @returns Filtered activity list.
 */
const filterActivitiesByRange = (
  activities: ActivityDatasetEntry[],
  mode: FilterMode,
  selectedYear: number | null,
  selectedMonth: string | null
): ActivityDatasetEntry[] => {
  if (mode === FILTER_MODE_ALL) {
    return activities;
  }

  if (mode === FILTER_MODE_YEAR && selectedYear !== null) {
    return activities.filter((activity) => {
      const parsedDate = parseIsoDate(activity.date);
      return parsedDate ? parsedDate.getUTCFullYear() === selectedYear : false;
    });
  }

  if (mode === FILTER_MODE_MONTH && selectedMonth) {
    return activities.filter((activity) => {
      const parsedDate = parseIsoDate(activity.date);
      return parsedDate ? getMonthKey(parsedDate) === selectedMonth : false;
    });
  }

  return [];
};

/**
 * Calculate summary stats for a filtered activity set.
 *
 * @param activities - Filtered activity dataset entries.
 * @returns Range stats or null when no activities exist.
 */
const buildRangeStats = (activities: ActivityDatasetEntry[]): RangeStats | null => {
  if (activities.length === 0) {
    return null;
  }

  let totalMiles = 0;
  let longestRide = 0;
  let minTime: number | null = null;
  let maxTime: number | null = null;

  for (const activity of activities) {
    totalMiles += activity.distance_mi;
    if (activity.distance_mi > longestRide) {
      longestRide = activity.distance_mi;
    }

    const parsedDate = parseIsoDate(activity.date);
    if (!parsedDate) {
      continue;
    }

    const timestamp = parsedDate.getTime();
    minTime = minTime === null ? timestamp : Math.min(minTime, timestamp);
    maxTime = maxTime === null ? timestamp : Math.max(maxTime, timestamp);
  }

  if (minTime === null || maxTime === null) {
    return null;
  }

  const startDate = new Date(minTime);
  const endDate = new Date(maxTime);
  const startDay = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );
  const endDay = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate()
  );
  const daySpan = Math.max(1, Math.floor((endDay - startDay) / MILLISECONDS_PER_DAY) + 1);
  const averageMilesPerDay = totalMiles / daySpan;

  return {
    totalMiles,
    activityCount: activities.length,
    longestRide,
    averageMilesPerDay,
    startDate: formatIsoDate(startDate),
    endDate: formatIsoDate(endDate),
  };
};

/**
 * Build a month key in YYYY-MM format using UTC.
 *
 * @param date - Date object.
 * @returns Month key in YYYY-MM format.
 */
const getMonthKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + MONTH_INDEX_OFFSET).padStart(2, "0");
  return `${year}-${month}`;
};

/**
 * Format a month label for chart display.
 *
 * @param year - Four-digit year.
 * @param monthIndex - Zero-based month index.
 * @returns Human-readable month label.
 */
const formatMonthLabel = (year: number, monthIndex: number): string => {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return MONTH_LABEL_FORMATTER.format(date);
};

/**
 * Format a YYYY-MM month key for display.
 *
 * @param monthKey - Month key string.
 * @returns Human-readable month label.
 */
const formatMonthKeyLabel = (monthKey: string): string => {
  const [yearValue, monthValue] = monthKey.split("-");
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - MONTH_INDEX_OFFSET;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return monthKey;
  }

  return formatMonthLabel(year, monthIndex);
};

/**
 * Parse a YYYY-MM month key into year and month index.
 *
 * @param monthKey - Month key string.
 * @returns Parsed year and month index or null.
 */
const parseMonthKey = (
  monthKey: string
): { year: number; monthIndex: number } | null => {
  const [yearValue, monthValue] = monthKey.split("-");
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - MONTH_INDEX_OFFSET;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return null;
  }

  return { year, monthIndex };
};

/**
 * Build daily distance totals for a specific month.
 *
 * @param activities - Activity dataset entries.
 * @param selectedMonth - Selected month key.
 * @returns Daily distance series.
 */
const buildDailyDistanceSeries = (
  activities: ActivityDatasetEntry[],
  selectedMonth: string | null
): MonthlyDistancePoint[] => {
  if (!selectedMonth) {
    return [];
  }

  const parsedMonth = parseMonthKey(selectedMonth);
  if (!parsedMonth) {
    return [];
  }

  const { year, monthIndex } = parsedMonth;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + DAY_INCREMENT, 0));
  const dailyTotals = new Map<string, number>();

  for (const activity of activities) {
    const parsedDate = parseIsoDate(activity.date);
    if (!parsedDate) {
      continue;
    }

    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== monthIndex
    ) {
      continue;
    }

    const dayKey = formatIsoDate(parsedDate);
    dailyTotals.set(dayKey, (dailyTotals.get(dayKey) ?? 0) + activity.distance_mi);
  }

  const series: MonthlyDistancePoint[] = [];
  for (
    let current = new Date(start);
    current <= end;
    current = new Date(
      Date.UTC(
        current.getUTCFullYear(),
        current.getUTCMonth(),
        current.getUTCDate() + DAY_INCREMENT
      )
    )
  ) {
    const dayKey = formatIsoDate(current);
    series.push({
      monthKey: dayKey,
      label: DAY_LABEL_FORMATTER.format(current),
      miles: dailyTotals.get(dayKey) ?? 0,
    });
  }

  return series;
};

/**
 * Build weekly distance totals for a specific month.
 *
 * @param activities - Activity dataset entries.
 * @param selectedMonth - Selected month key.
 * @returns Weekly distance series.
 */
const buildWeeklyDistanceSeries = (
  activities: ActivityDatasetEntry[],
  selectedMonth: string | null
): MonthlyDistancePoint[] => {
  if (!selectedMonth) {
    return [];
  }

  const parsedMonth = parseMonthKey(selectedMonth);
  if (!parsedMonth) {
    return [];
  }

  const { year, monthIndex } = parsedMonth;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + DAY_INCREMENT, 0));
  const dailyTotals = new Map<string, number>();

  for (const activity of activities) {
    const parsedDate = parseIsoDate(activity.date);
    if (!parsedDate) {
      continue;
    }

    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== monthIndex
    ) {
      continue;
    }

    const dayKey = formatIsoDate(parsedDate);
    dailyTotals.set(dayKey, (dailyTotals.get(dayKey) ?? 0) + activity.distance_mi);
  }

  const series: MonthlyDistancePoint[] = [];
  for (
    let weekStart = new Date(start);
    weekStart <= end;
    weekStart = new Date(
      Date.UTC(
        weekStart.getUTCFullYear(),
        weekStart.getUTCMonth(),
        weekStart.getUTCDate() + DAYS_PER_WEEK
      )
    )
  ) {
    const weekEndCandidate = new Date(
      Date.UTC(
        weekStart.getUTCFullYear(),
        weekStart.getUTCMonth(),
        weekStart.getUTCDate() + DAYS_PER_WEEK - DAY_INCREMENT
      )
    );
    const weekEnd = weekEndCandidate > end ? end : weekEndCandidate;
    let miles = 0;

    for (
      let current = new Date(weekStart);
      current <= weekEnd;
      current = new Date(
        Date.UTC(
          current.getUTCFullYear(),
          current.getUTCMonth(),
          current.getUTCDate() + DAY_INCREMENT
        )
      )
    ) {
      const dayKey = formatIsoDate(current);
      miles += dailyTotals.get(dayKey) ?? 0;
    }

    series.push({
      monthKey: `week-${formatIsoDate(weekStart)}`,
      label: `Week of ${DAY_LABEL_FORMATTER.format(weekStart)}`,
      miles,
    });
  }

  return series;
};

/**
 * Build monthly distance totals from activity data.
 *
 * @param activities - Activity dataset entries.
 * @returns Monthly distance series.
 */
const buildMonthlyDistanceSeries = (
  activities: ActivityDatasetEntry[]
): MonthlyDistancePoint[] => {
  const totals = new Map<string, number>();
  let minTime: number | null = null;
  let maxTime: number | null = null;

  for (const activity of activities) {
    const parsedDate = parseIsoDate(activity.date);
    if (!parsedDate) {
      continue;
    }

    const timestamp = parsedDate.getTime();
    minTime = minTime === null ? timestamp : Math.min(minTime, timestamp);
    maxTime = maxTime === null ? timestamp : Math.max(maxTime, timestamp);

    const monthKey = getMonthKey(parsedDate);
    const currentMiles = totals.get(monthKey) ?? 0;
    totals.set(monthKey, currentMiles + activity.distance_mi);
  }

  if (minTime === null || maxTime === null) {
    return [];
  }

  const minDate = new Date(minTime);
  const maxDate = new Date(maxTime);
  const series: MonthlyDistancePoint[] = [];
  const start = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), 1));

  for (
    let current = new Date(start);
    current <= end;
    current = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + MONTH_LABEL_INTERVAL, 1)
    )
  ) {
    const monthKey = getMonthKey(current);
    const miles = totals.get(monthKey) ?? 0;
    series.push({
      monthKey,
      label: formatMonthLabel(current.getUTCFullYear(), current.getUTCMonth()),
      miles,
    });
  }

  return series;
};

/**
 * Build chart points mapped to the SVG viewbox.
 *
 * @param data - Monthly distance series.
 * @param maxMiles - Maximum miles value.
 * @returns Mapped chart points.
 */
const buildChartPoints = (
  data: MonthlyDistancePoint[],
  maxMiles: number
): { x: number; y: number; label: string; miles: number }[] => {
  const chartWidth = CHART_VIEWBOX_WIDTH - CHART_PADDING * 2;
  const chartHeight = CHART_VIEWBOX_HEIGHT - CHART_PADDING * 2;
  const safeMaxMiles = maxMiles > 0 ? maxMiles : CHART_MIN_RANGE_MILES;

  return data.map((point, index) => {
    const divisor = data.length > 1 ? data.length - 1 : 1;
    const x = CHART_PADDING + (index / divisor) * chartWidth;
    const yValue = point.miles / safeMaxMiles;
    const y = CHART_PADDING + (1 - yValue) * chartHeight;
    return {
      x,
      y,
      label: point.label,
      miles: point.miles,
    };
  });
};

/**
 * Build an SVG path string for chart points.
 *
 * @param points - Chart points in viewbox coordinates.
 * @returns SVG path string.
 */
const buildChartPath = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
};

/**
 * Build evenly spaced x-axis tick indices.
 *
 * @param count - Number of data points.
 * @returns X-axis tick indices.
 */
const buildTickIndices = (count: number): number[] => {
  if (count <= 1) {
    return [0];
  }

  const tickCount = Math.min(CHART_X_TICK_COUNT, count);
  const step = Math.max(1, Math.floor((count - 1) / (tickCount - 1)));
  const indices: number[] = [];

  for (let index = 0; index < count; index += step) {
    indices.push(index);
  }

  if (indices[indices.length - 1] !== count - 1) {
    indices.push(count - 1);
  }

  return indices;
};

/**
 * Props for the distance chart.
 */
interface MonthlyDistanceChartProps {
  data: MonthlyDistancePoint[];
  title: string;
  onPointSelect?: (point: MonthlyDistancePoint) => void;
  isPointSelectable: boolean;
}

/**
 * Distance chart for Pac-Tyler activities.
 *
 * @param props - Chart props.
 * @returns Chart component.
 */
function MonthlyDistanceChart({
  data,
  title,
  onPointSelect,
  isPointSelectable,
}: MonthlyDistanceChartProps) {
  if (data.length === 0) {
    return null;
  }

  const maxMiles = Math.max(...data.map((point) => point.miles));
  const points = buildChartPoints(data, maxMiles);
  const path = buildChartPath(points);
  const tickIndices = buildTickIndices(data.length);
  const yTickStep = maxMiles / CHART_Y_TICK_COUNT;
  const [hoveredPoint, setHoveredPoint] = useState<{
    key: string;
    label: string;
    miles: number;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div className="bg-[#1a1a1a] border-2 border-[#E3B800] rounded-lg p-4">
      <div className="font-mono text-[#E3B800] text-sm uppercase tracking-wider mb-3">
        {title}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_VIEWBOX_WIDTH} ${CHART_VIEWBOX_HEIGHT}`}
          className="w-full h-64"
          role="img"
          aria-label="Monthly distance chart"
        >
          <rect
            x={0}
            y={0}
            width={CHART_VIEWBOX_WIDTH}
            height={CHART_VIEWBOX_HEIGHT}
            fill="#1a1a1a"
          />
          <line
            x1={CHART_PADDING}
            y1={CHART_PADDING}
            x2={CHART_PADDING}
            y2={CHART_VIEWBOX_HEIGHT - CHART_PADDING}
            stroke="#2f2f2f"
            strokeWidth={1}
          />
          <line
            x1={CHART_PADDING}
            y1={CHART_VIEWBOX_HEIGHT - CHART_PADDING}
            x2={CHART_VIEWBOX_WIDTH - CHART_PADDING}
            y2={CHART_VIEWBOX_HEIGHT - CHART_PADDING}
            stroke="#2f2f2f"
            strokeWidth={1}
          />
          {Array.from({ length: CHART_Y_TICK_COUNT + 1 }).map((_, index) => {
            const value = yTickStep * index;
            const yValue = maxMiles > 0 ? value / maxMiles : 0;
            const y =
              CHART_VIEWBOX_HEIGHT - CHART_PADDING -
              (CHART_VIEWBOX_HEIGHT - CHART_PADDING * 2) * yValue;
            return (
              <g key={`y-${index}`}>
                <line
                  x1={CHART_PADDING}
                  y1={y}
                  x2={CHART_VIEWBOX_WIDTH - CHART_PADDING}
                  y2={y}
                  stroke="#2a2a2a"
                  strokeWidth={1}
                />
                <text
                  x={CHART_PADDING - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#9ca3af"
                  fontFamily="Courier New, monospace"
                  fontSize={12}
                >
                  {value.toFixed(0)}
                </text>
              </g>
            );
          })}
          <path
            d={path}
            fill="none"
            stroke="#E3B800"
            strokeWidth={CHART_STROKE_WIDTH}
          />
          {points.map((point, index) => {
            const chartPoint = {
              key: data[index].monthKey,
              label: data[index].label,
              miles: data[index].miles,
              x: point.x,
              y: point.y,
            };

            return (
              <g key={`point-${data[index].monthKey}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={CHART_POINT_RADIUS}
                  fill="#E3B800"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={CHART_POINT_RADIUS * 3}
                  fill="transparent"
                  className={isPointSelectable ? "cursor-pointer" : undefined}
                  onMouseEnter={() => setHoveredPoint(chartPoint)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onClick={() => onPointSelect?.(data[index])}
                />
              </g>
            );
          })}
          {tickIndices.map((index) => {
            const point = points[index];
            return (
              <text
                key={`x-${data[index].monthKey}`}
                x={point.x}
                y={CHART_VIEWBOX_HEIGHT - CHART_PADDING + 20}
                textAnchor="middle"
                fill="#9ca3af"
                fontFamily="Courier New, monospace"
                fontSize={12}
              >
                {data[index].label}
              </text>
            );
          })}
        </svg>
        {hoveredPoint && (
          <div
            className="absolute pointer-events-none bg-black/90 border border-[#E3B800] text-[#E3B800] px-3 py-2 rounded text-xs font-mono whitespace-nowrap"
            style={{
              left: `${(hoveredPoint.x / CHART_VIEWBOX_WIDTH) * 100}%`,
              top: `${(hoveredPoint.y / CHART_VIEWBOX_HEIGHT) * 100}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            <div>{hoveredPoint.label}</div>
            <div>{hoveredPoint.miles.toFixed(1)} mi</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Interactive map component displaying Pac-Tyler biking routes
 * Styled with retro Pac-Man arcade aesthetic
 *
 * @remarks
 * This component:
 * - Loads GeoJSON activity data from GitHub
 * - Renders routes on a dark-themed map
 * - Displays routes in signature gold (#E3B800) color
 * - Calculates and displays activity statistics
 */
export default function PacTylerMapClient() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityDataset, setActivityDataset] = useState<ActivityDatasetEntry[]>(
    []
  );
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>(FILTER_MODE_ALL);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthGranularity, setMonthGranularity] = useState<MonthGranularity>(
    GRANULARITY_DAILY
  );
  const [datasetError, setDatasetError] = useState<string | null>(null);

  const filteredActivities = useMemo(
    () =>
      filterActivitiesByRange(
        activityDataset,
        filterMode,
        selectedYear,
        selectedMonth
      ),
    [activityDataset, filterMode, selectedYear, selectedMonth]
  );

  const rangeStats = useMemo(
    () => buildRangeStats(filteredActivities),
    [filteredActivities]
  );

  const chartDistance = useMemo(() => {
    if (filterMode === FILTER_MODE_MONTH) {
      return monthGranularity === GRANULARITY_WEEKLY
        ? buildWeeklyDistanceSeries(filteredActivities, selectedMonth)
        : buildDailyDistanceSeries(filteredActivities, selectedMonth);
    }

    return buildMonthlyDistanceSeries(filteredActivities);
  }, [filteredActivities, filterMode, monthGranularity, selectedMonth]);

  const chartTitle = useMemo(() => {
    if (filterMode === FILTER_MODE_MONTH) {
      return monthGranularity === GRANULARITY_WEEKLY
        ? "Distance Per Week"
        : "Distance Per Day";
    }

    return "Distance Per Month";
  }, [filterMode, monthGranularity]);

  /**
   * Drill down into a month when a chart point is selected.
   *
   * @param point - Selected chart point.
   */
  const handlePointSelect = (point: MonthlyDistancePoint): void => {
    if (filterMode === FILTER_MODE_MONTH) {
      return;
    }

    if (!MONTH_KEY_PATTERN.test(point.monthKey)) {
      return;
    }

    setFilterMode(FILTER_MODE_MONTH);
    setSelectedMonth(point.monthKey);
    setMonthGranularity(GRANULARITY_DAILY);
  };

  useEffect(() => {
    /**
     * Fetch the derived activity dataset used by analytics charts.
     *
     * @returns Promise that resolves when the dataset is loaded.
     */
    const loadActivityDataset = async (): Promise<void> => {
      try {
        const response = await fetch(ACTIVITY_DATASET_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch dataset: ${response.statusText}`);
        }

        const dataset: ActivityDataset = await response.json();
        const activities = dataset.activities ?? [];
        setActivityDataset(activities);
        const options = buildRangeOptions(activities);
        setAvailableYears(options.years);
        setAvailableMonths(options.months);
        setSelectedYear((previous) => {
          if (previous !== null && options.years.includes(previous)) {
            return previous;
          }
          return options.years.length > 0
            ? options.years[options.years.length - 1]
            : null;
        });
        setSelectedMonth((previous) => {
          if (previous && options.months.includes(previous)) {
            return previous;
          }
          return options.months.length > 0
            ? options.months[options.months.length - 1]
            : null;
        });
      } catch (err) {
        console.error("Error loading activity dataset:", err);
        setDatasetError(
          err instanceof Error ? err.message : "Failed to load activity dataset"
        );
      }
    };

    loadActivityDataset();
  }, []);

  useEffect(() => {
    // Prevent re-initialization
    if (mapRef.current) return;
    if (!mapContainerRef.current) return;

    // Wait for next tick to ensure DOM is fully ready
    const timeoutId = setTimeout(() => {
      if (!mapContainerRef.current) return;

      try {
        // Initialize map centered on San Diego
        const map = L.map(mapContainerRef.current, {
          center: [32.7157, -117.1611], // San Diego coordinates
          zoom: 11,
          zoomControl: true,
        });

        mapRef.current = map;

        // Use dark themed tiles for Pac-Man aesthetic
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          {
            attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }
    ).addTo(map);

    /**
     * Fetches and renders GeoJSON activity data.
     *
     * @returns Promise that resolves when the map layer is ready.
     */
    const loadGeoJSON = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          "https://raw.githubusercontent.com/Tyler-Schwenk/Pac-Tyler/main/cleaned_output.geojson"
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const data: GeoJSONData = await response.json();

        if (!data.features || data.features.length === 0) {
          setError("No activity data available yet. Start biking!");
          setLoading(false);
          return;
        }

        // Style function for GeoJSON layer - Pac-Man gold color
        const style = {
          color: "#E3B800", // Signature Pac-Tyler gold
          weight: 2,
          opacity: 0.8,
        };

        const displayData = buildDisplayGeoJson(data);

        // Add GeoJSON layer to map
        L.geoJSON(displayData, {
          style,
          onEachFeature: (feature, layer) => {
            // Add popup with activity details
            const props = feature.properties;
            layer.bindPopup(`
              <div style="color: #1a1a1a; font-family: 'Courier New', monospace;">
                <strong style="color: #E3B800;">${props.name}</strong><br/>
                <strong>Date:</strong> ${new Date(props.date).toLocaleDateString()}<br/>
                <strong>Distance:</strong> ${(props.distance / METERS_PER_MILE).toFixed(2)} mi<br/>
                <strong>Type:</strong> ${props.type}
              </div>
            `);
          },
        }).addTo(map);

        setLoading(false);
      } catch (err) {
        console.error("Error loading GeoJSON:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load activity data"
        );
        setLoading(false);
      }
    };

    loadGeoJSON();
      } catch (err) {
        console.error("Error initializing map:", err);
        setError("Failed to initialize map");
        setLoading(false);
      }
    }, 100);

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-pulse text-[#E3B800] text-xl font-mono">
            Loading Pac-Tyler data...
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-200 px-4 py-3 rounded font-mono">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-[600px] rounded-lg border-4 border-[#E3B800] shadow-[0_0_20px_rgba(227,184,0,0.3)] relative z-0"
        style={{ background: "#1a1a1a" }}
      />

      {/* Legend */}
      <div className="bg-[#1a1a1a] border-2 border-[#E3B800] rounded p-4 font-mono text-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 bg-[#E3B800]"></div>
            <span className="text-[#E3B800]">Completed Routes</span>
          </div>
          <div className="text-gray-400">Click any route for details</div>
        </div>
      </div>

      <details
        className="bg-[#1a1a1a] border-2 border-[#E3B800] rounded-lg p-6 shadow-[0_0_20px_rgba(227,184,0,0.2)]"
        open
      >
        <summary className="cursor-pointer font-mono text-[#E3B800] text-lg">
          Activity Stats &amp; Distance
        </summary>
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wider text-gray-400 font-mono">
                Range
              </label>
              <select
                className="bg-black/40 border border-[#E3B800]/60 text-[#E3B800] font-mono text-sm rounded px-3 py-2"
                value={filterMode}
                onChange={(event) => {
                  const nextMode = event.target.value as FilterMode;
                  setFilterMode(nextMode);
                  if (nextMode === FILTER_MODE_YEAR && selectedYear === null) {
                    setSelectedYear(
                      availableYears.length > 0
                        ? availableYears[availableYears.length - 1]
                        : null
                    );
                  }
                  if (nextMode === FILTER_MODE_MONTH && selectedMonth === null) {
                    setSelectedMonth(
                      availableMonths.length > 0
                        ? availableMonths[availableMonths.length - 1]
                        : null
                    );
                  }
                }}
              >
                <option value={FILTER_MODE_ALL}>All Time</option>
                <option value={FILTER_MODE_YEAR}>Year</option>
                <option value={FILTER_MODE_MONTH}>Month</option>
              </select>
            </div>

            {filterMode === FILTER_MODE_YEAR && (
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-mono">
                  Year
                </label>
                <select
                  className="bg-black/40 border border-[#E3B800]/60 text-[#E3B800] font-mono text-sm rounded px-3 py-2"
                  value={selectedYear ?? ""}
                  onChange={(event) =>
                    setSelectedYear(
                      event.target.value ? Number(event.target.value) : null
                    )
                  }
                >
                  {availableYears.map((year) => (
                    <option key={`year-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filterMode === FILTER_MODE_MONTH && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-wider text-gray-400 font-mono">
                    Month
                  </label>
                  <select
                    className="bg-black/40 border border-[#E3B800]/60 text-[#E3B800] font-mono text-sm rounded px-3 py-2"
                    value={selectedMonth ?? ""}
                    onChange={(event) =>
                      setSelectedMonth(event.target.value || null)
                    }
                  >
                    {availableMonths.map((monthKey) => (
                      <option key={`month-${monthKey}`} value={monthKey}>
                        {formatMonthKeyLabel(monthKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-wider text-gray-400 font-mono">
                    Detail
                  </label>
                  <select
                    className="bg-black/40 border border-[#E3B800]/60 text-[#E3B800] font-mono text-sm rounded px-3 py-2"
                    value={monthGranularity}
                    onChange={(event) =>
                      setMonthGranularity(event.target.value as MonthGranularity)
                    }
                  >
                    <option value={GRANULARITY_DAILY}>Daily</option>
                    <option value={GRANULARITY_WEEKLY}>Weekly</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {datasetError && (
            <div className="bg-red-900/20 border border-red-500 text-red-200 px-4 py-3 rounded font-mono">
              <strong>Error:</strong> {datasetError}
            </div>
          )}

          {!datasetError && rangeStats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                label="Total Miles"
                value={rangeStats.totalMiles.toFixed(1)}
                icon="Miles"
              />
              <StatCard
                label="Activities"
                value={rangeStats.activityCount.toString()}
                icon="Count"
              />
              <StatCard
                label="Longest Ride"
                value={`${rangeStats.longestRide.toFixed(1)} mi`}
                icon="Max"
              />
              <StatCard
                label="Avg Miles/Day"
                value={rangeStats.averageMilesPerDay.toFixed(2)}
                icon="Avg"
              />
              <StatCard
                label="Start Date"
                value={rangeStats.startDate}
                icon="Start"
                small
              />
              <StatCard
                label="End Date"
                value={rangeStats.endDate}
                icon="End"
                small
              />
            </div>
          )}

          {!datasetError && !rangeStats && (
            <div className="text-sm text-gray-400 font-mono">
              No activity data available for the selected range.
            </div>
          )}

          {!datasetError && chartDistance.length > 0 && (
            <MonthlyDistanceChart
              data={chartDistance}
              title={chartTitle}
              onPointSelect={handlePointSelect}
              isPointSelectable={filterMode !== FILTER_MODE_MONTH}
            />
          )}
        </div>
      </details>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  small?: boolean;
}

/**
 * Retro-styled stat card component.
 *
 * @param props - Stat card props.
 * @returns Stat card component.
 */
function StatCard({ label, value, icon, small = false }: StatCardProps) {
  return (
    <div className="bg-[#1a1a1a] border-2 border-[#E3B800] rounded-lg p-4 text-center hover:shadow-[0_0_15px_rgba(227,184,0,0.4)] transition-shadow">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-gray-400 text-xs uppercase tracking-wider mb-1 font-mono">
        {label}
      </div>
      <div
        className={`text-[#E3B800] font-bold font-mono ${small ? "text-sm" : "text-2xl"}`}
      >
        {value}
      </div>
    </div>
  );
}
