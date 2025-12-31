import Image from "next/image";
import PacTylerMap from "@/components/PacTylerMap";
import BikeQuiver, { type Bike } from "@/components/BikeQuiver";
import PageWrapper from "@/components/PageWrapper";

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

// Bike data 
const BIKES: Bike[] = [
  {
    id: "bike-1",
    name: "Kyle's mom's Gary Fisher",
    thumbnail: "/images/bikes/garyfisher.jpg",
    images: ["/images/bikes/garyfisher.jpg"],
    acquired: "2020",
    decommissioned: "2022",
    totalMiles: 500,
    description:
      "When I lost my job and came to San Diego Kyle let me borrow his mom's old Gary Fisher she rode in college. It served me very well while I sorted my life out",
    specs: {
      brand: "Gary Fisher",
      model: "IDK",
      year: 1995,
      type: "Mountain",
    },
    decommissionReason: "Returned to owner upon purchase of the Dave Scott. It was later stolen :(",
  },
  {
    id: "bike-2",
    name: "Dave Scott",
    thumbnail: "/images/bikes/davescott.jpg",
    images: ["/images/bikes/davescott.jpg","/images/bikes/davescoottridde.jpg","/images/bikes/davescottride.jpg"],
    acquired: "2020",
    decommissioned: "2022",
    totalMiles: 500,
    description:
      "The Dave Scott was beautiful - and it put up being ridden very hard in my early days of biking. It rode down 3000 ft of rocks descent in Red Rocks without a complaint. Still, the mighty must fall. It eventually succumbed to a failure at the bottom bracket. Still - its pedals lived to see many more bikes.",
    specs: {
      brand: "Centurion",
      model: "Dave Scott Expert", // https://www.vintagecenturion.com/models/competition/ironman/87-89_expert.shtml
      year: 1987,
      type: "Road",
    },
    decommissionReason: "Ran into the ground",
  },
  {
    id: "bike-3",
    name: "MilkMan",
    thumbnail: "/images/bikes/milkman.jpg",
    images: ["/images/bikes/milkman.jpg","/images/bikes/milkman2.jpg","/images/bikes/redbike.jpg"],
    acquired: "2020",
    decommissioned: "2022",
    totalMiles: 500,
    description:
      "The MilkMan was my first introduction to weightmaxing on a commuter bike and I never looked back. It's also when I really began to love biking for the joy of it, and hit my stride in being able to support myself with maintenance. It had a perpetual squeak that persisted even though a full cleaning and regrease of the bottom bracket. Originally a milk crate based cargo system, it evolved to see a new life with bullhorns on the cruizer bars for maximum aerodyamics, and my first custom frame bag. Some say it may be refurbished to see a thrid iteration.",
    specs: {
      brand: "Centurion",
      model: "Accord?", 
      year: 1988,
      type: "Road",
    },
    decommissionReason: "Retired at bend rear axle",
  },
  // Add more bikes here...
];

export default function PacTyler() {
  return (
    <PageWrapper>
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

        {/* Bike Quiver Section */}
        <section className="mt-12">
          <BikeQuiver bikes={BIKES} />
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
        
      </div>
    </main>
    </PageWrapper>
  );
}


