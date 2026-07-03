"use client";

import { useState } from "react";
import Image from "next/image";
import KitchenModal from "./KitchenModal";
import KitchenButton from "./KitchenButton";
import { KitchenInput, KitchenLabel, KitchenTextarea } from "./KitchenFormControls";
import TagChip from "./TagChip";
import TagPicker from "./TagPicker";
import { API_BASE, Recipe, TagWithCount, recipePhotoUrl } from "./types";

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
 * Expanded view of a single recipe: all its photos, name, description, and
 * tags. When logged in as admin, offers inline editing and deletion.
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
  const [tags, setTags] = useState(recipe.tags.map((t) => t.name));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Saves the edited name/description/tags via the admin-only PATCH endpoint. */
  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() || null, description: description.trim() || null, tags }),
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
      const res = await fetch(`${API_BASE}/recipes/${recipe.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
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
            {recipe.photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-[3px] overflow-hidden border border-[var(--k-border-default)]">
                <Image
                  src={recipePhotoUrl(photo.id)}
                  alt={recipe.name ?? "recipe photo"}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
            ))}
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
            <TagPicker availableTags={availableTags} selected={tags} onChange={setTags} />
          </>
        ) : (
          <>
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
