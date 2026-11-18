"use client";

import { useState } from "react";
import { djSetAudioUrl, DJ_SETS_PATH, type DjSet } from "@/app/opium-den/djApi";
import { adminRequest, errorMessage, jsonBody, useAdminData, useAdminFetch } from "./adminApi";
import { formatBytes, formatDate, formatDuration, plural } from "./format";
import { Badge, Button, Card, FlashMessage, INPUT_CLASS, Muted, Toolbar, useFlash } from "./ui";

/**
 * The DJ sets tab: every set the live stream recorded, which all show on the Opium Den
 * page as soon as they end. Name the keepers, delete the trainwrecks.
 */

/**
 * One set: a title box, a player, and delete.
 * @param props.set - The set.
 * @param props.onRename - Saves a new title (blank clears it). Resolves once saved.
 * @param props.onDelete - Deletes it (after confirming).
 */
function DjSetCard({
  set,
  onRename,
  onDelete,
}: {
  set: DjSet;
  onRename: (title: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(set.title ?? "");
  const [saving, setSaving] = useState(false);
  const changed = title.trim() !== (set.title ?? "");

  const save = async () => {
    setSaving(true);
    await onRename(title.trim());
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
        className="flex gap-2"
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
          aria-label="Set title"
        />
        <Button type="submit" size="sm" variant="primary" disabled={!changed || saving}>
          Save
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

  const renameSet = async (id: number, title: string) => {
    try {
      const updated = await adminRequest<DjSet>(
        adminFetch,
        `${DJ_SETS_PATH}/${id}`,
        "couldn't rename the set",
        jsonBody("PATCH", { title })
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
            onRename={(title) => renameSet(set.id, title)}
            onDelete={() => deleteSet(set.id)}
          />
        ))}
      </div>
    </div>
  );
}
