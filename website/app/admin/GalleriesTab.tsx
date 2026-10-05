"use client";

import { useState } from "react";
import { adminRequest, errorMessage, jsonBody, useAdminData, useAdminFetch } from "./adminApi";
import {
  ALL_GALLERIES_PATH,
  EMPTY_GALLERY_DETAILS,
  createGallery,
  galleryDetailsProblem,
  type GalleryDetails,
} from "./galleryApi";
import GalleryCard from "./GalleryCard";
import { GalleryFields } from "./GalleryForms";
import { plural } from "./format";
import type { Gallery } from "./types";
import { Button, Card, FlashMessage, Muted, Toolbar, useFlash } from "./ui";

/**
 * The Galleries tab: every gallery as a card (reorder, edit, delete, manage
 * photos), plus a form to start a new one.
 */

/**
 * The display_order values that swap two neighbouring galleries.
 * @param moving - The gallery being moved.
 * @param neighbour - The one it swaps with.
 * @param direction - -1 moving up (shown earlier), +1 moving down.
 * @returns The new orders for each.
 */
function swappedOrders(moving: Gallery, neighbour: Gallery, direction: -1 | 1): { moving: number; neighbour: number } {
  // higher display_order shows first. equal orders would swap to the same thing, so
  // nudge the moving one just past its neighbour instead
  if (moving.display_order === neighbour.display_order) {
    return { moving: neighbour.display_order - direction, neighbour: neighbour.display_order };
  }
  return { moving: neighbour.display_order, neighbour: moving.display_order };
}

/**
 * The "new gallery" form.
 * @param props.onCreated - Called after the gallery is created.
 * @param props.onCancel - Called when it's closed without creating.
 */
function NewGalleryForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const adminFetch = useAdminFetch();
  const [details, setDetails] = useState<GalleryDetails>(EMPTY_GALLERY_DETAILS);
  const [creating, setCreating] = useState(false);
  const [flash, showFlash] = useFlash();

  const create = async () => {
    const problem = galleryDetailsProblem(details);
    if (problem) {
      showFlash("error", problem);
      return;
    }
    setCreating(true);
    try {
      await createGallery(adminFetch, details);
      onCreated();
    } catch (err) {
      showFlash("error", errorMessage(err));
      setCreating(false);
    }
  };

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 font-semibold text-white">New gallery</div>
      <GalleryFields idPrefix="new-gallery" value={details} onChange={setDetails} autoSlug />
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={create} disabled={creating}>
          {creating ? "Creating..." : "Create"}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      <FlashMessage flash={flash} />
    </Card>
  );
}

/**
 * The Galleries tab.
 */
export default function GalleriesTab() {
  const adminFetch = useAdminFetch();
  const galleries = useAdminData<Gallery[]>(ALL_GALLERIES_PATH, "couldn't load galleries");
  const [creating, setCreating] = useState(false);
  const [flash, showFlash] = useFlash();

  const move = async (index: number, direction: -1 | 1) => {
    const list = galleries.data ?? [];
    const moving = list[index];
    const neighbour = list[index + direction];
    if (!moving || !neighbour) return;
    const orders = swappedOrders(moving, neighbour, direction);
    try {
      await Promise.all([
        adminRequest(adminFetch, `/galleries/${moving.id}`, "couldn't reorder", jsonBody("PATCH", { display_order: orders.moving })),
        adminRequest(adminFetch, `/galleries/${neighbour.id}`, "couldn't reorder", jsonBody("PATCH", { display_order: orders.neighbour })),
      ]);
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
    galleries.reload();
  };

  const finishCreating = () => {
    setCreating(false);
    galleries.reload();
  };

  if (!galleries.data) return <Muted>{galleries.error ?? "Loading galleries..."}</Muted>;

  const list = galleries.data;
  return (
    <div>
      <Toolbar summary={plural(list.length, "gallery", "galleries")}>
        {!creating && (
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            New gallery
          </Button>
        )}
      </Toolbar>
      {creating && <NewGalleryForm onCreated={finishCreating} onCancel={() => setCreating(false)} />}
      <FlashMessage flash={flash} />
      {galleries.error && <p className="mb-3 text-sm text-red-300">{galleries.error}</p>}
      <div className="flex flex-col gap-3">
        {list.map((gallery, i) => (
          <GalleryCard
            key={gallery.id}
            gallery={gallery}
            canMoveUp={i > 0}
            canMoveDown={i < list.length - 1}
            onMove={(direction) => move(i, direction)}
            onChanged={galleries.reload}
          />
        ))}
      </div>
    </div>
  );
}
