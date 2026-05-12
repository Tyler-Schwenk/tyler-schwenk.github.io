import Image from "next/image";
import PacTylerMap from "@/components/PacTylerMap";
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
                    href="https://myhalfbakedideas.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E3B800] hover:text-[#ffd700] underline transition-colors"
                  >
                    Jeff.
                  </a>
                  {" "}One day, as I was moving back to San Diego and Jeff was looking to move away,
                  he described part of his motivation to leave. He compared living in a city for a long
                  time to be like being in a cottage in the woods after a snowfall. At first the options
                  are limitless, as you must blaze a trail in every direction. But after some time you stamp down
                  your main paths, and end up sticking to them out of convenience. This is an attempt to
                  continue exploring throughout my daily life.
                </p>
                <p className="text-sm text-gray-400 font-mono mt-2">
                  Also Inspired by{" "}
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

            {/* Interactive Map and Stats */}
            <div className="mt-12">
              <PacTylerMap />
            </div>
          </section>

          {/* Technical Details */}
          <section className="mt-12">
            <div className="bg-[#1a1a1a] border-2 border-[#E3B800] rounded-lg p-8">
              <h2 className="text-2xl font-bold text-[#E3B800] mb-4 font-mono">
                How It Works
              </h2>
              <div className="space-y-4 text-gray-300 font-mono text-sm leading-relaxed">
                <div>
                  <strong className="text-[#E3B800]">Automated Data Retrieval:</strong>{" "}
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

          {/* Inspiration Credit */}
          <div className="mt-8 text-center font-mono text-sm text-gray-500">
            Inspired by{" "}
            <a
              href="https://www.youtube.com/watch?v=1c8i5SABqwU"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-[#E3B800] underline transition-colors"
            >
              Tom7
            </a>
          </div>
        </div>
      </main>
    </PageWrapper>
  );
}
