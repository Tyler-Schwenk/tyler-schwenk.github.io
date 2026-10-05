"use client";

import { useState } from "react";
import { adminRequest, errorMessage, useAdminData, useAdminFetch } from "./adminApi";
import {
  ALL_GALLERIES_PATH,
  EMPTY_GALLERY_DETAILS,
  createGallery,
  galleryDetailsProblem,
  uploadPhotos,
  type GalleryDetails,
  type UploadResult,
} from "./galleryApi";
import { GalleryFields, UploadOutcome } from "./GalleryForms";
import { formatBytes, formatDuration, slugify } from "./format";
import type { Gallery, Video } from "./types";
import { Badge, Button, Card, DropZone, Field, FlashMessage, INPUT_CLASS, Muted, ProgressBar, Segmented, useFlash } from "./ui";

/**
 * The Upload tab: photos into an existing or new gallery, or a video (with
 * the list of existing videos, since a slug can only be reused after deleting).
 */

type UploadKind = "photos" | "video";
type GalleryMode = "existing" | "new";

const UPLOAD_KIND_OPTIONS: { value: UploadKind; label: string }[] = [
  { value: "photos", label: "Photos" },
  { value: "video", label: "Video" },
];

const GALLERY_MODE_OPTIONS: { value: GalleryMode; label: string }[] = [
  { value: "existing", label: "Existing gallery" },
  { value: "new", label: "New gallery" },
];

/**
 * The files picked so far, each removable.
 * @param props.files - Picked files.
 * @param props.onRemove - Called with the index to drop.
 */
function PickedFiles({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  if (!files.length) return null;
  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {files.map((file, i) => (
        <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            {file.name} <span className="text-slate-500">({formatBytes(file.size)})</span>
          </span>
          <Button size="sm" variant="quiet" aria-label={`Remove ${file.name}`} onClick={() => onRemove(i)}>
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Photos into an existing gallery, or a new one made on the spot.
 */
function PhotoUploadForm() {
  const adminFetch = useAdminFetch();
  const galleries = useAdminData<Gallery[]>(ALL_GALLERIES_PATH, "couldn't load galleries");
  const [mode, setMode] = useState<GalleryMode>("existing");
  const [galleryId, setGalleryId] = useState("");
  const [details, setDetails] = useState<GalleryDetails>(EMPTY_GALLERY_DETAILS);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [flash, showFlash] = useFlash();

  // which gallery to upload into, creating it first in "new" mode
  const targetGalleryId = async (): Promise<number> => {
    if (mode === "existing") return Number(galleryId);
    const gallery = await createGallery(adminFetch, details);
    galleries.reload();
    return gallery.id;
  };

  const problem = (): string | null => {
    if (!files.length) return "pick some photos first";
    if (mode === "existing" && !galleryId) return "pick a gallery to add them to";
    return mode === "new" ? galleryDetailsProblem(details) : null;
  };

  const upload = async () => {
    const reason = problem();
    if (reason) {
      showFlash("error", reason);
      return;
    }
    setResult(null);
    setProgress(0);
    try {
      const id = await targetGalleryId();
      setResult(await uploadPhotos(adminFetch, id, files, setProgress));
      setFiles([]);
      if (mode === "new") setDetails(EMPTY_GALLERY_DETAILS);
      galleries.reload();
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
    setProgress(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Segmented options={GALLERY_MODE_OPTIONS} value={mode} onChange={setMode} />
      {mode === "existing" ? (
        <Field label="Gallery" htmlFor="upload-gallery">
          <select id="upload-gallery" className={INPUT_CLASS} value={galleryId} onChange={(e) => setGalleryId(e.target.value)}>
            <option value="">{galleries.data ? "Pick a gallery..." : galleries.error ?? "Loading..."}</option>
            {galleries.data?.map((gallery) => (
              <option key={gallery.id} value={gallery.id}>
                {gallery.name} ({gallery.photo_count ?? 0})
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <GalleryFields idPrefix="upload-new" value={details} onChange={setDetails} autoSlug />
      )}
      <div>
        <DropZone
          label="Pick photos"
          hint="JPG, PNG, HEIC - or drop them here"
          accept="image/*"
          multiple
          onFiles={(picked) => setFiles((current) => [...current, ...picked])}
          disabled={progress !== null}
        />
        <PickedFiles files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} />
      </div>
      <div>
        <Button variant="primary" className="w-full" onClick={upload} disabled={progress !== null}>
          {progress !== null ? "Uploading..." : "Upload"}
        </Button>
        {progress !== null && <ProgressBar fraction={progress} />}
        <UploadOutcome result={result} />
        <FlashMessage flash={flash} />
      </div>
    </div>
  );
}

/**
 * The existing videos, each deletable.
 * @param props.videos - The videos, or null while loading.
 * @param props.error - Why they couldn't load.
 * @param props.onDelete - Called with a video's id after confirming.
 */
function VideoList({ videos, error, onDelete }: { videos: Video[] | null; error: string | null; onDelete: (id: number) => void }) {
  if (!videos) return <Muted>{error ?? "Loading videos..."}</Muted>;
  if (!videos.length) return <Muted>No videos yet.</Muted>;
  return (
    <div className="flex flex-col gap-2">
      {videos.map((video) => (
        <Card key={video.id} className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{video.title}</div>
            <div className="mt-1 flex items-center gap-2 truncate text-xs text-slate-400">
              <Badge tone={video.is_public ? "green" : "grey"}>{video.is_public ? "public" : "private"}</Badge>
              {video.slug}
              {video.duration != null && ` - ${formatDuration(video.duration)}`}
            </div>
          </div>
          <Button size="sm" variant="danger" onClick={() => onDelete(video.id)}>
            Delete
          </Button>
        </Card>
      ))}
    </div>
  );
}

/**
 * One video with a title, slug and description, plus the existing videos.
 */
function VideoUploadForm() {
  const adminFetch = useAdminFetch();
  const videos = useAdminData<Video[]>("/videos?public_only=false", "couldn't load videos");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [flash, showFlash] = useFlash();

  const upload = async () => {
    if (!file) {
      showFlash("error", "pick a video file first");
      return;
    }
    if (!title.trim() || !slug.trim()) {
      showFlash("error", "a video needs a title and a slug");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("title", title.trim());
    form.append("slug", slug.trim());
    if (description.trim()) form.append("description", description.trim());
    setUploading(true);
    try {
      await adminRequest(adminFetch, "/videos", "the video upload failed", { method: "POST", body: form });
      setFile(null);
      setTitle("");
      setSlug("");
      setDescription("");
      showFlash("success", "Video uploaded.");
      videos.reload();
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
    setUploading(false);
  };

  const deleteVideo = async (id: number) => {
    if (!window.confirm("Delete this video? This can't be undone.")) return;
    try {
      await adminRequest(adminFetch, `/videos/${id}`, "couldn't delete the video", { method: "DELETE" });
      videos.setData((current) => current?.filter((video) => video.id !== id) ?? null);
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" htmlFor="video-title">
          <input
            id="video-title"
            className={INPUT_CLASS}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Slug" htmlFor="video-slug">
          <input
            id="video-slug"
            className={INPUT_CLASS}
            value={slug}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => setSlug(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Description" htmlFor="video-description">
        <textarea
          id="video-description"
          className={`${INPUT_CLASS} min-h-20 resize-y`}
          value={description}
          placeholder="Optional"
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div>
        <DropZone
          label="Pick a video"
          hint="MP4 or WebM - big files take a minute, keep this page open"
          accept="video/*"
          onFiles={(picked) => setFile(picked[0] ?? null)}
          disabled={uploading}
        />
        <PickedFiles files={file ? [file] : []} onRemove={() => setFile(null)} />
      </div>
      <div>
        <Button variant="primary" className="w-full" onClick={upload} disabled={uploading}>
          {uploading ? "Uploading..." : "Upload video"}
        </Button>
        <FlashMessage flash={flash} />
      </div>
      <div className="mt-2">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Existing videos</h2>
        <p className="mb-3 text-xs text-slate-500">Slugs must be unique - delete a video before re-uploading with its slug.</p>
        <VideoList videos={videos.data} error={videos.error} onDelete={deleteVideo} />
      </div>
    </div>
  );
}

/**
 * The Upload tab.
 */
export default function UploadTab() {
  const [kind, setKind] = useState<UploadKind>("photos");
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Segmented options={UPLOAD_KIND_OPTIONS} value={kind} onChange={setKind} />
      {kind === "photos" ? <PhotoUploadForm /> : <VideoUploadForm />}
    </div>
  );
}
