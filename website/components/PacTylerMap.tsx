"use client";

import dynamic from "next/dynamic";

/**
 * Pac-Tyler Map Wrapper Component
 *
 * Dynamically loads the Leaflet map to avoid SSR issues.
 * Leaflet requires browser APIs (window, document) which aren't
 * available during Next.js static generation.
 *
 * @remarks
 * The actual map implementation is in PacTylerMapClient.tsx
 */

// Dynamically import Leaflet map to avoid SSR issues
const MapComponent = dynamic(
  () => import("./PacTylerMapClient").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] rounded-lg border-4 border-[#E3B800] bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-pulse text-[#E3B800] text-xl font-mono">
            Loading map...
          </div>
        </div>
      </div>
    ),
  }
);

export default function PacTylerMap() {
  return <MapComponent />;
}

