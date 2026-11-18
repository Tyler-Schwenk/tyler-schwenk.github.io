"use client";

import { useState } from "react";
import { djSetAudioUrl, DJ_SETS_PATH, type DjSet } from "@/app/opium-den/djApi";
import { adminRequest, errorMessage, jsonBody, useAdminData, useAdminFetch } from "./adminApi";
import { formatBytes, formatDate, formatDuration, plural } from "./format";
import { Badge, Button, Card, FlashMessage, INPUT_CLASS, Muted, Toolbar, useFlash } from "./ui";

/**
 * The DJ sets tab: every set the live stream recorded, which all show on the Opium Den
 * page as soon as they end. Name and describe the keepers, delete the trainwrecks.
 */

// match the backend's limits (MAX_DJ_SET_*_LENGTH in schemas.py)
const DJ_SET_TITLE_MAX_LENGTH = 200;
const DJ_SET_DESCRIPTION_MAX_LENGTH = 5000;

/** What the card saves: the title and description, trimmed. Blank clears one. */
type DjSetEdit = { title: string; description: string };

/**
 * One set: title and description boxes, a player, and delete.
 * @param props.set - The set.
 * @param props.onSave - Saves the title and description. Resolves once saved.
 * @param props.onDelete - Deletes it (after confirming).
 */
function DjSetCard({
  set,
  onSave,
  onDelete,
}: {
  set: DjSet;
  onSave: (edit: DjSetEdit) => Promise<void>;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(set.title ?? "");
  const [description, setDescription] = useState(set.description ?? "");
  const [saving, setSaving] = useState(false);
  const changed = title.trim() !== (set.title ?? "") || description.trim() !== (set.description ?? "");

  const save = async () => {
    setSaving(true);
    await onSave({ title: title.trim(), description: description.trim() });
    setSaving(false);
  };

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
        <span>{formatDate(set.started_at)}</span>
        <Badge tone="grey">{formatDuration(set.duration_s)}</Badge>
        <Badge tone="grey">{formatBytes(set.size_bytes)}</Badge>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) save();
        }}
      >
        <input
          className={INPUT_CLASS}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Untitled (shows the date)"
          maxLength={DJ_SET_TITLE_MAX_LENGTH}
          aria-label="Set title"
        />
        <textarea
          className={`${INPUT_CLASS} min-h-24 resize-y`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description: tracklist, vibe, what went wrong..."
          maxLength={DJ_SET_DESCRIPTION_MAX_LENGTH}
          aria-label="Set description"
        />
        <Button type="submit" size="sm" variant="primary" className="self-end" disabled={!changed || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </form>
      <audio className="w-full" controls preload="none" src={djSetAudioUrl(set.id)} />
      <Button size="sm" variant="danger" className="self-end" onClick={onDelete}>
        Delete
      </Button>
    </Card>
  );
}

/**
 * The DJ sets tab.
 */
export default function DjSetsTab() {
  const adminFetch = useAdminFetch();
  const sets = useAdminData<DjSet[]>(DJ_SETS_PATH, "couldn't load DJ sets");
  const [flash, showFlash] = useFlash();

  const saveSet = async (id: number, edit: DjSetEdit) => {
    try {
      const updated = await adminRequest<DjSet>(
        adminFetch,
        `${DJ_SETS_PATH}/${id}`,
        "couldn't save the set",
        jsonBody("PATCH", edit)
      );
      if (!updated) return;
      sets.setData((current) => current?.map((set) => (set.id === id ? updated : set)) ?? null);
      showFlash("success", "Saved.");
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
  };

  const deleteSet = async (id: number) => {
    if (!window.confirm("Delete this set and its recording? This can't be undone.")) return;
    try {
      await adminRequest(adminFetch, `${DJ_SETS_PATH}/${id}`, "couldn't delete the set", { method: "DELETE" });
      sets.setData((current) => current?.filter((set) => set.id !== id) ?? null);
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
  };

  if (!sets.data) return <Muted>{sets.error ?? "Loading DJ sets..."}</Muted>;

  return (
    <div>
      <Toolbar summary={plural(sets.data.length, "set")}>
        <Button size="sm" onClick={sets.reload}>
          Refresh
        </Button>
      </Toolbar>
      <FlashMessage flash={flash} />
      {sets.data.length === 0 && <Muted>No sets yet. They show up here when a live stream ends.</Muted>}
      <div className="grid gap-2 md:grid-cols-2">
        {sets.data.map((set) => (
          <DjSetCard
            key={set.id}
            set={set}
            onSave={(edit) => saveSet(set.id, edit)}
            onDelete={() => deleteSet(set.id)}
          />
        ))}
      </div>
    </div>
  );
}
