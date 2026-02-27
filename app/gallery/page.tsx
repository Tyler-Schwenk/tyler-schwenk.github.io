import Image from "next/image";
import { readdirSync } from "fs";
import { join } from "path";
import GalleryModal from "@/components/GalleryModal";
import PageWrapper from "@/components/PageWrapper";

// Helper function to get all images from a folder
function getImagesFromFolder(folderPath: string, altText: string) {
  const fullPath = join(process.cwd(), "public", folderPath);
  try {
    const files = readdirSync(fullPath);
    return files
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .map(file => ({
        src: `${folderPath}/${file}`,
        alt: altText
      }));
  } catch (error) {
    console.error(`Error reading directory ${folderPath}:`, error);
    return [];
  }
}

// Trip galleries configuration
const tripConfig: Record<string, {
  title: string;
  description: string;
  folderPath: string;
  coverImage?: string;
  videoPaths?: string[];
  externalUrl?: string;
}> = {
  jordan: {
    title: "Jordan",
    description: "Lovely time in Jordan. February 2026",
    folderPath: "/images/gallery/jordan",
    videoPaths: ["/video/jordan.mp4"]
  },
  epc: {
    title: "El Potrero Chico",
    description: "From a few trips across multiple years\n2023, 2024, 2025",
    folderPath: "/images/gallery/epc"
  },
  durango: {
    title: "Durango",
    description: "Visiting Jeff for 2 nights of backpacking after he finished the Colorado Trail.\nSept 5-8, 2025",
    folderPath: "/images/gallery/durango",
    coverImage: "/images/gallery/durango/IMG_9655.jpg"
  },
  ceciliawedding: {
    title: "Cecilia's Wedding",
    description: "Friends stayed with my family in phl, then went to the wedding at Cecilia's family farm, and finished with some NYC nightlife",
    folderPath: "/images/gallery/Celciliawedding"
  },
  elcap: {
    title: "El Cap",
    description: "Via triple direct.\nMay 10-16, 2025",
    folderPath: "/images/gallery/elcap",
    externalUrl: "https://vish.ventures/triple-direct"
  },
  halfdome: {
    title: "Half Dome",
    description: "Via Regular Northwest Face\nMay 2024",
    folderPath: "/images/gallery/halfdome",
    externalUrl: "https://vish.ventures/yosemite-05-24/rnwf"
  },
  enchantments: {
    title: "The Enchantments",
    description: "Backpacking & Aasgard Sentinel\nJuly 2021",
    folderPath: "/images/gallery/enchantments"
  },
  
};

// People galleries configuration
const peopleConfig: Record<string, {
  title: string;
  description: string;
  folderPath: string;
  coverImage?: string;
  externalUrl?: string;
  externalLinkText?: string;
}> = {
  friends: {
    title: "Friends",
    description: "",
    folderPath: "/images/gallery/friends"
  },
  college: {
    title: "College",
    description: "Trash house",
    folderPath: "/images/gallery/college"
  },
  palestinepals: {
    title: "Palestine Pals",
    description: "Free Palestine",
    folderPath: "/images/gallery/palestinepals"
  },
  family: {
    title: "Family",
    description: "and Funtown",
    folderPath: "/images/gallery/family"
  },
  bikenite: {
    title: "Bike Nite",
    description: "",
    folderPath: "/images/gallery/bikenite",
    externalUrl: "https://www.instagram.com/bikenitesd/",
    externalLinkText: "ok this is on instagram"
  }
};

type WhyNotInstagramReason = {
  title?: string;
  description?: string;
  linkUrl?: string;
  linkText?: string;
};

const WHY_NOT_INSTAGRAM_REASONS: WhyNotInstagramReason[] = [
  {
    description: "I mean we all intuitively know this stuff is bad for us. But heres some concrete examples",
    },
  {
    title: "Intentional manipulation",
    description: "Social media platforms have the capability, and motivation, to take control of our political system.",
    linkUrl: "https://research.facebook.com/publications/a-61-million-person-experiment-in-social-influence-and-political-mobilization/",
    linkText: "From Facebook - A 61 Million Person Experiment in Social Influence and Political Mobilization"
  }
  
];

export default function GalleryPage() {
  // Load trip photos dynamically from folders
  const tripGalleries = Object.entries(tripConfig).reduce((acc, [key, config]) => {
    const photos = getImagesFromFolder(config.folderPath, config.title);
    const videos = (config.videoPaths || []).map((videoPath) => ({
      src: videoPath,
      alt: `${config.title} video`,
      type: "video" as const
    }));
    const media = [
      ...videos,
      ...photos.map((photo) => ({ ...photo, type: "image" as const }))
    ];
    acc[key] = {
      title: config.title,
      description: config.description,
      coverImage: config.coverImage || photos[0]?.src || "/images/bikes/black-bike.jpg",
      media,
      externalUrl: config.externalUrl
    };
    return acc;
  }, {} as Record<string, { title: string; description: string; coverImage: string; media: Array<{ src: string; alt: string; type: "image" | "video" }>; externalUrl?: string }>);

  // Load people photos dynamically from folders
  const peopleGalleries = Object.entries(peopleConfig).reduce((acc, [key, config]) => {
    const photos = getImagesFromFolder(config.folderPath, config.title);
    const media = photos.map((photo) => ({ ...photo, type: "image" as const }));
    acc[key] = {
      title: config.title,
      description: config.description,
      coverImage: config.coverImage || photos[0]?.src || "/images/pic00.jpeg",
      media,
      externalUrl: config.externalUrl,
      externalLinkText: config.externalLinkText
    };
    return acc;
  }, {} as Record<string, { title: string; description: string; coverImage: string; media: Array<{ src: string; alt: string; type: "image" | "video" }>; externalUrl?: string; externalLinkText?: string }>);

  return (
    <PageWrapper>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-6 py-20">
        {/* Friends' Websites */}
        <section className="mb-16 text-center">
          <p className="text-xl text-gray-300 mb-6">
            Lots of these photos were taken by my more talented friends:
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <a 
              href="https://frankyhanen.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-400 font-mono transition-all hover:scale-105"
            >
              Franky
            </a>
            <a 
              href="https://tavakessler.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-400 font-mono transition-all hover:scale-105"
            >
              Tava
            </a>
            <a 
              href="https://vish.ventures/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-400 font-mono transition-all hover:scale-105"
            >
              Vishal
            </a>
          </div>
        </section>

        {/* Why Not Instagram Section */}
        <section className="mb-16 max-w-3xl mx-auto">
          <details className="group bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700 shadow-xl">
            <summary className="cursor-pointer px-6 py-4 text-lg font-semibold text-white hover:text-orange-400 transition-colors list-none flex items-center justify-between">
              <span>Why not just use Instagram?</span>
              <span className="text-orange-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-6 pb-6 pt-2 space-y-6 text-slate-300">
              {WHY_NOT_INSTAGRAM_REASONS.map((reason, index) => (
                <div key={index} className="space-y-3">
                  {(reason.title || reason.description) && (
                    <p className="leading-relaxed">
                      {reason.title && <strong className="text-white">{reason.title}:</strong>}
                      {reason.title && reason.description && " "}
                      {reason.description}
                    </p>
                  )}
                  {reason.linkUrl && (
                    <a
                      href={reason.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 underline"
                    >
                      {reason.linkText || reason.linkUrl}
                      <span>→</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </details>
        </section>

        {/* Trips Section */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold text-white mb-12 flex items-center">
            <span className="text-orange-500 mr-3"></span>
            Trips
          </h2>
          <GalleryModal galleries={tripGalleries} />
        </section>

        {/* People Section */}
        <section className="space-y-12">
          <h2 className="text-4xl font-bold text-white mb-12 flex items-center">
            <span className="text-orange-500 mr-3"></span>
            People
          </h2>
          
          <GalleryModal galleries={peopleGalleries} />
        </section>
      </div>
    </div>
    </PageWrapper>
  );
}
