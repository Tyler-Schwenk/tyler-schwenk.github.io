"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteKilnPhoto,
  fetchKilnPhotoBlob,
  kilnPhotoUrl,
  updateKilnPhoto,
  uploadKilnPhoto,
  type KilnPhoto,
} from "@/app/kiln/kilnJournalApi";
import { JournalError, useJournalAction, VisibilityChips } from "./JournalControls";

/**
 * works out where to load a photo's image from. public ones load straight from the
 * backend. private ones need the token, so they're fetched and shown from memory.
 *
 * @param {KilnPhoto} photo - the photo.
 * @param {boolean} thumbnail - the small version.
 * @param {string | null} token - the kiln editor's jwt, or null.
 * @returns {string | null} the src, or null while a private one loads.
 */
function usePhotoSrc(photo: KilnPhoto, thumbnail: boolean, token: string | null): string | null {
  const [blobSrc, setBlobSrc] = useState<{ id: number; url: string } | null>(null);
  const needsToken = !photo.is_public && token !== null;

  useEffect(() => {
    if (!needsToken || !token) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchKilnPhotoBlob(photo.id, thumbnail, token)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobSrc({ id: photo.id, url: objectUrl });
      })
      .catch((error) => console.warn(`couldn't load private kiln photo ${photo.id}:`, error));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [needsToken, photo.id, thumbnail, token]);

  if (!needsToken) return kilnPhotoUrl(photo.id, thumbnail);
  return blobSrc?.id === photo.id ? blobSrc.url : null;
}

/**
 * a photo's image, from wherever usePhotoSrc says.
 *
 * @param {object} props - component props.
 * @param {KilnPhoto} props.photo - the photo.
 * @param {boolean} props.thumbnail - the small version.
 * @param {string | null} props.token - the kiln editor's jwt, or null.
 * @param {string} props.className - its class.
 * @returns {JSX.Element} the image, or an empty box while it loads.
 */
function PhotoImage({
  photo,
  thumbnail,
  token,
  className,
}: {
  photo: KilnPhoto;
  thumbnail: boolean;
  token: string | null;
  className: string;
}) {
  const src = usePhotoSrc(photo, thumbnail, token);
  if (!src) return <div className={className} aria-hidden="true" />;
  // backend images, so next/image's optimizer (off in a static export) has nothing to add
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="A piece from this firing" className={className} loading="lazy" />;
}

/**
 * a photo shown big over the page. clicking anywhere or pressing escape closes it.
 *
 * @param {object} props - component props.
 * @param {KilnPhoto} props.photo - the photo.
 * @param {string | null} props.token - the kiln editor's jwt, or null.
 * @param {() => void} props.onClose - closes it.
 * @returns {JSX.Element} the viewer.
 */
function PhotoViewer({ photo, token, onClose }: { photo: KilnPhoto; token: string | null; onClose: () => void }) {
  useEffect(() => {
    /**
     * closes the viewer on escape.
     *
     * @param {KeyboardEvent} event - the key press.
     */
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="kiln-viewer" role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose}>
      <PhotoImage photo={photo} thumbnail={false} token={token} className="kiln-viewer-image" />
      <button type="button" className="kiln-viewer-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

/**
 * the editor's upload form: pick photos, pick who sees them, send them one at a time.
 *
 * @param {object} props - component props.
 * @param {number} props.firingId - the firing they're from.
 * @param {string} props.token - the kiln editor's jwt.
 * @param {() => void} props.onChanged - reloads the photos after each upload.
 * @param {() => void} props.onAuthExpired - logs the editor out.
 * @returns {JSX.Element} the form.
 */
function PhotoUpload({
  firingId,
  token,
  onChanged,
  onAuthExpired,
}: {
  firingId: number;
  token: string;
  onChanged: () => void;
  onAuthExpired: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const action = useJournalAction(onAuthExpired);

  /** sends each picked photo, carrying on past ones that fail, then says how it went. */
  const upload = async () => {
    const failed: string[] = [];
    for (const [index, file] of files.entries()) {
      setProgress(`Uploading ${index + 1} of ${files.length}`);
      const worked = await action.run(() => uploadKilnPhoto(firingId, file, isPublic, token));
      if (!worked) failed.push(file.name);
      onChanged();
    }
    setProgress(failed.length ? `Couldn't upload ${failed.join(", ")}.` : null);
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="kiln-photo-upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        aria-label="Photos to add"
      />
      <div className="kiln-note-form-row">
        <span className="kiln-note-form-label">Who sees them</span>
        <VisibilityChips isPublic={isPublic} onChange={setIsPublic} />
      </div>
      <div className="kiln-note-form-actions">
        <button type="button" className="kiln-button" disabled={files.length === 0 || action.busy} onClick={upload}>
          {files.length > 1 ? `Add ${files.length} photos` : "Add photo"}
        </button>
        {progress && <span className="kiln-section-note">{progress}</span>}
      </div>
      <JournalError error={action.error} />
    </div>
  );
}

/**
 * one photo in the grid. the editor gets buttons to flip who sees it or delete it.
 *
 * @param {object} props - component props.
 * @param {KilnPhoto} props.photo - the photo.
 * @param {string | null} props.token - the kiln editor's jwt, or null.
 * @param {() => void} props.onOpen - shows it big.
 * @param {() => void} props.onChanged - reloads the photos after a change.
 * @param {() => void} props.onAuthExpired - logs the editor out.
 * @returns {JSX.Element} the tile.
 */
function PhotoTile({
  photo,
  token,
  onOpen,
  onChanged,
  onAuthExpired,
}: {
  photo: KilnPhoto;
  token: string | null;
  onOpen: () => void;
  onChanged: () => void;
  onAuthExpired: () => void;
}) {
  const action = useJournalAction(onAuthExpired);

  /**
   * runs a change to this photo, then reloads.
   *
   * @param {(token: string) => Promise<unknown>} write - the change.
   */
  const change = async (write: (token: string) => Promise<unknown>) => {
    if (!token) return;
    if (await action.run(() => write(token))) onChanged();
  };

  /** deletes the photo, after checking. */
  const remove = () => {
    if (window.confirm("Delete this photo? It can't be undone.")) change((auth) => deleteKilnPhoto(photo.id, auth));
  };

  return (
    <li className="kiln-photo">
      <button type="button" className="kiln-photo-open" onClick={onOpen} aria-label="Show this photo bigger">
        <PhotoImage photo={photo} thumbnail token={token} className="kiln-photo-image" />
      </button>
      {token && (
        <div className="kiln-journal-actions">
          {!photo.is_public && <span className="kiln-table-tag">Private</span>}
          <button
            type="button"
            disabled={action.busy}
            onClick={() => change((auth) => updateKilnPhoto(photo.id, !photo.is_public, auth))}
          >
            {photo.is_public ? "Make private" : "Make public"}
          </button>
          <button type="button" disabled={action.busy} onClick={remove}>
            Delete
          </button>
        </div>
      )}
      <JournalError error={action.error} />
    </li>
  );
}

/**
 * photos of what came out of a firing. everyone sees the public ones. the kiln editor
 * sees all of them, and can add more.
 *
 * @param {object} props - component props.
 * @param {number} props.firingId - the firing.
 * @param {KilnPhoto[]} props.photos - its photos, from useFiringJournal.
 * @param {string | null} props.token - the kiln editor's jwt, or null for the public view.
 * @param {() => void} props.onChanged - reloads the photos after a change.
 * @param {() => void} props.onAuthExpired - logs the editor out.
 * @returns {JSX.Element | null} the section, or nothing for a viewer with no photos to see.
 */
export default function FiringPhotos({
  firingId,
  photos,
  token,
  onChanged,
  onAuthExpired,
}: {
  firingId: number;
  photos: KilnPhoto[];
  token: string | null;
  onChanged: () => void;
  onAuthExpired: () => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const openPhoto = photos.find((photo) => photo.id === openId) ?? null;

  if (!token && photos.length === 0) return null;

  return (
    <section className="kiln-section" aria-label="Photos">
      <h2 className="kiln-section-title">
        Photos
        <span className="kiln-section-note">What came out of the kiln</span>
      </h2>
      {token && <PhotoUpload firingId={firingId} token={token} onChanged={onChanged} onAuthExpired={onAuthExpired} />}
      {photos.length === 0 ? (
        <p className="kiln-empty">No photos from this firing yet.</p>
      ) : (
        <ul className="kiln-photos">
          {photos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              token={token}
              onOpen={() => setOpenId(photo.id)}
              onChanged={onChanged}
              onAuthExpired={onAuthExpired}
            />
          ))}
        </ul>
      )}
      {openPhoto && <PhotoViewer photo={openPhoto} token={token} onClose={() => setOpenId(null)} />}
    </section>
  );
}
