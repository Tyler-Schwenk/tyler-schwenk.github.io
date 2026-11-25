"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  adminRequest,
  AdminFetchContext,
  createAdminFetch,
  errorMessage,
  jsonBody,
  useAdminData,
  useAdminFetch,
} from "@/app/admin/adminApi";
import { GuestAlertsPanel } from "@/app/admin/DjAlertsPanel";
import { DjSetList, OnAirCard, useDjSets } from "@/app/admin/DjSetsTab";
import LoginScreen from "@/app/admin/LoginScreen";
import { Button, Card, DropZone, Field, FlashMessage, INPUT_CLASS, Muted, useFlash } from "@/app/admin/ui";
import {
  DJ_GUEST_BIO_MAX_LENGTH,
  DJ_GUEST_NAME_MAX_LENGTH,
  DJ_GUESTS_PATH,
  djGuestPhotoUrl,
  fetchDjStatus,
  LIVE_ROOM_PATH,
  LIVE_SECTION_PATH,
  type DjGuestMe,
  type DjStreamStatus,
} from "@/app/opium-den/djApi";
import { usePoll } from "@/lib/usePoll";
import { useAdminAuth } from "@/lib/useAdminAuth";

/**
 * The guest dj page (/guest-dj): where a guest dj logs in (their login from
 * scripts/create_dj_guest.py), sees whether they're on air, sends a live alert while they
 * are, and edits their profile (name, bio, photo) and their own sets. Built from the
 * admin page's DJ tab pieces, which send this page's login instead of the admin's. See
 * website/docs/ADMIN.md and pi/docs/services/dj-stream.md.
 */

// its own key, so a guest login and the admin login on one browser don't trip over each other
const GUEST_TOKEN_STORAGE_KEY = "djGuestToken";
const GUEST_LOGIN_PATH = `${DJ_GUESTS_PATH}/login`;
const ME_PATH = `${DJ_GUESTS_PATH}/me`;
const PHOTO_PATH = `${ME_PATH}/photo`;
// often enough to spot going on air without sitting on refresh
const STATUS_POLL_INTERVAL_MS = 10000;

/**
 * Where things stand: you're on, someone else is on, or nobody is.
 * @param props.status - Latest status, null before the first answer.
 * @param props.me - The guest.
 */
function StatusCard({ status, me }: { status: DjStreamStatus | null; me: DjGuestMe }) {
  if (!status) return <Muted>Checking whether anyone&apos;s on air...</Muted>;

  if (status.live && status.dj?.id === me.id) {
    return (
      <Card className="mb-4 border-orange-500/50 p-3 text-sm">
        <p className="font-semibold text-orange-400">You&apos;re on air.</p>
        <p className="mt-1 text-slate-400">
          It&apos;s recording, and people can listen in the{" "}
          <Link href={LIVE_ROOM_PATH} className="text-slate-200 underline">
            live room
          </Link>
          . Give it a cover and send an alert below.
        </p>
      </Card>
    );
  }

  if (status.live) {
    const who = status.dj?.name ?? "Tyler";
    return (
      <Card className="mb-4 p-3 text-sm">
        <p className="font-semibold text-slate-100">{who}&apos;s on air right now.</p>
        <p className="mt-1 text-slate-400">
          One dj at a time. butt can&apos;t connect until they stop, and it keeps trying, so you go on as soon as they&apos;re done.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-4 p-3 text-sm">
      <p className="font-semibold text-slate-100">Off air.</p>
      <p className="mt-1 text-slate-400">
        Play something and butt goes live on its own; this page shows it within a few seconds. Your mountpoint is{" "}
        <code className="text-slate-200">{me.mount}</code>.
      </p>
    </Card>
  );
}

/**
 * The guest's photo: a preview, a picker to add or replace it, and remove. It stands in
 * for a cover on their sets without one.
 * @param props.me - The guest's profile.
 * @param props.onChange - Called with the profile after an upload or removal.
 */
function ProfilePhoto({ me, onChange }: { me: DjGuestMe; onChange: (me: DjGuestMe) => void }) {
  const adminFetch = useAdminFetch();
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash();

  const send = async (failure: string, init: RequestInit) => {
    setBusy(true);
    try {
      const updated = await adminRequest<DjGuestMe>(adminFetch, PHOTO_PATH, failure, init);
      if (updated) onChange(updated);
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
    setBusy(false);
  };

  const upload = (files: File[]) => {
    if (files.length === 0) return;
    const body = new FormData();
    body.append("file", files[0]);
    send("couldn't upload your photo", { method: "PUT", body });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {me.photo_id === null ? (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-500">
            No photo
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={djGuestPhotoUrl(me.id, me.photo_id, true)} alt="Your photo" className="h-20 w-20 shrink-0 rounded-full object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <DropZone
            label={busy ? "Working..." : me.photo_id === null ? "Add a photo" : "Replace your photo"}
            hint="Shows on your sets that don't have a cover"
            accept="image/*"
            onFiles={upload}
            disabled={busy}
          />
        </div>
      </div>
      {me.photo_id !== null && (
        <Button
          size="sm"
          variant="danger"
          className="self-start"
          onClick={() => send("couldn't remove your photo", { method: "DELETE" })}
          disabled={busy}
        >
          Remove photo
        </Button>
      )}
      <FlashMessage flash={flash} />
    </div>
  );
}

/**
 * The guest's profile: the name the site calls them, the bit about them (it shows on
 * their sets' pages), and their photo.
 * @param props.me - Their profile.
 * @param props.onChange - Called with the profile once a change is saved.
 */
function ProfileCard({ me, onChange }: { me: DjGuestMe; onChange: (me: DjGuestMe) => void }) {
  const adminFetch = useAdminFetch();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [flash, showFlash] = useFlash();
  const changed = name.trim() !== me.name || bio.trim() !== (me.bio ?? "");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!changed || !name.trim()) return;
    setSaving(true);
    try {
      const updated = await adminRequest<DjGuestMe>(
        adminFetch,
        ME_PATH,
        "couldn't save your profile",
        jsonBody("PATCH", { name: name.trim(), bio: bio.trim() })
      );
      if (updated) {
        onChange(updated);
        showFlash("success", "Saved.");
      }
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
    setSaving(false);
  };

  return (
    <Card className="mb-4 flex flex-col gap-3 p-3">
      <h2 className="text-sm font-semibold text-slate-100">Your profile</h2>
      <ProfilePhoto me={me} onChange={onChange} />
      <form onSubmit={save} className="flex flex-col gap-3">
        <Field label="DJ name" htmlFor="guest-name">
          <input
            id="guest-name"
            className={INPUT_CLASS}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={DJ_GUEST_NAME_MAX_LENGTH}
          />
        </Field>
        <Field label="About you" htmlFor="guest-bio">
          <textarea
            id="guest-bio"
            className={`${INPUT_CLASS} min-h-24 resize-y`}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Shows on your sets' pages, under the description."
            maxLength={DJ_GUEST_BIO_MAX_LENGTH}
          />
        </Field>
        <Button type="submit" size="sm" variant="primary" className="self-end" disabled={!changed || !name.trim() || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </form>
      <FlashMessage flash={flash} />
    </Card>
  );
}

/**
 * Everything once they're logged in.
 * @param props.onLogout - Logs out.
 */
function GuestBooth({ onLogout }: { onLogout: () => void }) {
  const profile = useAdminData<DjGuestMe>(ME_PATH, "couldn't load your profile");
  const sets = useDjSets();
  const { data: status } = usePoll(fetchDjStatus, STATUS_POLL_INTERVAL_MS);
  const me = profile.data;
  const onAir = Boolean(me && status?.live && status.dj?.id === me.id);

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link href={LIVE_SECTION_PATH} className="font-bold text-white">
            Guest DJ
          </Link>
          {me && <span className="truncate text-sm text-slate-400">{me.name}</span>}
          <Button size="sm" variant="quiet" className="ml-auto" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-12 pt-5 md:pt-8">
        {!me && <Muted>{profile.error ?? "Loading your profile..."}</Muted>}
        {me && (
          <>
            <StatusCard status={status} me={me} />
            <OnAirCard guestId={me.id} />
            <GuestAlertsPanel name={me.name} onAir={onAir} onLabelledSet={sets.reload} />
            <ProfileCard me={me} onChange={(updated) => profile.setData(() => updated)} />
            <h2 className="mb-2 text-sm font-semibold text-slate-100">Your sets</h2>
            <DjSetList sets={sets} guestId={me.id} />
          </>
        )}
      </main>
    </div>
  );
}

/**
 * The guest dj page: the login, then their booth.
 */
export default function GuestDjPage() {
  const { token, ready, login, logout } = useAdminAuth(GUEST_TOKEN_STORAGE_KEY, GUEST_LOGIN_PATH);
  const adminFetch = useMemo(() => (token ? createAdminFetch(token, logout) : null), [token, logout]);

  if (!ready) return <div className="min-h-dvh bg-slate-950" />;
  if (!adminFetch) {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100">
        <LoginScreen login={login} title="Guest DJ" usernameLabel="Username" />
      </div>
    );
  }

  return (
    <AdminFetchContext.Provider value={adminFetch}>
      <GuestBooth onLogout={logout} />
    </AdminFetchContext.Provider>
  );
}
