import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

// Trip gallery data - add your photos for each trip here
const tripGalleries: Record<string, {
  title: string;
  description: string;
  photos: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
}> = {
  "pac-tyler": {
    title: "Pac-Tyler Journey",
    description: "Cross-country bike adventure from Pacific to Atlantic",
    photos: [
      {
        src: "/images/bikes/black-bike.jpg",
        alt: "Black bike",
        caption: "My trusty bike for the journey"
      },
      // Add more photos here
    ]
  },
  // Add more trip galleries here
};

export default async function TripGallery({ params }: { params: Promise<{ trip: string }> }) {
  const { trip } = await params;
  const gallery = tripGalleries[trip];

  if (!gallery) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-6 py-20">
        {/* Back button */}
        <Link
          href="/gallery"
          className="inline-flex items-center text-orange-500 hover:text-orange-400 mb-8 transition-colors"
        >
          <span className="mr-2">←</span>
          Back to Gallery
        </Link>

        {/* Gallery Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">{gallery.title}</h1>
          <p className="text-xl text-slate-400">{gallery.description}</p>
        </div>

        {/* Photo Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gallery.photos.map((photo, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-lg bg-slate-800 hover:shadow-2xl transition-all duration-300"
            >
              <div className="aspect-square relative overflow-hidden">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                {/* Caption overlay on hover */}
                {photo.caption && (
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <p className="text-white text-sm p-4 font-medium">{photo.caption}</p>
                  </div>
                )}
              </div>
              {/* Caption below image (always visible) */}
              {photo.caption && (
                <div className="p-4 bg-slate-800">
                  <p className="text-slate-300 text-sm leading-relaxed">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
          
          {/* Placeholder for adding more photos */}
          <div className="relative overflow-hidden rounded-lg bg-slate-800/50 border-2 border-dashed border-slate-600 aspect-square flex items-center justify-center">
            <p className="text-slate-500 text-center p-4">More photos coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Generate static params for all trips
export async function generateStaticParams() {
  return Object.keys(tripGalleries).map((trip) => ({
    trip: trip,
  }));
}
