export { API_BASE, recipePhotoUrl } from "@/lib/api";

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
  link: string | null;
  created_at: string;
  updated_at: string | null;
  tags: Tag[];
  photos: RecipePhoto[];
}
