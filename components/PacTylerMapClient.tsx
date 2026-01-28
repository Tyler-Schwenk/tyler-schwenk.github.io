"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const EARTH_RADIUS_METERS = 6371000;
const METERS_PER_KM = 1000;
const DISPLAY_MERGE_THRESHOLD_KM = 2;
const DISPLAY_MERGE_THRESHOLD_METERS =
  DISPLAY_MERGE_THRESHOLD_KM * METERS_PER_KM;

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

/**
 * Statistics calculated from activity data
 */
interface PacTylerStats {
  totalDistance: number; // in miles
  totalActivities: number;
  totalStreets: number;
  longestRide: number; // in miles
  firstActivity: string;
  lastActivity: string;
}

const toRadians = (value: number): number => (value * Math.PI) / 180;

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

const buildActivityKey = (props: ActivityProperties): string => {
  if (props.activity_id !== undefined) {
    return `id:${props.activity_id}`;
  }

  return `meta:${props.name}|${props.date}|${props.distance}`;
};

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
  const [stats, setStats] = useState<PacTylerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
     * Calculates statistics from GeoJSON activity data
     */
    const calculateStats = (data: GeoJSONData): PacTylerStats => {
      const features = data.features;
      const distances = features.map((f) => f.properties.distance);
      const dates = features.map((f) => new Date(f.properties.date));

      return {
        totalDistance: distances.reduce((sum, d) => sum + d, 0) / 1609.34, // Convert meters to miles
        totalActivities: features.length,
        totalStreets: features.length, // Placeholder - could be calculated from unique street intersections
        longestRide: Math.max(...distances) / 1609.34,
        firstActivity: new Date(Math.min(...dates.map((d) => d.getTime())))
          .toISOString()
          .split("T")[0],
        lastActivity: new Date(Math.max(...dates.map((d) => d.getTime())))
          .toISOString()
          .split("T")[0],
      };
    };

    /**
     * Fetches and renders GeoJSON activity data
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

        // Calculate statistics
        const calculatedStats = calculateStats(data);
        setStats(calculatedStats);

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
                <strong>Distance:</strong> ${(props.distance / 1609.34).toFixed(2)} mi<br/>
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

      {/* Statistics Dashboard - Retro Arcade Style */}
      {stats && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Total Miles"
            value={stats.totalDistance.toFixed(1)}
            icon="Miles"
          />
          <StatCard
            label="Activities"
            value={stats.totalActivities.toString()}
            icon="Count"
          />
          <StatCard
            label="Longest Ride"
            value={`${stats.longestRide.toFixed(1)} mi`}
            icon="Max"
          />
          <StatCard
            label="First Ride"
            value={stats.firstActivity}
            icon="Start"
            small
          />
          <StatCard
            label="Latest Ride"
            value={stats.lastActivity}
            icon="Recent"
            small
          />
          <StatCard
            label="Total Streets"
            value={stats.totalActivities.toString()}
            icon="Streets"
          />
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
    </div>
  );
}

/**
 * Retro-styled stat card component
 */
interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  small?: boolean;
}

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
