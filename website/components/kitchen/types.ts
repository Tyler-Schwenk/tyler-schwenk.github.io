/** Base URL of the Pi-hosted backend API. */
export const API_BASE = "https://api.tyler-schwenk.com";

/** localStorage key the admin JWT is stashed under (see useAdminAuth). */
export const ADMIN_TOKEN_STORAGE_KEY = "kitchen-admin-token";

export interface Tag {
  id: number;
  name: string;
}

export interface TagWithCount extends Tag {
  recipe_count: number;
}

export interface RecipePhoto {
  id: number;
  recipe_id: number;
  filename: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  display_order: number;
  created_at: string;
}

export interface Recipe {
  id: number;
  name: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
  tags: Tag[];
  photos: RecipePhoto[];
}

/**
 * Builds the URL for a recipe photo file.
 *
 * @param {number} photoId - The photo's id.
 * @param {boolean} [thumbnail=false] - Whether to request the thumbnail variant.
 * @returns {string} Full URL to fetch the image from.
 */
export function recipePhotoUrl(photoId: number, thumbnail = false): string {
  return `${API_BASE}/recipes/photos/${photoId}/file${thumbnail ? "?thumbnail=true" : ""}`;
}
