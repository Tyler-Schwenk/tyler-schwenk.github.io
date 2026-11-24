"use client";

import { DJ_ROOM_PHOTOS_PATH, djRoomPhotoUrl, type DjRoomPhoto } from "@/app/opium-den/djApi";
import { adminRequest, errorMessage, useAdminData, useAdminFetch } from "./adminApi";
import { formatDate, plural } from "./format";
import { Button, Card, FlashMessage, Muted, Toolbar, useFlash } from "./ui";

/**
 * The live room's uploaded pictures on the DJ tab: anyone in the room can stand in as a
 * picture of their own instead of a character, so here's every upload (newest first)
 * with Remove. Removing one takes it off whoever's using it right now (they're asked to
 * pick again) and out of every set's replay, and deletes it from the Pi.
 */
export default function RoomPhotosPanel() {
  const adminFetch = useAdminFetch();
  const photos = useAdminData<DjRoomPhoto[]>(DJ_ROOM_PHOTOS_PATH, "couldn't load the room's pictures");
  const [flash, showFlash] = useFlash();

  const remove = async (photo: DjRoomPhoto) => {
    if (!window.confirm("Remove this picture from the room and every replay? It can't be undone.")) return;
    try {
      await adminRequest(adminFetch, `${DJ_ROOM_PHOTOS_PATH}/${photo.id}`, "couldn't remove the picture", { method: "DELETE" });
      photos.setData((current) => current?.filter((row) => row.id !== photo.id) ?? null);
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
  };

  const summary = photos.data ? `Room pictures: ${plural(photos.data.length, "upload")}` : "Room pictures";

  return (
    <Card className="mb-4 p-3">
      <Toolbar summary={summary}>
        <Button size="sm" onClick={photos.reload}>
          Refresh
        </Button>
      </Toolbar>
      <FlashMessage flash={flash} />
      {!photos.data && <Muted>{photos.error ?? "Loading..."}</Muted>}
      {photos.data?.length === 0 && <Muted>Nobody&apos;s uploaded a picture yet.</Muted>}
      {photos.data && photos.data.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {photos.data.map((photo) => (
            <li key={photo.id} className="flex flex-col items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static export can't optimize images from the pi */}
              <img src={djRoomPhotoUrl(photo.id)} alt="" className="aspect-square w-full rounded object-cover" />
              <span className="text-xs text-slate-500">{formatDate(photo.created_at)}</span>
              <Button size="sm" variant="danger" onClick={() => remove(photo)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
