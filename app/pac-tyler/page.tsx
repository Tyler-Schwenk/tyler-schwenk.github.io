"use client";

import Image from "next/image";
import { useEffect } from "react";
import type { Metadata } from "next";

// Can't export metadata from client component, will add via layout
export default function PacTyler() {
  useEffect(() => {
    // Dynamically load Leaflet CSS and JS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet/dist/leaflet.js";
    script.async = true;
    
    script.onload = () => {
      // Initialize map after Leaflet loads
      const L = (window as any).L;
      const map = L.map("map").setView([32.7157, -117.1611], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
      }).addTo(map);

      // Load GeoJSON
      fetch(
        "https://raw.githubusercontent.com/Tyler-Schwenk/Pac-Tyler/main/cleaned_output.geojson"
      )
        .then((response) => response.json())
        .then((data) => {
          L.geoJSON(data, {
            style: { color: "#E3B800", weight: 3 },
          }).addTo(map);
        })
        .catch((err: Error) => console.error("Failed to load GeoJSON:", err));
    };

    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Custom Retro Nav */}
      <nav className="bg-slate-900 border-b border-slate-700 py-4">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-center text-[#E3B800]">
            <p className="font-mono">1UP</p>
            <div className="flex space-x-8">
              <a href="/#home" className="hover:text-white transition-colors">
                Home
              </a>
              <a href="/#projects" className="hover:text-white transition-colors">
                Portfolio
              </a>
              <a href="/#contact" className="hover:text-white transition-colors">
                Contact
              </a>
            </div>
            <p className="font-mono">MI SCORE: 1236</p>
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="bg-black text-center py-12">
        <Image
          src="/images/logo-Pac-Tyler.png"
          alt="Pac-Tyler Logo"
          width={600}
          height={300}
          className="mx-auto"
        />
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Description */}
          <div className="md:col-span-1 bg-[#333] p-6 rounded-lg text-[#E3B800]">
            <p className="mb-4">
              This is an ongoing project where I am attempting to bike the length of every street in San Diego, and have developed software to
              track my progress. Its like Pac-Man but instead of ghosts trying to kill you, cars are.
            </p>
            <p className="mb-4">
              I use Strava to track my bike rides around the city. A custom python tool downloads my rides from Strava as
              GeoJSON files before cleaning the data to remove errors and reduce file size. This data is fed to Mapbox for display.
            </p>
            <p>
              View the source code on{" "}
              <a
                href="https://github.com/Tyler-Schwenk/Pac-Tyler"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white underline transition-colors inline-flex items-center gap-2"
              >
                GitHub
              </a>
            </p>
          </div>

          {/* Map Container */}
          <div className="md:col-span-2 h-[600px] bg-[#1a1a1a] rounded-lg overflow-hidden">
            <div id="map" className="w-full h-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
