"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { formatDate, formatDuration, plural } from "@/app/admin/format";
import {
  djSetImageUrl,
  djSetThumbUrl,
  djSetTitle,
  djSetTrack,
  LIVE_SECTION_PATH,
  type DjSet,
  type DjSetChatMessage,
} from "@/app/opium-den/djApi";
import type { AudioPlayer, PlayerTrack } from "@/lib/useAudioPlayer";
import { useChatNickname } from "@/lib/useDjChat";
import { useDjSetReplay } from "@/lib/useDjSetReplay";
import { useStickToBottom } from "@/lib/useStickToBottom";
import ChatLine from "./ChatLine";
import CoverViewer from "./CoverViewer";
import { useCoverPlayerBar, useDenPlayer } from "./DenPlayerProvider";
import EqBars from "./EqBars";
import { SkipButton, VolumeControl } from "./PlayerControls";
import SetArt from "./SetArt";
import { PauseIcon, PlayIcon, SpinnerIcon } from "./playerIcons";
import Waveform from "./Waveform";

const SET_ID_PATTERN = /^\d+$/;

/**
 * the set id from the page's ?id=, if it's a real one.
 *
 * @param {string | null} raw - the query value.
 * @returns {number | null} the id, or null.
 */
function parseSetId(raw: string | null): number | null {
  return raw && SET_ID_PATTERN.test(raw) ? Number(raw) : null;
}

/**
 * the round signal-red play button for this set.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the den's shared player.
 * @param {PlayerTrack} props.track - this set as a track.
 * @returns {JSX.Element} the button.
 */
function SetPlayButton({ player, track }: { player: AudioPlayer; track: PlayerTrack }) {
  const current = player.track?.id === track.id;
  const playing = current && player.playing;
  return (
    <button
      type="button"
      onClick={() => player.toggle(track)}
      aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-den-accent text-white transition hover:scale-105 hover:brightness-110 active:scale-95 sm:h-14 sm:w-14"
    >
      {current && player.loading ? (
        <SpinnerIcon className="h-6 w-6" />
      ) : playing ? (
        <PauseIcon className="h-6 w-6" />
      ) : (
        <PlayIcon className="h-6 w-6" />
      )}
    </button>
  );
}

/**
 * the set's cover in the header, with the bouncing bars while it plays. when the set has
 * an uploaded image, tapping it opens it full screen.
 *
 * @param {object} props
 * @param {DjSet} props.set - the set.
 * @param {boolean} props.playing - it's what's playing.
 * @param {boolean} props.loading - and it's buffering.
 * @returns {JSX.Element} the cover.
 */
function SetCover({ set, playing, loading }: { set: DjSet; playing: boolean; loading: boolean }) {
  const [viewing, setViewing] = useState(false);
  const close = useCallback(() => setViewing(false), []);
  const thumb = djSetThumbUrl(set);
  const art = <SetArt src={thumb} className="h-12 w-12 sm:h-14 sm:w-14" />;
  const bars = playing && <EqBars active={!loading} className="absolute bottom-1 right-1 h-2.5 w-2.5 text-den-accent" />;

  if (set.image_id == null) {
    return (
      <div className="relative shrink-0">
        {art}
        {bars}
      </div>
    );
  }

  const title = djSetTitle(set);
  return (
    <>
      <button
        type="button"
        onClick={() => setViewing(true)}
        aria-label={`Show the cover for ${title} full screen`}
        className="relative shrink-0 cursor-zoom-in transition hover:brightness-110"
      >
        {art}
        {bars}
      </button>
      {viewing && <CoverViewer src={djSetImageUrl(set.id, set.image_id)} alt={`cover for ${title}`} onClose={close} />}
    </>
  );
}

/**
 * the header line under the title, like "Nov 18, 8:55 PM · 1:12:40 · 23 messages".
 *
 * @param {DjSet} set - the set.
 * @param {DjSetChatMessage[] | null} messages - its chat, null while it loads.
 * @returns {string} the line.
 */
function setMeta(set: DjSet, messages: DjSetChatMessage[] | null): string {
  const parts = [formatDate(set.started_at), formatDuration(set.duration_s)];
  if (messages) parts.push(plural(messages.length, "message"));
  return parts.join(" · ");
}

/**
 * what the replay's chat says when there's nothing to show yet.
 *
 * @param {object} props
 * @param {DjSetChatMessage[]} props.messages - the set's whole chat.
 * @param {boolean} props.started - this set's loaded in the player.
 * @returns {JSX.Element} the note.
 */
function ReplayEmptyNote({ messages, started }: { messages: DjSetChatMessage[]; started: boolean }) {
  if (messages.length === 0) {
    return <li className="font-den-mono text-xs text-den-muted">nobody chatted during this one.</li>;
  }
  const first = formatDuration(messages[0].offset_s);
  return (
    <li className="font-den-mono text-xs text-den-muted">
      {started
        ? `the first message comes in at ${first}.`
        : `the chat replays along with the set, the first message comes in at ${first}. press play, or tap a tick under the waveform.`}
    </li>
  );
}

/**
 * the set's chat, replayed: only the messages up to where playback is, so it fills in as
 * the set plays and empties back out when you skip back, like being there live. each
 * line's timestamp jumps to that moment.
 *
 * @param {object} props
 * @param {DjSetChatMessage[] | null} props.messages - the set's chat, null while it loads.
 * @param {number} props.positionS - where playback is.
 * @param {boolean} props.started - this set's loaded in the player.
 * @param {(seconds: number) => void} props.onSeek - jumps there and plays.
 * @returns {JSX.Element} the panel.
 */
function ReplayChat({
  messages,
  positionS,
  started,
  onSeek,
}: {
  messages: DjSetChatMessage[] | null;
  positionS: number;
  started: boolean;
  onSeek: (seconds: number) => void;
}) {
  const [nickname] = useChatNickname();
  const visible = messages?.filter((message) => message.offset_s <= positionS) ?? [];
  const [listRef, onListScroll] = useStickToBottom<HTMLOListElement>(visible.at(-1)?.id);

  return (
    <section className="flex h-full min-h-0 flex-col border border-den-ink bg-den-raised">
      <header className="flex items-baseline justify-between border-b border-den-line px-4 py-2.5 font-den-mono text-[11px] uppercase">
        <h2 className="font-medium">Chat replay</h2>
        {messages && messages.length > 0 && (
          <span className="tabular-nums text-den-muted">
            {visible.length} of {messages.length}
          </span>
        )}
      </header>

      <ol
        ref={listRef}
        onScroll={onListScroll}
        aria-label="Chat from this set"
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-4 py-3"
      >
        {visible.map((message) => (
          <ChatLine
            key={message.id}
            message={message}
            own={message.nickname === nickname}
            hint={formatDate(message.created_at)}
            lead={
              <button
                type="button"
                onClick={() => onSeek(message.offset_s)}
                aria-label={`Jump to ${formatDuration(message.offset_s)}`}
                className="mr-2 font-den-mono text-[11px] tabular-nums text-den-muted transition-colors hover:text-den-accent-soft"
              >
                {formatDuration(message.offset_s)}
              </button>
            }
          />
        ))}
        {messages === null && <li className="font-den-mono text-xs text-den-muted">loading the chat...</li>}
        {messages && visible.length === 0 && <ReplayEmptyNote messages={messages} started={started} />}
      </ol>
    </section>
  );
}

/**
 * one recorded set, replayed with its chat: the set's full view. a header with its cover
 * (tap for full screen), the play button and, once it's loaded, skips and volume; the
 * set's waveform on chart paper as its seek bar (chat messages as ticks under it); and the chat filling
 * the rest of the screen, showing only what had been said by that point in the set. one
 * screen tall like the live room. while this set's the one loaded, the player bar steps
 * aside, since this page has its controls; anything else playing keeps the bar. the set
 * is picked by ?id=. see website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the replay.
 */
export default function SetReplay() {
  const setId = parseSetId(useSearchParams().get("id"));
  const { set, messages, peaks, error, waveformError } = useDjSetReplay(setId);
  const player = useDenPlayer();

  const track = set ? djSetTrack(set) : null;
  useCoverPlayerBar(track?.id ?? null);
  const current = track !== null && player.track?.id === track.id;
  const positionS = current ? player.currentTimeS : 0;
  const seek = (seconds: number) => {
    if (track) player.play(track, seconds);
  };

  const problem = setId === null ? "that link doesn't point at a set." : error;

  return (
    <main className="mx-auto flex h-[calc(100dvh-var(--den-bar-clearance,0px))] w-full max-w-4xl flex-col px-4 pb-4 sm:px-8 sm:pb-6">
      {/* the home button's row: it sits fixed top-left, so this just leaves it room */}
      <div className="flex h-20 shrink-0 items-center justify-end sm:h-24">
        <Link href={LIVE_SECTION_PATH} className="font-den-mono text-[11px] uppercase transition-colors hover:text-den-accent-soft">
          &larr; All sets
        </Link>
      </div>

      {problem && (
        <p className="border border-den-ink bg-den-raised p-4 text-sm text-den-muted">
          {problem}{" "}
          <Link href={LIVE_SECTION_PATH} className="border-b border-den-accent text-den-ink hover:text-den-accent-soft">
            all the past sets
          </Link>{" "}
          are in the live section.
        </p>
      )}
      {!problem && !set && <p className="font-den-mono text-xs text-den-muted">loading the set...</p>}

      {set && track && (
        <>
          <header className="flex shrink-0 items-center gap-3 sm:gap-4">
            <SetCover set={set} playing={current && player.playing} loading={player.loading} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold tracking-[-0.04em] sm:text-3xl">{djSetTitle(set)}</h1>
              <p className="mt-1 truncate font-den-mono text-[11px] uppercase text-den-muted">{setMeta(set, messages)}</p>
            </div>
            {current && <VolumeControl player={player} className="hidden md:flex" />}
            <div className="flex shrink-0 items-center gap-1 sm:gap-3">
              {current && <SkipButton player={player} direction="back" className="p-1" />}
              <SetPlayButton player={player} track={track} />
              {current && <SkipButton player={player} direction="forward" className="p-1" />}
            </div>
          </header>

          {set.description && (
            <details className="group mt-2 shrink-0">
              <summary className="inline-flex cursor-pointer list-none font-den-mono text-[11px] text-den-muted transition-colors hover:text-den-accent-soft [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">about this set</span>
                <span className="hidden group-open:inline">less</span>
              </summary>
              <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-den-muted">
                {set.description}
              </p>
            </details>
          )}

          {/* the waveform on chart paper, like the trace it is */}
          <div className="den-grid mt-4 shrink-0 border border-den-ink px-3 pt-3">
            <Waveform
              peaks={peaks}
              loading={peaks === null && waveformError === null}
              durationS={set.duration_s}
              positionS={positionS}
              messages={messages ?? []}
              onSeek={seek}
            />
            {waveformError && <p className="pb-2 font-den-mono text-[11px] text-den-muted">{waveformError}</p>}
            {current && player.error && <p className="pb-2 font-den-mono text-[11px] text-den-accent-soft">{player.error}</p>}
          </div>

          <div className="mt-3 min-h-0 flex-1">
            <ReplayChat messages={messages} positionS={positionS} started={current} onSeek={seek} />
          </div>
        </>
      )}
    </main>
  );
}
