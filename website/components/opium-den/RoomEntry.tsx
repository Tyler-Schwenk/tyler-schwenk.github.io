"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  DJ_CHAT_NICKNAME_MAX_LENGTH,
  fetchDjRoom,
  uploadDjRoomPhoto,
  type DjRoomLook,
  type DjRoomPerson,
} from "@/app/opium-den/djApi";
import { chatOwnerKey } from "@/lib/useDjChat";
import { usePoll } from "@/lib/usePoll";
import RoomAvatar from "./RoomAvatar";
import { characterFor, ROOM_CHARACTER_COUNT } from "./roomCharacters";

// quick enough that a character someone else just took greys out while you're choosing
const ROOM_POLL_INTERVAL_MS = 5000;
const TILE_CLASS =
  "flex h-24 flex-col items-center justify-end gap-1 border bg-den-bg px-1 pb-1.5 pt-2 transition disabled:cursor-not-allowed disabled:opacity-35 sm:h-28";
const ALL_CHARACTERS = Array.from({ length: ROOM_CHARACTER_COUNT }, (_, avatar) => avatar);

/**
 * the characters someone else in the room already is, so they can't be picked.
 *
 * @param {DjRoomPerson[]} people - who's in.
 * @param {string} myName - your name, since your own character's still yours to pick.
 * @returns {Map<number, string>} who has each taken character, by its number.
 */
function takenCharacters(people: DjRoomPerson[], myName: string): Map<number, string> {
  const mine = myName.toLowerCase();
  const taken = new Map<number, string>();
  for (const person of people) {
    if (person.photo_id === null && person.nickname.toLowerCase() !== mine) taken.set(person.avatar, person.nickname);
  }
  return taken;
}

/**
 * one choice in the picker: a character (or your photo), its name under it. it dances
 * once it's picked.
 *
 * @param {object} props
 * @param {number} props.avatar - the character's number (for a photo, any number).
 * @param {number | null} props.photoId - your photo, for the photo tile.
 * @param {string} props.label - what it's called.
 * @param {boolean} props.selected - it's the one picked.
 * @param {string | null} props.takenBy - who's already it, if someone is.
 * @param {() => void} props.onPick - picks it.
 * @returns {JSX.Element} the tile.
 */
function LookTile({
  avatar,
  photoId,
  label,
  selected,
  takenBy,
  onPick,
}: {
  avatar: number;
  photoId: number | null;
  label: string;
  selected: boolean;
  takenBy: string | null;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={takenBy !== null}
      aria-pressed={selected}
      title={takenBy ? `${label}: ${takenBy} is it` : label}
      className={`${TILE_CLASS} ${selected ? "border-den-accent ring-2 ring-den-accent" : "border-den-line hover:border-den-ink"}`}
    >
      <RoomAvatar avatar={avatar} photoId={photoId} still={!selected} className={photoId === null ? "h-12 sm:h-14" : "h-12 w-12 sm:h-14 sm:w-14"} />
      <span className="line-clamp-2 w-full text-center font-den-mono text-[10px] uppercase leading-tight text-den-muted">
        {takenBy ? "taken" : label}
      </span>
    </button>
  );
}

/**
 * the tile for bringing your own picture: pick a file and it uploads straight away, then
 * it's picked. shows "uploading..." meanwhile.
 *
 * @param {object} props
 * @param {boolean} props.uploading - an upload's going.
 * @param {(event: ChangeEvent<HTMLInputElement>) => void} props.onFile - takes the chosen file.
 * @returns {JSX.Element} the tile.
 */
function UploadTile({ uploading, onFile }: { uploading: boolean; onFile: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className={`${TILE_CLASS} cursor-pointer border-dashed border-den-ink hover:bg-den-raised`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-den-ink text-xl sm:h-14 sm:w-14">
        +
      </span>
      <span className="font-den-mono text-[10px] uppercase leading-tight text-den-muted">{uploading ? "uploading..." : "your own"}</span>
      <input type="file" accept="image/*" onChange={onFile} disabled={uploading} className="sr-only" />
    </label>
  );
}

/**
 * the way into the live room while a set's on: everyone in the room has a name and a look,
 * so you pick them before you're in. the name's the chat's; the look is one of the dancing
 * characters nobody else is (taken ones grey out, kept up to date while you choose), or
 * a picture of your own, uploaded on the spot. picking nothing gets whoever's free. also
 * where "change" in the chat brings you, and where you land if the pi turns you away (the
 * name or character got taken, or your picture was removed), with the reason.
 *
 * @param {object} props
 * @param {string} props.initialName - the name to start from, or "".
 * @param {DjRoomLook} props.initialLook - the look to start from, or null.
 * @param {string | null} props.problem - why the pi turned you away, if it did.
 * @param {(nickname: string, look: DjRoomLook) => void} props.onEnter - takes the name and look.
 * @param {() => void} [props.onCancel] - closes it without changing anything, when you're already in.
 * @returns {JSX.Element} the form.
 */
export default function RoomEntry({
  initialName,
  initialLook,
  problem,
  onEnter,
  onCancel,
}: {
  initialName: string;
  initialLook: DjRoomLook;
  problem: string | null;
  onEnter: (nickname: string, look: DjRoomLook) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [look, setLook] = useState<DjRoomLook>(initialLook);
  const [photoId, setPhotoId] = useState<number | null>(initialLook && "photoId" in initialLook ? initialLook.photoId : null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { data: people } = usePoll(fetchDjRoom, ROOM_POLL_INTERVAL_MS);
  const taken = takenCharacters(people ?? [], initialName);
  const pickedAvatar = look && "avatar" in look ? look.avatar : null;
  const pickedPhoto = look !== null && "photoId" in look;

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const photo = await uploadDjRoomPhoto(file, chatOwnerKey());
      setPhotoId(photo.id);
      setLook({ photoId: photo.id });
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onEnter(trimmed, look);
  };

  return (
    <form onSubmit={submit} className="den-grid mt-3 min-h-0 flex-1 overflow-y-auto border border-den-ink px-4 py-6 sm:mt-4 sm:py-8">
      <div className="mx-auto w-full max-w-xl">
        <label htmlFor="den-room-name" className="block text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
          Who&apos;s coming in?
        </label>
        <p className="mt-2 text-balance text-sm text-den-muted">
          Pick a name and who you&apos;ll be on the stage. Your name goes over your head and next to everything you say in the chat.
        </p>
        <input
          id="den-room-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="your name"
          autoComplete="nickname"
          maxLength={DJ_CHAT_NICKNAME_MAX_LENGTH}
          // 16px on phones: ios zooms the page into anything smaller
          className="mt-4 w-full rounded-full border border-den-ink bg-den-bg px-4 py-2 text-base text-den-ink placeholder:text-den-faint focus:border-den-accent focus:outline-none sm:text-sm"
        />

        <fieldset className="mt-5">
          <legend className="font-den-mono text-[11px] uppercase">Who you&apos;ll be</legend>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {ALL_CHARACTERS.map((avatar) => (
              <LookTile
                key={avatar}
                avatar={avatar}
                photoId={null}
                label={characterFor(avatar).label}
                selected={pickedAvatar === avatar}
                takenBy={taken.get(avatar) ?? null}
                onPick={() => setLook({ avatar })}
              />
            ))}
            {photoId !== null && (
              <LookTile avatar={0} photoId={photoId} label="your pic" selected={pickedPhoto} takenBy={null} onPick={() => setLook({ photoId })} />
            )}
            <UploadTile uploading={uploading} onFile={upload} />
          </div>
          <p className="mt-2 font-den-mono text-[11px] text-den-muted">
            {look === null ? "pick nobody and you'll get whoever's free." : "tap another to switch."}
          </p>
          {uploadError && <p className="mt-1 font-den-mono text-[11px] text-den-accent-soft">{uploadError}</p>}
        </fieldset>

        {problem && <p className="mt-4 font-den-mono text-[11px] text-den-accent-soft">{problem}</p>}
        <div className="mt-5 flex items-center justify-end gap-4">
          {onCancel && (
            <button type="button" onClick={onCancel} className="font-den-mono text-[11px] uppercase text-den-muted hover:text-den-accent-soft">
              cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!name.trim() || uploading}
            className="rounded-full bg-den-ink px-6 py-2.5 text-sm font-semibold text-den-bg transition hover:bg-den-accent disabled:opacity-40"
          >
            {onCancel ? "Save" : "Come in →"}
          </button>
        </div>
      </div>
    </form>
  );
}
