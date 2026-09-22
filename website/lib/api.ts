/**
 * Shared base URL and URL builders for the fart-pi backend API.
 *
 * Everything that talks to the backend imports from here so the host lives
 * in exactly one place. Set NEXT_PUBLIC_API_BASE at build time to point a
 * local dev build at a local backend.
 */

/** Backend API origin. Overridable for local development. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://api.tyler-schwenk.com";

/**
 * Build the URL for a gallery photo file.
 * @param photoId - Gallery photo ID.
 * @param thumbnail - Request the thumbnail instead of the original.
 * @returns Absolute URL to the image.
 */
export function photoUrl(photoId: number, thumbnail = false): string {
  const params = thumbnail ? "?thumbnail=true" : "";
  return `${API_BASE}/galleries/photos/${photoId}/file${params}`;
}

/**
 * Build the URL for a recipe photo file.
 * @param photoId - Recipe photo ID.
 * @param thumbnail - Request the thumbnail instead of the original.
 * @returns Absolute URL to the image.
 */
export function recipePhotoUrl(photoId: number, thumbnail = false): string {
  const params = thumbnail ? "?thumbnail=true" : "";
  return `${API_BASE}/recipes/photos/${photoId}/file${params}`;
}

/**
 * Build the streaming URL for a video.
 * @param videoId - Video ID.
 * @returns Absolute URL to the video stream.
 */
export function videoStreamUrl(videoId: number): string {
  return `${API_BASE}/videos/${videoId}/stream`;
}

/**
 * Build the thumbnail URL for a video.
 * @param videoId - Video ID.
 * @returns Absolute URL to the video thumbnail.
 */
export function videoThumbnailUrl(videoId: number): string {
  return `${API_BASE}/videos/${videoId}/thumbnail`;
}
