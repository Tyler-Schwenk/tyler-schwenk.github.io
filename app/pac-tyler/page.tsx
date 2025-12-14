import Image from "next/image";
import PacTylerMap from "@/components/PacTylerMap";
import BikeQuiver, { type Bike } from "@/components/BikeQuiver";

/**
 * Pac-Tyler Project Page
 *
 * A gamified biking challenge inspired by Pac-Man, where the goal is to bike
 * every street in San Diego. This page displays an interactive map showing
 * completed routes and statistics about the ongoing journey.
 *
 * @remarks
 * - Integrates with Strava API via Python backend to fetch activity data
 * - GeoJSON data is cleaned to remove GPS errors and pauses
 * - Map styled with retro arcade aesthetic (#E3B800 gold on dark background)
 * - Data source: https://github.com/Tyler-Schwenk/Pac-Tyler
 */

// Placeholder bike data - Update with actual bike information
const BIKES: Bike[] = [
  {
    id: "bike-1",
    name: "Bike #1",
    thumbnail: "/images/pic08.jpg", // Replace with actual bike photo
    images: ["/images/pic08.jpg"], // Replace with actual bike photos
    yearsOwned: "2020-2022",
    totalMiles: 500,
    description:
      "Add your bike story here. Describe what made this bike special, memorable rides, modifications, etc.",
    specs: {
      brand: "Brand Name",
      model: "Model Name",
      year: 2020,
      type: "Road/Mountain/Hybrid",
    },
    decommissionReason: "Add reason why this bike was retired or lost.",
  },
  // Add more bikes here...
];

export default function PacTyler() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header with Logo */}
        <header className="text-center mb-12">
          <div className="relative w-full max-w-2xl mx-auto mb-8">
            <Image
              src="/images/logo-Pac-Tyler.png"
              alt="Pac-Tyler Logo"
              width={800}
              height={300}
              className="w-full h-auto"
              priority
            />
          </div>

          {/* Retro Title Bar */}
          <div className="inline-flex items-center gap-8 bg-black border-4 border-[#E3B800] px-8 py-3 rounded font-mono text-[#E3B800] shadow-[0_0_20px_rgba(227,184,0,0.5)]">
            <span className="text-sm">1UP</span>
            <span className="text-xl font-bold">PAC-TYLER</span>
            <span className="text-sm">HI SCORE: 1236 MI</span>
          </div>
        </header>

        {/* Project Description */}
        <section className="mb-12">
          <div className="bg-[#1a1a1a] border-2 border-[#E3B800] rounded-lg p-8 shadow-[0_0_20px_rgba(227,184,0,0.2)]">
            <p className="text-lg text-[#E3B800] leading-relaxed font-mono">
              This is an ongoing project where I am attempting to bike the
              length of every street in San Diego, and have developed software
              to track my progress. It&apos;s like Pac-Man but instead of
              ghosts trying to kill you, cars are.
            </p>

            {/* Inspiration Credit */}
            <div className="mt-6 pt-6 border-t border-[#E3B800]/30">
              <p className="text-sm text-gray-400 font-mono">
                Inspired by{" "}
                <a
                  href="https://www.youtube.com/watch?v=1c8i5SABqwU"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#E3B800] hover:text-[#ffd700] underline transition-colors"
                >
                  Pac-Tom
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Map and Stats */}
        <section>
          <PacTylerMap />
        </section>

        {/* Technical Details */}
        <section className="mt-12">
          <div className="bg-[#1a1a1a] border-2 border-[#E3B800] rounded-lg p-8">
            <h2 className="text-2xl font-bold text-[#E3B800] mb-4 font-mono">
              🔧 How It Works
            </h2>
            <div className="space-y-4 text-gray-300 font-mono text-sm leading-relaxed">
              <div>
                <strong className="text-[#E3B800]">
                  Automated Data Retrieval:
                </strong>{" "}
                Python script downloads all activities from Strava API,
                resampling GPS points for optimal file size
              </div>
              <div>
                <strong className="text-[#E3B800]">Error Correction:</strong>{" "}
                Removes false paths created when activities are paused and
                resumed in different locations
              </div>
              <div>
                <strong className="text-[#E3B800]">Idempotent Updates:</strong>{" "}
                New activities are automatically added without duplicating data
              </div>
              <div>
                <strong className="text-[#E3B800]">Open Source:</strong>{" "}
                <a
                  href="https://github.com/Tyler-Schwenk/Pac-Tyler"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#E3B800] hover:text-[#ffd700] underline transition-colors"
                >
                  View the code on GitHub
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Bike Quiver Section */}
        <section className="mt-12">
          <BikeQuiver bikes={BIKES} />
        </section>
      </div>
    </main>
  );
}


