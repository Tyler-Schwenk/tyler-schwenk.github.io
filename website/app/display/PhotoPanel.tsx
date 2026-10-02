"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { useClockSlot } from "./useClockSlot";

/**
 * Display panel: full-bleed rotation through random photos from every public
 * gallery. The photo changes on wall-clock boundaries, so when both screens
 * show photos, a `staggered` panel changes halfway between the other's changes
 * and the two screens take turns instead of flipping together.
 */

// how long each photo stays on screen (ms)
const PHOTO_ROTATE_INTERVAL_MS = 15_000;

// a staggered panel changes this far after a normal one: halfway, so changes are evenly spaced
const PHOTO_STAGGER_OFFSET_MS = PHOTO_ROTATE_INTERVAL_MS / 2;

// how many photos ahead of the current one to keep preloaded in the browser cache
const PRELOAD_AHEAD_COUNT = 2;

// how often to re-fetch the gallery list while the panel stays up, so new photos show up (ms)
const PHOTO_LIST_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

interface ApiGallery {
  id: number;
  is_public: boolean;
}

interface ApiPhoto {
  id: number;
}

interface ApiGalleryWithPhotos {
  photos: ApiPhoto[];
}

interface PhotoPanelProps {
  /** Change photos half an interval out of step with an unstaggered panel. */
  staggered?: boolean;
}

/**
 * Fisher-Yates shuffle. Returns a new array; does not mutate the input.
 * @param items - Array to shuffle.
 * @returns A new, randomly-ordered array.
 */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Fetches every public gallery's photos and flattens them into one shuffled
 * list of image URLs. Returns an empty array if the API is unreachable.
 * @returns Shuffled list of full-resolution photo URLs.
 */
async function fetchAllPhotoUrls(): Promise<string[]> {
  try {
    const galleriesRes = await fetch(`${API_BASE}/galleries`);
    if (!galleriesRes.ok) return [];
    const galleries: ApiGallery[] = await galleriesRes.json();

    const detailed = await Promise.all(
      galleries.map(async (gallery) => {
        const res = await fetch(`${API_BASE}/galleries/${gallery.id}`);
        if (!res.ok) return null;
        return (await res.json()) as ApiGalleryWithPhotos;
      })
    );

    const photoIds = detailed
      .filter((gallery): gallery is ApiGalleryWithPhotos => gallery !== null)
      .flatMap((gallery) => gallery.photos.map((photo) => photo.id));

    return shuffle(photoIds.map((id) => `${API_BASE}/galleries/photos/${id}/file`));
  } catch {
    console.warn("display: could not fetch gallery photos from API");
    return [];
  }
}

export default function PhotoPanel({ staggered = false }: PhotoPanelProps) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const slot = useClockSlot(PHOTO_ROTATE_INTERVAL_MS, staggered ? PHOTO_STAGGER_OFFSET_MS : 0);
  // each screen shuffles its own list, so the same clock still gives each screen different photos
  const photoIndex = slot !== null && photoUrls.length > 0 ? slot % photoUrls.length : null;

  // holds references to preloaded Image objects so the browser cache stays warm
  // (and the objects aren't garbage-collected) until each photo has been shown
  const preloadCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    if (photoIndex === null) return;
    for (let offset = 0; offset <= PRELOAD_AHEAD_COUNT; offset++) {
      const url = photoUrls[(photoIndex + offset) % photoUrls.length];
      if (preloadCacheRef.current.has(url)) continue;
      const image = new window.Image();
      image.src = url;
      preloadCacheRef.current.set(url, image);
    }
  }, [photoIndex, photoUrls]);

  useEffect(() => {
    const loadPhotos = () => {
      fetchAllPhotoUrls().then(setPhotoUrls);
    };
    loadPhotos();
    const refreshTimer = setInterval(loadPhotos, PHOTO_LIST_REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimer);
  }, []);

  const currentUrl = photoIndex !== null ? photoUrls[photoIndex] : undefined;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {currentUrl && (
        // plain img (not next/image) so switching src reuses preloaded/cached bytes instead of remounting
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="" className="w-full h-full object-contain" />
      )}
    </div>
  );
}
