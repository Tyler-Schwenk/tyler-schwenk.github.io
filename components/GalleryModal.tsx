"use client";

import Image from "next/image";
import { useState } from "react";

interface Photo {
  src: string;
  alt: string;
}

interface Gallery {
  title: string;
  description: string;
  coverImage: string;
  photos: Photo[];
  externalUrl?: string;
  externalLinkText?: string;
}

interface GalleryModalProps {
  galleries: Record<string, Gallery>;
}

export default function GalleryModal({ galleries }: GalleryModalProps) {
  const [selectedGallery, setSelectedGallery] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openGallery = (galleryKey: string) => {
    setSelectedGallery(galleryKey);
    setCurrentIndex(0);
  };

  const closeGallery = () => {
    setSelectedGallery(null);
  };

  const goToNext = () => {
    if (selectedGallery) {
      const gallery = galleries[selectedGallery];
      setCurrentIndex((prev) => (prev + 1) % gallery.photos.length);
    }
  };

  const goToPrev = () => {
    if (selectedGallery) {
      const gallery = galleries[selectedGallery];
      setCurrentIndex((prev) => (prev - 1 + gallery.photos.length) % gallery.photos.length);
    }
  };

  const currentGallery = selectedGallery ? galleries[selectedGallery] : null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {Object.entries(galleries).map(([key, gallery]) => (
          <button
            key={key}
            onClick={() => openGallery(key)}
            className="group relative overflow-hidden rounded-lg bg-slate-800 hover:bg-slate-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl text-left"
          >
            <div className="aspect-video relative overflow-hidden">
              <Image
                src={gallery.coverImage}
                alt={gallery.title}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
            </div>
            <div className="p-6">
              <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-orange-500 transition-colors">
                {gallery.title}
              </h3>
              <p className="text-slate-400 mb-2 whitespace-pre-line">{gallery.description}</p>
              <p className="text-orange-500 text-sm">{gallery.photos.length} photos</p>
            </div>
          </button>
        ))}
      </div>

      {/* Full Screen Modal */}
      {currentGallery && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={closeGallery}
            className="absolute top-6 right-6 text-white hover:text-orange-500 transition-colors text-4xl font-light z-50"
            aria-label="Close gallery"
          >
            ×
          </button>

          {/* External link overlay */}
          {currentGallery.externalUrl ? (
            <div className="flex flex-col items-center justify-center gap-8">
              <h2 className="text-4xl font-bold text-white">
                {currentGallery.externalLinkText || "Check out Vishal's Photos"}
              </h2>
              <a
                href={currentGallery.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white text-xl font-semibold rounded-lg transition-colors"
              >
                View Gallery →
              </a>
            </div>
          ) : (
            <>
              {/* Main image */}
              <div className="relative w-full h-full flex flex-col items-center justify-center p-4 pb-32">
                <div className="relative w-full h-full max-w-7xl">
                  <Image
                    src={currentGallery.photos[currentIndex].src}
                    alt={currentGallery.photos[currentIndex].alt}
                    fill
                    className="object-contain"
                    priority
                    sizes="(max-width: 1536px) 100vw, 1536px"
                  />
                </div>

                {/* Preload next/prev images */}
                {currentGallery.photos.length > 1 && (
                  <>
                    {currentIndex > 0 && (
                      <link rel="preload" as="image" href={currentGallery.photos[currentIndex - 1].src} />
                    )}
                    {currentIndex < currentGallery.photos.length - 1 && (
                      <link rel="preload" as="image" href={currentGallery.photos[currentIndex + 1].src} />
                    )}
                  </>
                )}

                {/* Navigation arrows */}
                {currentGallery.photos.length > 1 && (
                  <>
                    <button
                      onClick={goToPrev}
                      className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full transition-all text-3xl"
                      aria-label="Previous image"
                    >
                      ←
                    </button>
                    <button
                      onClick={goToNext}
                      className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full transition-all text-3xl"
                      aria-label="Next image"
                    >
                      →
                    </button>
                  </>
                )}

                {/* Counter */}
                <div className="absolute top-6 left-6 text-white/75 text-sm">
                  {currentIndex + 1} / {currentGallery.photos.length}
                </div>
              </div>

              {/* Thumbnail strip */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-4 overflow-x-auto">
                <div className="flex gap-3 justify-center min-w-max mx-auto">
                  {currentGallery.photos.map((photo, index) => {
                    // Only load thumbnails that are near the current index for performance
                    const shouldLoad = Math.abs(index - currentIndex) <= 5;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden transition-all ${
                          index === currentIndex
                            ? "ring-4 ring-orange-500 scale-110"
                            : "ring-2 ring-white/20 hover:ring-white/40 opacity-60 hover:opacity-100"
                        }`}
                      >
                        {shouldLoad ? (
                          <Image
                            src={photo.src}
                            alt={photo.alt}
                            fill
                            className="object-cover"
                            loading={index === currentIndex ? "eager" : "lazy"}
                            sizes="80px"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-700" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
