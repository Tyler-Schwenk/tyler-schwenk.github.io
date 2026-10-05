"use client";

import { useState } from "react";
import Image from "next/image";
import { photoUrl } from "@/lib/api";
import { adminRequest, errorMessage, jsonBody, useAdminData, useAdminFetch } from "./adminApi";
import { galleryDetailsProblem, uploadPhotos, type GalleryDetails, type UploadResult } from "./galleryApi";
import { GalleryFields, UploadOutcome } from "./GalleryForms";
import { ChevronIcon } from "./icons";
import { plural } from "./format";
import type { Gallery, GalleryPhoto } from "./types";
import { Badge, Button, Card, DropZone, FlashMessage, Muted, ProgressBar, useFlash } from "./ui";

/**
 * One gallery in the Galleries tab: its name and stats, reorder arrows, an
 * inline edit form, and (expanded) its photos, each deletable, with a drop
 * zone to add more.
 */

// long descriptions are cut to this in the card's summary line
const DESCRIPTION_PREVIEW_CHARS = 60;

/**
 * Cuts a description down for the summary line.
 * @param description - The full description.
 * @returns It, or its start with an ellipsis.
 */
function previewDescription(description: string): string {
  if (description.length <= DESCRIPTION_PREVIEW_CHARS) return description;
  return `${description.slice(0, DESCRIPTION_PREVIEW_CHARS)}...`;
}

/**
 * The expanded part of a card: the gallery's photos and a way to add more.
 * @param props.gallery - The gallery.
 * @param props.onChanged - Called after photos are added or removed, to refresh counts.
 */
function GalleryPhotos({ gallery, onChanged }: { gallery: Gallery; onChanged: () => void }) {
  const adminFetch = useAdminFetch();
  const photos = useAdminData<GalleryPhoto[]>(`/galleries/${gallery.id}/photos`, "couldn't load the photos");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [flash, showFlash] = useFlash();

  const deletePhoto = async (photoId: number) => {
    if (!window.confirm("Delete this photo? This can't be undone.")) return;
    try {
      await adminRequest(adminFetch, `/galleries/photos/${photoId}`, "couldn't delete the photo", { method: "DELETE" });
      photos.setData((current) => current?.filter((photo) => photo.id !== photoId) ?? null);
      onChanged();
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
  };

  const addPhotos = async (files: File[]) => {
    if (!files.length) return;
    setResult(null);
    setProgress(0);
    try {
      setResult(await uploadPhotos(adminFetch, gallery.id, files, setProgress));
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
    setProgress(null);
    photos.reload();
    onChanged();
  };

  return (
    <div className="border-t border-slate-800 p-4">
      {photos.data === null && <Muted>{photos.error ?? "Loading photos..."}</Muted>}
      {photos.data?.length === 0 && <Muted>No photos yet.</Muted>}
      {photos.data && photos.data.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
          {photos.data.map((photo) => (
            <div key={photo.id} className="relative aspect-square overflow-hidden rounded-md bg-slate-950">
              <Image src={photoUrl(photo.id, true)} alt="" fill sizes="120px" className="object-cover" />
              <button
                type="button"
                onClick={() => deletePhoto(photo.id)}
                aria-label="Delete photo"
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-base leading-none text-white hover:bg-red-600"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      <DropZone
        label="Add photos"
        hint="Tap to pick, or drop them here"
        accept="image/*"
        multiple
        onFiles={addPhotos}
        disabled={progress !== null}
      />
      {progress !== null && <ProgressBar fraction={progress} />}
      <UploadOutcome result={result} />
      <FlashMessage flash={flash} />
    </div>
  );
}

/**
 * The inline edit form: name, slug, description, public.
 * @param props.gallery - The gallery being edited.
 * @param props.onDone - Called after a save (true) or cancel (false).
 */
function GalleryEditForm({ gallery, onDone }: { gallery: Gallery; onDone: (saved: boolean) => void }) {
  const adminFetch = useAdminFetch();
  const [details, setDetails] = useState<GalleryDetails>({
    name: gallery.name,
    slug: gallery.slug,
    description: gallery.description ?? "",
  });
  const [isPublic, setIsPublic] = useState(gallery.is_public);
  const [saving, setSaving] = useState(false);
  const [flash, showFlash] = useFlash();

  const save = async () => {
    const problem = galleryDetailsProblem(details);
    if (problem) {
      showFlash("error", problem);
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: details.name.trim(),
        slug: details.slug.trim(),
        description: details.description.trim() || null,
        is_public: isPublic,
      };
      await adminRequest(adminFetch, `/galleries/${gallery.id}`, "couldn't save the gallery", jsonBody("PATCH", body));
      onDone(true);
    } catch (err) {
      showFlash("error", errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-slate-800 bg-slate-950/50 p-4">
      <GalleryFields idPrefix={`edit-${gallery.id}`} value={details} onChange={setDetails} />
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-slate-200">
        <input type="checkbox" className="h-5 w-5 accent-orange-500" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Public (shown on the site)
      </label>
      <div className="mt-2 flex gap-2">
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button onClick={() => onDone(false)}>Cancel</Button>
      </div>
      <FlashMessage flash={flash} />
    </div>
  );
}

/**
 * A gallery's card.
 * @param props.gallery - The gallery.
 * @param props.canMoveUp - It's not first.
 * @param props.canMoveDown - It's not last.
 * @param props.onMove - Called with -1 (up) or +1 (down).
 * @param props.onChanged - Called after anything changes it, to reload the list.
 */
export default function GalleryCard({
  gallery,
  canMoveUp,
  canMoveDown,
  onMove,
  onChanged,
}: {
  gallery: Gallery;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onChanged: () => void;
}) {
  const adminFetch = useAdminFetch();
  const [editing, setEditing] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [flash, showFlash] = useFlash();

  const deleteGallery = async () => {
    if (!window.confirm(`Delete "${gallery.name}" and ALL its photos? This can't be undone.`)) return;
    try {
      await adminRequest(adminFetch, `/galleries/${gallery.id}`, "couldn't delete the gallery", { method: "DELETE" });
      onChanged();
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
  };

  const finishEditing = (saved: boolean) => {
    setEditing(false);
    if (saved) onChanged();
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-white">{gallery.name}</span>
            <Badge tone={gallery.is_public ? "green" : "grey"}>{gallery.is_public ? "public" : "private"}</Badge>
          </div>
          <div className="mt-1 truncate text-xs text-slate-400">
            {plural(gallery.photo_count ?? 0, "photo")}
            {gallery.description && ` - ${previewDescription(gallery.description)}`}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" aria-label="Move up" disabled={!canMoveUp} onClick={() => onMove(-1)}>
            <ChevronIcon className="h-4 w-4" />
          </Button>
          <Button size="sm" aria-label="Move down" disabled={!canMoveDown} onClick={() => onMove(1)}>
            <ChevronIcon className="h-4 w-4 rotate-180" />
          </Button>
          <span className="flex-1 sm:w-2 sm:flex-none" />
          <Button size="sm" aria-pressed={editing} onClick={() => setEditing(!editing)}>
            Edit
          </Button>
          <Button size="sm" aria-pressed={photosOpen} onClick={() => setPhotosOpen(!photosOpen)}>
            Photos
            <ChevronIcon className={`h-3.5 w-3.5 transition ${photosOpen ? "" : "rotate-180"}`} />
          </Button>
          <Button size="sm" variant="danger" onClick={deleteGallery}>
            Delete
          </Button>
        </div>
      </div>
      {flash && (
        <div className="px-4 pb-3">
          <FlashMessage flash={flash} />
        </div>
      )}
      {editing && <GalleryEditForm gallery={gallery} onDone={finishEditing} />}
      {photosOpen && <GalleryPhotos gallery={gallery} onChanged={onChanged} />}
    </Card>
  );
}
