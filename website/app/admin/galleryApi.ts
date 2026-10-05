"use client";

import { AdminRequestError, adminRequest, errorMessage, jsonBody, type AdminFetch } from "./adminApi";
import type { Gallery } from "./types";

/**
 * Gallery calls shared by the Galleries and Upload tabs.
 */

/** The editable text of a gallery. */
export interface GalleryDetails {
  name: string;
  slug: string;
  description: string;
}

export const EMPTY_GALLERY_DETAILS: GalleryDetails = { name: "", slug: "", description: "" };

/** How a batch of photo uploads went. */
export interface UploadResult {
  succeeded: number;
  /** One line per failed file: its name and why. */
  failures: string[];
}

/**
 * Checks a gallery's details before sending them.
 * @param details - Name, slug, description.
 * @returns What's missing, or null if they're fine.
 */
export function galleryDetailsProblem(details: GalleryDetails): string | null {
  if (!details.name.trim() || !details.slug.trim()) return "a gallery needs a name and a slug";
  return null;
}

/** Every gallery, private ones included, in the order the site shows them. */
export const ALL_GALLERIES_PATH = "/galleries?public_only=false";

/**
 * Creates a public gallery.
 * @param adminFetch - From useAdminFetch.
 * @param details - Its name, slug and description.
 * @returns The new gallery.
 */
export async function createGallery(adminFetch: AdminFetch, details: GalleryDetails): Promise<Gallery> {
  const body = {
    name: details.name.trim(),
    slug: details.slug.trim(),
    description: details.description.trim() || null,
    is_public: true,
  };
  const gallery = await adminRequest<Gallery>(adminFetch, "/galleries", "couldn't create the gallery", jsonBody("POST", body));
  if (!gallery) throw new AdminRequestError("couldn't create the gallery: the backend sent back nothing");
  return gallery;
}

/**
 * Uploads photos to a gallery one at a time, carrying on past failures.
 * @param adminFetch - From useAdminFetch.
 * @param galleryId - Gallery to add them to.
 * @param files - The photos.
 * @param onProgress - Called after each file with how many are done (0 to 1).
 * @returns How many made it, and why the rest didn't.
 */
export async function uploadPhotos(
  adminFetch: AdminFetch,
  galleryId: number,
  files: File[],
  onProgress: (fraction: number) => void
): Promise<UploadResult> {
  const result: UploadResult = { succeeded: 0, failures: [] };
  for (const [i, file] of files.entries()) {
    const form = new FormData();
    form.append("file", file);
    try {
      await adminRequest(adminFetch, `/galleries/${galleryId}/photos`, "upload failed", { method: "POST", body: form });
      result.succeeded += 1;
    } catch (err) {
      if (err instanceof AdminRequestError && err.sessionExpired) throw err;
      result.failures.push(`${file.name}: ${errorMessage(err)}`);
    }
    onProgress((i + 1) / files.length);
  }
  return result;
}
