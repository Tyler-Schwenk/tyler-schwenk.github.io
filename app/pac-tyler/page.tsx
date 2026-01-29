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
    id: "bike-9",
    name: "Vespa",
    thumbnail: "/images/bikes/vespa.jpg",
    images: ["/images/bikes/vespa.jpg"],
    acquired: "January 13th 2026",
    description:
      "Thus ends my time living by the bike and hopefully not dying by the bike. You still wont catch me owning a car though. Vespa miles are not tracked on the map or anything.",
    specs: {
      brand: "Vespa",
      year: 2008,
      model: "LX150",
      type: "Red",
    },
    status: "Active",
  },
  {
    id: "bike-8",
    name: "Novara",
    thumbnail: "/images/bikes/novara.jpg",
    images: ["/images/bikes/novara.jpg"],
    acquired: "November 21 2025",
    totalMiles: 548.7,
    description:
      "My new daily driver. Bar end shifters, kick stand, wide gear ratio, nice leather seat, plenty of cargo space, upright riding position, and it actually fits.",
    specs: {
      brand: "Novara",
      model: "Randonee",
      type: "Touring",
    },
    status: "Active",
  },
  {
    id: "bike-4",
    name: "Hard Rock",
    thumbnail: "/images/bikes/hardrock.jpg",
    images: ["/images/bikes/hardrock.jpg"],
    acquired: "September 1 2025",
    description:
      "This thing had a Gold chain",
    specs: {
      brand: "Specialized",
      model: "Hard Rock",
      type: "Mountain",
    },
    status: "Sold",
    decommissionDetails: "Sold to Jude. Later parted out",
  },
  {
    id: "bike-7",
    name: "Pub Bike",
    thumbnail: "/images/bikes/pubbike.jpg",
    images: ["/images/bikes/pubbike.jpg"],
    acquired: "April 26 2025",
    description:
      "Got this from a nice man at a garage sale for $30. The brifters are really awesome, but its a little too small. I use it as my pub bike but that doesnt mean I dont love it",
    specs: {
      brand: "Diamondback",
      model: "Interval",
      type: "Road",
    },
    status: "Active",
  },
  {
    id: "bike-5",
    name: "Fart Bike",
    thumbnail: "/images/bikes/fartbike.jpg",
    images: ["/images/bikes/fartbike.jpg", "/images/bikes/retrofartbike.jpg"],
    acquired: "April 7 2025",
    decommissioned: "November 18 2025",
    totalMiles: 2622.5,
    description:
      "I hauled a lot of stuff on this bike. it felt indestructible. Shortly after making the custom waxed canvas frame back it was stolen. This was my fault - as I had it locked with a tiny bungee lock. still bummed to have lost the bag, broken in saddle, and emergency kit. Now I use a U lock and a thicker bungee.",
    specs: {
      brand: "Surly",
      model: "Cross-Check",
      type: "Gravel/Touring",
    },
    status: "Stolen",
  },
  {
    id: "bike-6",
    name: "Keg Bike",
    thumbnail: "/images/bikes/kegbike.JPG",
    images: ["/images/bikes/kegbike.JPG"],
    acquired: "January 25th 2025",
    description:
      "Julian, Joel, and Dax made brought this beauty into existence. The bike got gradually lighter as we rode it around fiesta island, and to in-n-out. It also made a summertime appearance in Yosemite Valley. Who knows where it may appear next.",
    specs: {
      brand: "Redd's Apple Ale",
      model: "Beach Cruizer",
      type: "Beer",
    },
    status: "Ready for Deployment",
  },
  {
    id: "bike-3",
    name: "Milk Man",
    thumbnail: "/images/bikes/milkman.jpg",
    images: ["/images/bikes/milkman.jpg","/images/bikes/milkman2.jpg","/images/bikes/redbike.jpg"],
    acquired: "April 26 2024",
    decommissioned: "April 6 2025",
    totalMiles: 3137.6,
    description:
      "The MilkMan was my first introduction to weightmaxing on a commuter bike and I never looked back. It's also when I really began to love biking for the joy of it, and hit my stride in being able to support myself with maintenance. It had a perpetual squeak that persisted even though a full cleaning and regrease of the bottom bracket. Originally a milk crate based cargo system, it evolved to see a new life with bullhorns on the cruizer bars for maximum aerodyamics, and my first custom frame bag. Some say it may be refurbished to see a thrid iteration.",
    specs: {
      brand: "Centurion",
      model: "Accord?", 
      year: 1988,
      type: "Road",
    },
    status: "Retired",
    decommissionDetails: "Retired at bent rear axle",
  },
  {
    id: "bike-2",
    name: "Dave Scott",
    thumbnail: "/images/bikes/davescott.jpg",
    images: ["/images/bikes/davescott.jpg","/images/bikes/davescoottridde.jpg","/images/bikes/davescottride.jpg"],
    acquired: "March 14th 2024",
    decommissioned: "April 25 2024",
    totalMiles: 223.5,
    description:
      "The Dave Scott was beautiful - and it put up being ridden very hard in my early days of biking. It rode down 3000 ft of rocky descent in Red Rocks without a complaint. Still, the mighty must fall. It eventually succumbed to a failure at the bottom bracket. Its pedals lived to see many more bikes.",
    specs: {
      brand: "Centurion",
      model: "Dave Scott Expert", // https://www.vintagecenturion.com/models/competition/ironman/87-89_expert.shtml
      year: 1987,
      type: "Road",
    },
    status: "Totalled",
    decommissionDetails: "Multiple frame cracks",
  },
  {
    id: "bike-1",
    name: "Kyle's mom's Gary Fisher",
    thumbnail: "/images/bikes/garyfsher1.jpg",
    images: ["/images/bikes/garyfsher1.jpg", "/images/bikes/garyfisher.jpg"],
    acquired: "Jan 25th 2024",
    decommissioned: "March 13th 2024",
    totalMiles: 96.4,
    description:
      "When I lost my job and came to San Diego Kyle let me borrow his mom's old Gary Fisher she rode in college. It served me very well while I sorted my life out",
    specs: {
      brand: "Gary Fisher",
      model: "IDK",
      year: 1995,
      type: "Mountain",
    },
    status: "Returned",
    decommissionDetails: "Returned to kyle. Later stolen :(",
  },
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

                 One day, as I was moving back to San Diego and Jeff was looking to move away,
                he described part of his motivation to leave. He compared living in a city for a long 
                time to be like being in a cottage in the woods after a snowfall. At first the options
                are limitless, as you must blaze a trail in every direction. But after some time you stamp down 
                your main paths, and end up sticking to them out of convenience. This is an attempt to 
                continue exploring throughout my daily life.

              </p>
              <p className="text-sm text-gray-400 font-mono">
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


