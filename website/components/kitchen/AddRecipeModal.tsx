"use client";

import { useEffect, useState } from "react";
import KitchenModal from "./KitchenModal";
import KitchenButton from "./KitchenButton";
import { KitchenInput, KitchenLabel, KitchenTextarea } from "./KitchenFormControls";
import TagPicker from "./TagPicker";
import { API_BASE, Recipe, TagWithCount } from "./types";

// keep in sync with MAX_PHOTOS_PER_RECIPE in pi/services/website-backend/app/schemas.py
const MAX_PHOTOS = 12;

interface PhotoDraft {
  file: File;
  previewUrl: string;
}

interface AddRecipeModalProps {
  availableTags: TagWithCount[];
  onClose: () => void;
  onCreated: (recipe: Recipe) => void;
}

/**
 * The "add a new recipe" form: name, description, tags, and photos, all
 * optional. Submits as multipart form data so photos can go straight from
 * a phone's camera roll to the Pi. No login required -- creation is public
 * and rate-limited server-side.
 *
 * @param {AddRecipeModalProps} props - Component props.
 * @param {TagWithCount[]} props.availableTags - Existing tags for the picker's suggestions.
 * @param {() => void} props.onClose - Called when the modal should close.
 * @param {(recipe: Recipe) => void} props.onCreated - Called with the newly created recipe on success.
 * @returns {JSX.Element} The add-recipe modal.
 */
export default function AddRecipeModal({ availableTags, onClose, onCreated }: AddRecipeModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // object URLs are only good for this tab's lifetime -- revoke them on unmount
  // so picking lots of photos across an editing session doesn't leak memory
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Adds newly picked files to the photo list, capped at MAX_PHOTOS.
   *
   * @param {FileList | null} files - Files chosen from the file input.
   */
  function addPhotos(files: FileList | null) {
    if (!files) return;
    const drafts = Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...drafts].slice(0, MAX_PHOTOS));
  }

  /**
   * Removes a photo draft and revokes its preview URL.
   *
   * @param {number} index - Index of the photo to remove.
   */
  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  /** Submits the form as multipart data to the backend. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    if (name.trim()) formData.append("name", name.trim());
    if (description.trim()) formData.append("description", description.trim());
    if (tags.length > 0) formData.append("tags", tags.join(","));
    photos.forEach((photo) => formData.append("files", photo.file));

    try {
      const res = await fetch(`${API_BASE}/recipes`, { method: "POST", body: formData });

      if (res.status === 429) {
        setError("too many recipes submitted from your network - give it a minute and try again");
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.detail === "string" ? data.detail : "something went wrong - try again in a moment");
        setSubmitting(false);
        return;
      }

      const recipe: Recipe = await res.json();
      onCreated(recipe);
    } catch {
      setError("couldn't reach the server - check your connection and try again");
      setSubmitting(false);
    }
  }

  return (
    <KitchenModal title="Add a Recipe" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <KitchenLabel htmlFor="recipe-name">Name</KitchenLabel>
          <KitchenInput
            id="recipe-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="grandma's lasagna"
            maxLength={200}
          />
        </div>

        <div>
          <KitchenLabel htmlFor="recipe-description">Description</KitchenLabel>
          <KitchenTextarea
            id="recipe-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ingredients, steps, notes - whatever you've got"
            rows={6}
          />
        </div>

        <TagPicker availableTags={availableTags} selected={tags} onChange={setTags} />

        <div>
          <KitchenLabel htmlFor="recipe-photos">Photos</KitchenLabel>
          <input
            id="recipe-photos"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => addPhotos(e.target.files)}
            className="block w-full text-[13px] text-[var(--k-body)] font-[family-name:var(--k-font-sans)] file:mr-3 file:rounded-[3px] file:border file:border-[var(--k-border-default)] file:bg-[var(--k-neutral-primary-soft)] file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-[var(--k-heading)] hover:file:bg-[var(--k-neutral-secondary-medium)]"
          />
          {photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((photo, i) => (
                <div key={`${photo.file.name}-${i}`} className="relative w-16 h-16 rounded-[3px] overflow-hidden border border-[var(--k-border-default)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt={photo.file.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    aria-label={`remove ${photo.file.name}`}
                    onClick={() => removePhoto(i)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-[2px] bg-[var(--k-dark)] text-[var(--k-white)] text-xs leading-4"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-[13px] text-[var(--k-fg-danger-strong)] bg-[var(--k-danger-soft)] border border-[var(--k-border-danger-subtle)] rounded-[3px] px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <KitchenButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </KitchenButton>
          <KitchenButton type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Saving..." : "Save Recipe"}
          </KitchenButton>
        </div>
      </form>
    </KitchenModal>
  );
}
