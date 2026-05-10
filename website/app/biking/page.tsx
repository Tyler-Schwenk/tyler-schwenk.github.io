import Image from "next/image";
import Link from "next/link";
import BikeQuiver, { type Bike } from "@/components/BikeQuiver";
import PageWrapper from "@/components/PageWrapper";

const BIKES: Bike[] = [
  {
    id: "bike-10",
    name: "Tandem",
    thumbnail: "/images/bikes/tandem_joel.jpg",
    images: ["/images/bikes/tandem_joel.jpg"],
    acquired: "April 8th 2026",
    description:
      "Purchased with Joel from Bikes Del Pueblo. We mostly use it to go to trader joes and take ladies on dates (they love it)",
    specs: {
      brand: "Burley",
      type: "Tandem",
    },
    status: "Active",
  },
  {
    id: "bike-9",
    name: "Vespa",
    thumbnail: "/images/bikes/vespa.jpg",
    images: ["/images/bikes/vespa.jpg"],
    videos: ["/images/bikes/VID_20260420_202410.mp4"],
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
    description: "This thing had a Gold chain",
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
    images: ["/images/bikes/milkman.jpg", "/images/bikes/milkman2.jpg", "/images/bikes/redbike.jpg"],
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
    images: ["/images/bikes/davescott.jpg", "/images/bikes/davescoottridde.jpg", "/images/bikes/davescottride.jpg"],
    acquired: "March 14th 2024",
    decommissioned: "April 25 2024",
    totalMiles: 223.5,
    description:
      "The Dave Scott was beautiful - and it put up being ridden very hard in my early days of biking. It rode down 3000 ft of rocky descent in Red Rocks without a complaint. Still, the mighty must fall. It eventually succumbed to a failure at the bottom bracket. Its pedals lived to see many more bikes.",
    specs: {
      brand: "Centurion",
      model: "Dave Scott Expert",
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

/**
 * Biking page.
 *
 * Hub for all biking-related content: links to Strava, Bike Nite SD,
 * the Pac-Tyler street-coverage project, and the full bike quiver.
 *
 * @returns {JSX.Element} The biking page.
 */
export default function Biking() {
  return (
    <PageWrapper>
      <main className="min-h-screen bg-gray-950 text-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-12">

          {/* Header */}
          <header className="mb-12">
            <h1 className="text-4xl font-bold mb-3">Biking</h1>
            <p className="text-gray-400 text-lg leading-relaxed">
              I Love bikes. I think riding them improves the users life and the lives of those around them. Its also very fun to ride bikes while listening to techno music. You dont have to pay for gas, you just buy yourself yummy food instead. When they break they are easy and cheap to fix. You dont need to get insurrance either. Also when youre biking you smell good food spots your wouldnt have noticed in your car. You hear live music you wouldnt have found on the highway. You see your neighbors and ring your bell at them. You also exersize and feel better mentally - and get to brag about it on strava. You dont have to give any of your hard earned money to natural gas companies - whom I have some choice words for. I think thats all I have for now..
            </p>
          </header>

          {/* Links */}
          <section className="mb-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ExternalCard
              href="https://www.strava.com/athletes/72890958"
              label="Strava"
              description="the last bastion of good social media"
            />
            <ExternalCard
              href="https://www.instagram.com/bikenitesd/"
              label="Bike Nite SD"
              description="Our really cool biker gang"
            />
            <InternalCard
              href="/pac-tyler"
              label=""
              description="Biking every street in San Diego"
              imageSrc="/images/logo-Pac-Tyler.png"
            />
          </section>

          {/* Bike Quiver */}
          <section>
            <BikeQuiver bikes={BIKES} />
          </section>

        </div>
      </main>
    </PageWrapper>
  );
}

/**
 * Card linking to an external site.
 *
 * @param {object} props
 * @param {string} props.href - External URL.
 * @param {string} props.label - Card title.
 * @param {string} props.description - Short description shown below the title.
 * @returns {JSX.Element}
 */
function ExternalCard({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-gray-700 rounded-lg p-5 hover:border-gray-400 hover:bg-gray-900 transition-colors"
    >
      <p className="font-semibold text-lg mb-1">{label}</p>
      <p className="text-gray-400 text-sm">{description}</p>
    </a>
  );
}

/**
 * Card linking to an internal page, optionally showing a logo image.
 *
 * @param {object} props
 * @param {string} props.href - Internal path.
 * @param {string} props.label - Card title.
 * @param {string} props.description - Short description shown below the title.
 * @param {string} [props.imageSrc] - Optional logo image path.
 * @returns {JSX.Element}
 */
function InternalCard({
  href,
  label,
  description,
  imageSrc,
}: {
  href: string;
  label: string;
  description: string;
  imageSrc?: string;
}) {
  return (
    <Link
      href={href}
      className="block border border-gray-700 rounded-lg p-5 hover:border-gray-400 hover:bg-gray-900 transition-colors"
    >
      {imageSrc && (
        <div className="relative h-10 mb-3">
          <Image
            src={imageSrc}
            alt={label}
            fill
            className="object-contain object-left"
          />
        </div>
      )}
      {label && <p className="font-semibold text-lg mb-1">{label}</p>}
      <p className="text-gray-400 text-sm">{description}</p>
    </Link>
  );
}
