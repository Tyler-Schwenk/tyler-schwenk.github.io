"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  DJ_CHAT_NICKNAME_MAX_LENGTH,
  djLiveStartedMs,
  djLiveThumbUrl,
  djLiveTrack,
  fetchDjStatus,
  LIVE_SECTION_PATH,
  LIVE_TRACK_ID,
  type DjStreamStatus,
} from "@/app/opium-den/djApi";
import type { AudioPlayer } from "@/lib/useAudioPlayer";
import { useChatNickname, useDjChat } from "@/lib/useDjChat";
import { useDjRoom } from "@/lib/useDjRoom";
import { useNow } from "@/lib/useNow";
import { usePoll } from "@/lib/usePoll";
import { useCoverPlayerBar, useDenPlayer } from "./DenPlayerProvider";
import EqBars from "./EqBars";
import LiveChat from "./LiveChat";
import LiveStatus from "./LiveStatus";
import { LiveRoomStage } from "./LiveTrace";
import MinimizeButton from "./MinimizeButton";
import RoomPeople, { useLiveBubbles } from "./RoomPeople";
import SetArt from "./SetArt";
import { VolumeControl } from "./PlayerControls";
import { PauseIcon, PlayIcon, SpinnerIcon } from "./playerIcons";

// faster than the live section's poll: in here, the listener count and going off air should show quickly
const ROOM_STATUS_POLL_INTERVAL_MS = 5000;
// the stage's clock: the set's trace creeping along, and chat bubbles going after their 30 s
const STAGE_TICK_MS = 1000;

/**
 * the way in: everyone in the room has a name, shown over their character and next to
 * their messages, so you pick one before you're in. also where you land when the name
 * you had turns out to be someone else's.
 *
 * @param {object} props
 * @param {string} props.initial - the name to start from (a taken one, to edit), or "".
 * @param {string | null} props.problem - why the last name didn't work, if it didn't.
 * @param {(nickname: string) => void} props.onEnter - takes the name.
 * @returns {JSX.Element} the form.
 */
function RoomEntry({ initial, problem, onEnter }: { initial: string; problem: string | null; onEnter: (nickname: string) => void }) {
  const [draft, setDraft] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (name) onEnter(name);
  };
  return (
    <form
      onSubmit={submit}
      className="den-grid mt-3 flex min-h-0 flex-1 flex-col items-center justify-center border border-den-ink px-4 py-10 text-center sm:mt-4"
    >
      <label htmlFor="den-room-name" className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
        Who&apos;s coming in?
      </label>
      <p className="mt-2 max-w-sm text-balance text-sm text-den-muted">
        Pick a name. It goes over your little guy on the stage and next to everything you say in the chat.
      </p>
      <div className="mt-5 flex w-full max-w-sm gap-2">
        <input
          id="den-room-name"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="your name"
          autoComplete="nickname"
          maxLength={DJ_CHAT_NICKNAME_MAX_LENGTH}
          // 16px on phones: ios zooms the page into anything smaller
          className="min-w-0 flex-1 rounded-full border border-den-ink bg-den-bg px-4 py-2 text-base text-den-ink placeholder:text-den-faint focus:border-den-accent focus:outline-none sm:text-sm"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="shrink-0 rounded-full bg-den-ink px-5 py-2 text-sm font-semibold text-den-bg transition hover:bg-den-accent disabled:opacity-40"
        >
          Come in &rarr;
        </button>
      </div>
      {problem && <p className="mt-3 font-den-mono text-[11px] text-den-accent-soft">{problem}</p>}
    </form>
  );
}

/**
 * the round signal-red play button for the stream.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the site's shared player.
 * @param {DjStreamStatus | null} props.status - latest status, for the set's cover.
 * @returns {JSX.Element} the button.
 */
function StreamButton({ player, status }: { player: AudioPlayer; status: DjStreamStatus | null }) {
  const current = player.track?.id === LIVE_TRACK_ID;
  const playing = current && player.playing;
  const loading = current && player.loading;
  return (
    <button
      type="button"
      onClick={() => player.toggle(djLiveTrack(status))}
      aria-label={playing ? "Pause the live stream" : "Play the live stream"}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-den-accent text-white transition hover:scale-105 hover:brightness-110 active:scale-95 sm:h-14 sm:w-14"
    >
      {loading ? <SpinnerIcon className="h-6 w-6" /> : playing ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
    </button>
  );
}

/**
 * the opium den's live room, the live stream's full view, built around the people in it
 * and the chat: a compact header (the set's cover, "live room", how long it's been on and
 * who's listening, the play button, volume on desktop, a red edge while on air), then the
 * stage (the set's loudness trace, with a little dancing character for everyone in the
 * room standing along the bottom, name over their head and a bubble when they talk), and
 * the chat filling the rest of the screen with its box at the bottom. while live you pick
 * a name to come in (RoomEntry); after that this page keeps you in the room while it's
 * open (useDjRoom), and your stay's saved so the set's page can show you there later. the room is exactly one screen tall (less the player bar when a past set's
 * playing, via --den-bar-clearance), so on a phone the message box sits where your thumb
 * is. while the stream's what's playing, the player bar steps aside since this page has
 * the controls, and a minimize button shrinks it back to the bar. off air there's no
 * stage and no name to pick, just the last few hours of chat, still readable.
 * see website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the room.
 */
export default function LiveRoom() {
  const { data: status, error } = usePoll(fetchDjStatus, ROOM_STATUS_POLL_INTERVAL_MS);
  const player = useDenPlayer();
  useCoverPlayerBar(LIVE_TRACK_ID);
  const live = Boolean(status?.live);
  const liveLoaded = player.track?.id === LIVE_TRACK_ID;
  const streaming = live && liveLoaded && player.playing;
  const [nickname, setNickname] = useChatNickname();
  const chat = useDjChat();
  // the room's only open while the set's on, so off air nobody checks in
  const room = useDjRoom(live ? nickname : "");
  const nowMs = useNow(STAGE_TICK_MS, live);
  const bubbles = useLiveBubbles(chat.messages, nowMs);
  const startMs = djLiveStartedMs(status);
  const needsName = live && (!nickname || room.nameTaken !== null);

  return (
    <main className="mx-auto flex h-[calc(100dvh-var(--den-bar-clearance,0px))] w-full max-w-4xl flex-col px-4 pb-4 sm:px-8 sm:pb-6">
      {/* the home button's row: it sits fixed top-left, so this just leaves it room */}
      <div className="flex h-20 shrink-0 items-center justify-end gap-4 sm:h-24">
        <Link href={LIVE_SECTION_PATH} className="font-den-mono text-[11px] uppercase transition-colors hover:text-den-accent-soft">
          &larr; Live from the den
        </Link>
        {liveLoaded && <MinimizeButton fallbackPath={LIVE_SECTION_PATH} />}
      </div>

      <header
        className={`flex shrink-0 items-center gap-3 border bg-den-raised p-3 sm:gap-4 sm:p-4 ${
          live ? "border-den-ink shadow-[inset_3px_0_0_var(--color-den-accent)]" : "border-den-line"
        }`}
      >
        <div className="relative shrink-0">
          <SetArt src={djLiveThumbUrl(status)} dim={!live} className="h-12 w-12 sm:h-14 sm:w-14" />
          {streaming && <EqBars active={!player.loading} className="absolute bottom-1 right-1 h-2.5 w-2.5 text-den-accent" />}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-[-0.04em] sm:text-3xl">Live room</h1>
          <LiveStatus status={status} className="mt-1 text-[11px]" />
          {error && !status && <p className="mt-0.5 font-den-mono text-[11px] text-den-muted">{error}</p>}
        </div>
        {live && liveLoaded && <VolumeControl player={player} className="hidden md:flex" />}
        {live && <StreamButton player={player} status={status} />}
      </header>

      {needsName ? (
        // keyed so a taken name comes back into the box to edit
        <RoomEntry key={nickname} initial={nickname} problem={room.nameTaken} onEnter={setNickname} />
      ) : (
        <>
          {live && startMs !== null && (
            <div className="mt-3 shrink-0 border border-den-ink sm:mt-4">
              <LiveRoomStage startMs={startMs} nowMs={nowMs}>
                {room.people && <RoomPeople people={room.people} bubbles={bubbles} nickname={nickname} />}
              </LiveRoomStage>
            </div>
          )}
          {live && room.error && <p className="mt-1 font-den-mono text-[11px] text-den-muted">{room.error}</p>}
          <div className="mt-3 min-h-0 flex-1 sm:mt-4">
            <LiveChat live={live} chat={chat} nickname={nickname} onNickname={setNickname} />
          </div>
        </>
      )}
    </main>
  );
}
