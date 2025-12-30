import Image from "next/image";
import { readdirSync } from "fs";
import { join } from "path";
import GalleryModal from "@/components/GalleryModal";

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
  externalUrl?: string;
}> = {
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

export default function GalleryPage() {
  // Load trip photos dynamically from folders
  const tripGalleries = Object.entries(tripConfig).reduce((acc, [key, config]) => {
    const photos = getImagesFromFolder(config.folderPath, config.title);
    acc[key] = {
      title: config.title,
      description: config.description,
      coverImage: config.coverImage || photos[0]?.src || "/images/bikes/black-bike.jpg",
      photos,
      externalUrl: config.externalUrl
    };
    return acc;
  }, {} as Record<string, { title: string; description: string; coverImage: string; photos: Array<{ src: string; alt: string }>; externalUrl?: string }>);

  // Load people photos dynamically from folders
  const peopleGalleries = Object.entries(peopleConfig).reduce((acc, [key, config]) => {
    const photos = getImagesFromFolder(config.folderPath, config.title);
    acc[key] = {
      title: config.title,
      description: config.description,
      coverImage: config.coverImage || photos[0]?.src || "/images/pic00.jpeg",
      photos,
      externalUrl: config.externalUrl,
      externalLinkText: config.externalLinkText
    };
    return acc;
  }, {} as Record<string, { title: string; description: string; coverImage: string; photos: Array<{ src: string; alt: string }>; externalUrl?: string; externalLinkText?: string }>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-6 py-20">
        <h1 className="text-5xl font-bold text-white text-center mb-16 pt-16">
          Who needs instagram
        </h1>

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
  );
}
