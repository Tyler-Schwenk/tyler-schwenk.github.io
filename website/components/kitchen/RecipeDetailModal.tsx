"use client";

import { useState } from "react";
import Image from "next/image";
import KitchenModal from "./KitchenModal";
import KitchenButton from "./KitchenButton";
import { KitchenFileInput, KitchenInput, KitchenLabel, KitchenTextarea } from "./KitchenFormControls";
import TagChip from "./TagChip";
import TagPicker from "./TagPicker";
import { API_BASE, Recipe, TagWithCount, recipePhotoUrl } from "./types";

// keep in sync with MAX_PHOTOS_PER_RECIPE in pi/services/website-backend/app/schemas.py
const MAX_PHOTOS = 12;

interface RecipeDetailModalProps {
  recipe: Recipe;
  isAdmin: boolean;
  token: string | null;
  availableTags: TagWithCount[];
  onClose: () => void;
  onUpdated: (recipe: Recipe) => void;
  onDeleted: (recipeId: number) => void;
}

/**
 * Expanded view of a single recipe: all its photos, name, description,
 * link, and tags. When logged in as admin, offers inline editing (including
 * adding/removing photos and choosing the cover photo) and deletion.
 *
 * @param {RecipeDetailModalProps} props - Component props.
 * @returns {JSX.Element} The recipe detail modal.
 */
export default function RecipeDetailModal({
  recipe,
  isAdmin,
  token,
  availableTags,
  onClose,
  onUpdated,
  onDeleted,
}: RecipeDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(recipe.name ?? "");
  const [description, setDescription] = useState(recipe.description ?? "");
  const [link, setLink] = useState(recipe.link ?? "");
  const [tags, setTags] = useState(recipe.tags.map((t) => t.name));
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  /** Saves the edited name/description/link/tags via the admin-only PATCH endpoint. */
  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: name.trim() || null,
          description: description.trim() || null,
          link: link.trim() || null,
          tags,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.detail === "string" ? data.detail : "couldn't save - try again");
        setSaving(false);
        return;
      }
      const updated: Recipe = await res.json();
      onUpdated(updated);
      setEditing(false);
    } catch {
      setError("couldn't reach the server - check your connection and try again");
    } finally {
      setSaving(false);
    }
  }

  /** Deletes the recipe after a confirmation prompt. */
  async function handleDelete() {
    if (!window.confirm(`Delete "${recipe.name || "this recipe"}"? This can't be undone.`)) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/recipes/${recipe.id}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok && res.status !== 204) {
        setError("couldn't delete - try again");
        return;
      }
      onDeleted(recipe.id);
      onClose();
    } catch {
      setError("couldn't reach the server - check your connection and try again");
    }
  }

  /**
   * Uploads newly picked files straight to the recipe's photo list.
   *
   * @param {FileList | null} files - Files chosen from the file input.
   */
  async function handleAddPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (recipe.photos.length + files.length > MAX_PHOTOS) {
      setError(`too many photos -- a recipe can have at most ${MAX_PHOTOS}`);
      return;
    }
    setError(null);
    setPhotoBusy(true);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    try {
      const res = await fetch(`${API_BASE}/recipes/${recipe.id}/photos`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.detail === "string" ? data.detail : "couldn't add photos - try again");
        return;
      }
      onUpdated(await res.json());
    } catch {
      setError("couldn't reach the server - check your connection and try again");
    } finally {
      setPhotoBusy(false);
    }
  }

  /**
   * Promotes a photo to be the recipe's cover image.
   *
   * @param {number} photoId - Photo to promote.
   */
  async function handleSetThumbnail(photoId: number) {
    setError(null);
    setPhotoBusy(true);
    try {
      const res = await fetch(`${API_BASE}/recipes/${recipe.id}/photos/${photoId}/thumbnail`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!res.ok) {
        setError("couldn't set cover photo - try again");
        return;
      }
      onUpdated(await res.json());
    } catch {
      setError("couldn't reach the server - check your connection and try again");
    } finally {
      setPhotoBusy(false);
    }
  }

  /**
   * Removes a single photo from the recipe.
   *
   * @param {number} photoId - Photo to remove.
   */
  async function handleRemovePhoto(photoId: number) {
    setError(null);
    setPhotoBusy(true);
    try {
      const res = await fetch(`${API_BASE}/recipes/${recipe.id}/photos/${photoId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok && res.status !== 204) {
        setError("couldn't remove photo - try again");
        return;
      }
      onUpdated({ ...recipe, photos: recipe.photos.filter((p) => p.id !== photoId) });
    } catch {
      setError("couldn't reach the server - check your connection and try again");
    } finally {
      setPhotoBusy(false);
    }
  }

  const footer = isAdmin ? (
    editing ? (
      <>
        <KitchenButton variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
          Cancel
        </KitchenButton>
        <KitchenButton variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </KitchenButton>
      </>
    ) : (
      <>
        <KitchenButton variant="danger" onClick={handleDelete}>
          Delete
        </KitchenButton>
        <KitchenButton variant="primary" onClick={() => setEditing(true)}>
          Edit
        </KitchenButton>
      </>
    )
  ) : undefined;

  return (
    <KitchenModal title={recipe.name || "Untitled recipe"} onClose={onClose} footer={footer}>
      <div className="space-y-4">
        {error && (
          <p className="text-[13px] text-[var(--k-fg-danger-strong)] bg-[var(--k-danger-soft)] border border-[var(--k-border-danger-subtle)] rounded-[3px] px-3 py-2">
            {error}
          </p>
        )}

        {recipe.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {recipe.photos.map((photo, i) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-[3px] overflow-hidden border border-[var(--k-border-default)]"
              >
                <Image
                  src={recipePhotoUrl(photo.id)}
                  alt={recipe.name ?? "recipe photo"}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {editing && (
                  <div className="absolute inset-0 flex flex-col justify-between p-1">
                    <button
                      type="button"
                      aria-label="remove photo"
                      onClick={() => handleRemovePhoto(photo.id)}
                      disabled={photoBusy}
                      className="self-end w-5 h-5 rounded-[2px] bg-[var(--k-dark)] text-[var(--k-white)] text-xs leading-5 disabled:opacity-50"
                    >
                      &times;
                    </button>
                    {i === 0 ? (
                      <span className="self-start text-[10px] px-1 py-0.5 rounded-[2px] bg-[var(--k-brand-softer)] text-[var(--k-fg-brand-strong)] font-medium">
                        Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetThumbnail(photo.id)}
                        disabled={photoBusy}
                        className="self-start text-[10px] px-1 py-0.5 rounded-[2px] bg-[var(--k-neutral-primary-soft)] text-[var(--k-heading)] hover:bg-[var(--k-neutral-secondary-medium)] disabled:opacity-50"
                      >
                        Make cover
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div>
            <KitchenLabel htmlFor="edit-recipe-photos">Add Photos</KitchenLabel>
            <KitchenFileInput
              id="edit-recipe-photos"
              accept="image/*"
              multiple
              disabled={photoBusy}
              onChange={(e) => handleAddPhotos(e.target.files)}
            />
          </div>
        )}

        {editing ? (
          <>
            <div>
              <KitchenLabel htmlFor="edit-recipe-name">Name</KitchenLabel>
              <KitchenInput id="edit-recipe-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            </div>
            <div>
              <KitchenLabel htmlFor="edit-recipe-description">Description</KitchenLabel>
              <KitchenTextarea
                id="edit-recipe-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>
            <div>
              <KitchenLabel htmlFor="edit-recipe-link">Link</KitchenLabel>
              <KitchenInput
                id="edit-recipe-link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="link to the original recipe, if there is one"
                maxLength={500}
              />
            </div>
            <TagPicker availableTags={availableTags} selected={tags} onChange={setTags} />
          </>
        ) : (
          <>
            {recipe.link && (
              <a
                href={recipe.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[15px] font-medium text-[var(--k-fg-brand)] underline hover:no-underline font-[family-name:var(--k-font-sans)]"
              >
                View Original Recipe
              </a>
            )}
            {recipe.description && (
              <p className="text-[15px] text-[var(--k-body)] font-[family-name:var(--k-font-sans)] leading-relaxed whitespace-pre-wrap">
                {recipe.description}
              </p>
            )}
            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recipe.tags.map((tag) => (
                  <TagChip key={tag.id} label={tag.name} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </KitchenModal>
  );
}
