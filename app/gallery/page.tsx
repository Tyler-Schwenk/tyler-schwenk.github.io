"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

// Favorite images - add your favorite photos here
const favoriteImages = [
  {
    src: "/images/pic00.jpeg",
    alt: "Favorite moment 1",
    caption: "Add your favorite photos to /public/images/gallery/favorites/"
  },
  // Add more favorite images here
  // { src: "/images/gallery/favorites/photo1.jpg", alt: "Description", caption: "Optional caption" },
];

// Trip data - you can add more trips here
const trips = [
  {
    id: "pac-tyler",
    title: "Pac-Tyler",
    description: "Cross-country bike journey from Pacific to Atlantic",
    coverImage: "/images/bikes/black-bike.jpg",
    date: "2024"
  },
  // Add more trips as needed
];

// Friends photos
const friendsPhotos = [
  { src: "/images/gallery/friends/000000040005.JPG", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/000219520014.jpg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/000798260021.JPG", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/0D487A99-E14C-431D-8937-AD7876A0C500.jpg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/DSCF1049.jpeg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/East and High Sierra-0029.jpeg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/IMG_3271.JPG", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/IMG_3828.jpeg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/IMG_4025.jpeg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/IMG_7032.jpeg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/IMG_7283.PNG", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/IMG_7331.JPG", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/IMG_7726.jpeg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/IMG_9726.PNG", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/Joel_bday-0011.jpeg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/Joel_bday-0017.jpeg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/Valley_E100-0013.jpeg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/Valley_E100-0020.jpeg", alt: "Friends", caption: "" },
  { src: "/images/gallery/friends/_DSC1395.jpeg", alt: "Friends", caption: "" },
];

// Palestine Pals photos
const palestinePalsPhotos = [
  { src: "/images/gallery/palestinepals/8ee28ed5-c2f3-4781-94.jpg", alt: "Palestine Pals", caption: "" },
  { src: "/images/gallery/palestinepals/Climbers for Palestine_crop-0002.jpeg", alt: "Palestine Pals", caption: "" },
  { src: "/images/gallery/palestinepals/IMG_5658.jpg", alt: "Palestine Pals", caption: "" },
];

// Family photos (empty for now)
const familyPhotos: Array<{ src: string; alt: string; caption: string }> = [
  // Add family photos here
];

export default function GalleryPage() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Auto-cycle through favorite images every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        (prevIndex + 1) % favoriteImages.length
      );
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-6 py-20">
        <h1 className="text-5xl font-bold text-white text-center mb-8 pt-16">
          Gallery
        </h1>

        {/* Favorite Images Carousel */}
        <section className="mb-16">
          <div className="max-w-4xl mx-auto">
            <div className="relative aspect-video rounded-lg overflow-hidden shadow-2xl">
              <Image
                src={favoriteImages[currentImageIndex].src}
                alt={favoriteImages[currentImageIndex].alt}
                fill
                className="object-cover transition-opacity duration-700"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
              
              {/* Caption */}
              {favoriteImages[currentImageIndex].caption && (
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <p className="text-white text-lg font-medium drop-shadow-lg">
                    {favoriteImages[currentImageIndex].caption}
                  </p>
                </div>
              )}

              {/* Navigation dots */}
              <div className="absolute bottom-4 right-4 flex gap-2">
                {favoriteImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentImageIndex
                        ? "bg-orange-500 w-8"
                        : "bg-white/50 hover:bg-white/75"
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>

              {/* Manual navigation arrows */}
              <button
                onClick={() => setCurrentImageIndex((prevIndex) => 
                  prevIndex === 0 ? favoriteImages.length - 1 : prevIndex - 1
                )}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-900/50 hover:bg-slate-900/75 text-white p-3 rounded-full transition-all"
                aria-label="Previous image"
              >
                ←
              </button>
              <button
                onClick={() => setCurrentImageIndex((prevIndex) => 
                  (prevIndex + 1) % favoriteImages.length
                )}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-900/50 hover:bg-slate-900/75 text-white p-3 rounded-full transition-all"
                aria-label="Next image"
              >
                →
              </button>
            </div>
          </div>
        </section>

        {/* Trips Section */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 flex items-center">
            <span className="text-orange-500 mr-3">🚴</span>
            Trips & Adventures
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                href={`/gallery/${trip.id}`}
                className="group relative overflow-hidden rounded-lg bg-slate-800 hover:bg-slate-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <div className="aspect-video relative overflow-hidden">
                  <Image
                    src={trip.coverImage}
                    alt={trip.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-orange-500 transition-colors">
                    {trip.title}
                  </h3>
                  <p className="text-slate-400 mb-2">{trip.description}</p>
                  <p className="text-orange-500 text-sm">{trip.date}</p>
                </div>
              </Link>
            ))}
            
            {/* Placeholder for adding more trips */}
            <div className="relative overflow-hidden rounded-lg bg-slate-800/50 border-2 border-dashed border-slate-600 flex items-center justify-center min-h-[300px]">
              <div className="text-center p-6">
                <p className="text-slate-500 text-lg">More trips coming soon...</p>
              </div>
            </div>
          </div>
        </section>

        {/* People Section */}
        <section className="space-y-12">
          <h2 className="text-4xl font-bold text-white mb-12 flex items-center">
            <span className="text-orange-500 mr-3">👥</span>
            People & Memories
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Link
              href="/gallery/people/friends"
              className="group relative overflow-hidden rounded-lg bg-slate-800 hover:bg-slate-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <div className="aspect-video relative overflow-hidden">
                <Image
                  src="/images/gallery/friends/000000040005.JPG"
                  alt="Friends"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-orange-500 transition-colors">
                  Friends
                </h3>
                <p className="text-slate-400 mb-2">Memories with friends</p>
                <p className="text-orange-500 text-sm">{friendsPhotos.length} photos</p>
              </div>
            </Link>

            <Link
              href="/gallery/people/palestinepals"
              className="group relative overflow-hidden rounded-lg bg-slate-800 hover:bg-slate-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <div className="aspect-video relative overflow-hidden">
                <Image
                  src="/images/gallery/palestinepals/8ee28ed5-c2f3-4781-94.jpg"
                  alt="Palestine Pals"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-orange-500 transition-colors">
                  Palestine Pals
                </h3>
                <p className="text-slate-400 mb-2">Climbing for a cause</p>
                <p className="text-orange-500 text-sm">{palestinePalsPhotos.length} photos</p>
              </div>
            </Link>

            <Link
              href="/gallery/people/family"
              className="group relative overflow-hidden rounded-lg bg-slate-800 hover:bg-slate-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <div className="aspect-video relative overflow-hidden">
                <Image
                  src="/images/pic00.jpeg"
                  alt="Family"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-orange-500 transition-colors">
                  Family
                </h3>
                <p className="text-slate-400 mb-2">Family moments</p>
                <p className="text-orange-500 text-sm">{familyPhotos.length} photos</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
