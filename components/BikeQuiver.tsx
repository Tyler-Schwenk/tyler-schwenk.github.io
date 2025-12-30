"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Bike data structure
 */
export interface Bike {
  id: string;
  name: string;
  thumbnail: string; // Path to thumbnail image
  images: string[]; // Array of image paths for gallery
  acquired: string; // Date acquired (e.g., "2020-05-15" or "May 2020")
  decommissioned?: string; // Date decommissioned (e.g., "2022-08-20" or "Aug 2022"), undefined for current bikes
  totalMiles: number;
  description: string;
  specs?: {
    brand?: string;
    model?: string;
    year?: number;
    type?: string;
  };
  decommissionReason?: string; // Why it was retired/lost (optional for current bikes)
}

interface BikeQuiverProps {
  bikes: Bike[];
}

/**
 * Bike Quiver Component
 *
 * Displays a collection of bikes used for the Pac-Tyler challenge.
 * Each bike shows summary stats and can be expanded to view full details,
 * photos, and decommission story.
 *
 * @param bikes - Array of bike objects with stats and photos
 */
export default function BikeQuiver({ bikes }: BikeQuiverProps) {
  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const openBikeModal = (bike: Bike) => {
    setSelectedBike(bike);
    setCurrentImageIndex(0);
  };

  const closeBikeModal = () => {
    setSelectedBike(null);
    setCurrentImageIndex(0);
  };

  const nextImage = () => {
    if (selectedBike) {
      setCurrentImageIndex(
        (prev) => (prev + 1) % selectedBike.images.length
      );
    }
  };

  const prevImage = () => {
    if (selectedBike) {
      setCurrentImageIndex(
        (prev) =>
          (prev - 1 + selectedBike.images.length) % selectedBike.images.length
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-[#E3B800] font-mono mb-2">
          🚴 THE QUIVER
        </h2>
        <p className="text-gray-400 font-mono text-sm">
          Click any bike to view full details and photos
        </p>
      </div>

      {/* Bike Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bikes.map((bike) => (
          <BikeCard
            key={bike.id}
            bike={bike}
            onClick={() => openBikeModal(bike)}
          />
        ))}
      </div>

      {/* Bike Detail Modal */}
      {selectedBike && (
        <BikeModal
          bike={selectedBike}
          currentImageIndex={currentImageIndex}
          onClose={closeBikeModal}
          onNextImage={nextImage}
          onPrevImage={prevImage}
        />
      )}
    </div>
  );
}

/**
 * Individual bike card showing summary stats
 */
interface BikeCardProps {
  bike: Bike;
  onClick: () => void;
}

function BikeCard({ bike, onClick }: BikeCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-[#1a1a1a] border-2 border-[#E3B800] rounded-lg p-4 cursor-pointer hover:shadow-[0_0_20px_rgba(227,184,0,0.4)] transition-all hover:scale-105"
    >
      {/* Thumbnail */}
      <div className="relative w-full h-48 mb-4 rounded overflow-hidden bg-gray-900">
        <Image
          src={bike.thumbnail}
          alt={bike.name}
          fill
          className="object-cover"
        />
      </div>

      {/* Bike Name */}
      <h3 className="text-xl font-bold text-[#E3B800] font-mono mb-3">
        {bike.name}
      </h3>

      {/* Stats Grid */}
      <div className="space-y-2 text-sm font-mono">
        <div className="flex justify-between">
          <span className="text-gray-400">Acquired:</span>
          <span className="text-[#E3B800]">{bike.acquired}</span>
        </div>
        {bike.decommissioned && (
          <div className="flex justify-between">
            <span className="text-gray-400">Retired:</span>
            <span className="text-[#E3B800]">{bike.decommissioned}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-400">Miles:</span>
          <span className="text-[#E3B800]">{bike.totalMiles.toLocaleString()}</span>
        </div>
        {bike.specs?.brand && (
          <div className="flex justify-between">
            <span className="text-gray-400">Brand:</span>
            <span className="text-[#E3B800]">{bike.specs.brand}</span>
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="mt-4 pt-3 border-t border-[#E3B800]/30">
        {bike.decommissionReason ? (
          <span className="text-xs text-red-400 font-mono">
            ⚠️ DECOMMISSIONED
          </span>
        ) : (
          <span className="text-xs text-green-400 font-mono">
            ✓ ACTIVE
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Modal showing full bike details with image gallery
 */
interface BikeModalProps {
  bike: Bike;
  currentImageIndex: number;
  onClose: () => void;
  onNextImage: () => void;
  onPrevImage: () => void;
}

function BikeModal({
  bike,
  currentImageIndex,
  onClose,
  onNextImage,
  onPrevImage,
}: BikeModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border-4 border-[#E3B800] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[0_0_30px_rgba(227,184,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#E3B800] hover:text-[#ffd700] text-3xl font-bold z-10"
          aria-label="Close"
        >
          ×
        </button>

        {/* Image Gallery */}
        <div className="relative w-full h-96 bg-gray-900">
          <Image
            src={bike.images[currentImageIndex]}
            alt={`${bike.name} - Image ${currentImageIndex + 1}`}
            fill
            className="object-contain"
          />

          {/* Gallery Navigation */}
          {bike.images.length > 1 && (
            <>
              <button
                onClick={onPrevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-[#E3B800] hover:bg-black/70 px-4 py-2 rounded font-mono text-2xl"
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                onClick={onNextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-[#E3B800] hover:bg-black/70 px-4 py-2 rounded font-mono text-2xl"
                aria-label="Next image"
              >
                ›
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-1 rounded font-mono text-sm text-[#E3B800]">
                {currentImageIndex + 1} / {bike.images.length}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-3xl font-bold text-[#E3B800] font-mono mb-2">
              {bike.name}
            </h2>
            <div className="flex items-center gap-3 text-sm font-mono">
              <span className="text-gray-400">
                {bike.acquired}{bike.decommissioned ? ` - ${bike.decommissioned}` : ' - Present'}
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-[#E3B800]">
                {bike.totalMiles.toLocaleString()} miles
              </span>
            </div>
          </div>

          {/* Specifications */}
          {bike.specs && (
            <div className="bg-black/30 border border-[#E3B800]/30 rounded p-4">
              <h3 className="text-lg font-bold text-[#E3B800] font-mono mb-3">
                SPECIFICATIONS
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm font-mono">
                {bike.specs.brand && (
                  <div>
                    <span className="text-gray-400">Brand:</span>
                    <span className="text-white ml-2">{bike.specs.brand}</span>
                  </div>
                )}
                {bike.specs.model && (
                  <div>
                    <span className="text-gray-400">Model:</span>
                    <span className="text-white ml-2">{bike.specs.model}</span>
                  </div>
                )}
                {bike.specs.year && (
                  <div>
                    <span className="text-gray-400">Year:</span>
                    <span className="text-white ml-2">{bike.specs.year}</span>
                  </div>
                )}
                {bike.specs.type && (
                  <div>
                    <span className="text-gray-400">Type:</span>
                    <span className="text-white ml-2">{bike.specs.type}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-lg font-bold text-[#E3B800] font-mono mb-3">
              STORY
            </h3>
            <p className="text-gray-300 leading-relaxed">{bike.description}</p>
          </div>

          {/* Decommission Reason */}
          {bike.decommissionReason && (
            <div className="bg-red-900/20 border border-red-500/50 rounded p-4">
              <h3 className="text-lg font-bold text-red-400 font-mono mb-2">
                ⚠️ DECOMMISSIONED
              </h3>
              <p className="text-red-200 text-sm">{bike.decommissionReason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
