"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

interface PeopleGalleryClientProps {
  gallery: {
    title: string;
    description: string;
    photos: Array<{ src: string; alt: string; caption?: string }>;
  };
}

export default function PeopleGalleryClient({ gallery }: PeopleGalleryClientProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % gallery.photos.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + gallery.photos.length) % gallery.photos.length);
  };

  if (gallery.photos.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-6 py-20">
          <Link
            href="/gallery"
            className="inline-flex items-center text-orange-500 hover:text-orange-400 mb-8 transition-colors"
          >
            <span className="mr-2">←</span>
            Back to Gallery
          </Link>
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">{gallery.title}</h1>
            <p className="text-xl text-slate-400">{gallery.description}</p>
          </div>
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">No photos yet. Add some to get started!</p>
          </div>
        </div>
      </div>
    );
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
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">{gallery.title}</h1>
          <p className="text-xl text-slate-400">{gallery.description}</p>
          <p className="text-slate-500 mt-2">
            {currentIndex + 1} / {gallery.photos.length}
          </p>
        </div>

        {/* Full-size Image Viewer */}
        <div className="max-w-6xl mx-auto">
          <div className="relative bg-slate-800 rounded-lg overflow-hidden shadow-2xl">
            <div className="relative aspect-video md:aspect-[16/10]">
              <Image
                src={gallery.photos[currentIndex].src}
                alt={gallery.photos[currentIndex].alt}
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Navigation Arrows */}
            {gallery.photos.length > 1 && (
              <>
                <button
                  onClick={goToPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-900/75 hover:bg-slate-900/90 text-white p-4 rounded-full transition-all text-2xl"
                  aria-label="Previous image"
                >
                  ←
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-900/75 hover:bg-slate-900/90 text-white p-4 rounded-full transition-all text-2xl"
                  aria-label="Next image"
                >
                  →
                </button>
              </>
            )}

            {/* Caption */}
            {gallery.photos[currentIndex].caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent p-6">
                <p className="text-white text-lg">{gallery.photos[currentIndex].caption}</p>
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          <div className="mt-6 overflow-x-auto">
            <div className="flex gap-3 pb-2">
              {gallery.photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden transition-all ${
                    index === currentIndex
                      ? "ring-4 ring-orange-500 scale-105"
                      : "ring-2 ring-slate-700 hover:ring-slate-600 opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
