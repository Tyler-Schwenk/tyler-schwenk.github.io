"use client";

import type { ReactNode } from "react";
import { djLiveTrack, djSetTrack, LIVE_TRACK_ID, type DjSet } from "@/app/opium-den/djApi";
import { useDjSetTraces, type DjSetTrace } from "@/lib/useDjSetTraces";
import { useDjStream } from "@/lib/useDjStream";
import AlertSignup from "./AlertSignup";
import { useDenPlayer } from "./DenPlayerProvider";
import LiveHero from "./LiveHero";
import SetList from "./SetList";

const S_PER_H = 3600;

/**
 * the stat cells by the title: how many sets, how many hours, how many chat messages.
 * the messages count waits until every set's chat is in, so it doesn't count up.
 *
 * @param {object} props
 * @param {DjSet[] | null} props.sets - the sets, null before they load.
 * @param {Record<number, DjSetTrace>} props.traces - their chat, by set id.
 * @returns {JSX.Element} the cells.
 */
function Stats({ sets, traces }: { sets: DjSet[] | null; traces: Record<number, DjSetTrace> }) {
  const hours = sets ? (sets.reduce((sum, set) => sum + set.duration_s, 0) / S_PER_H).toFixed(1) : null;
  const chats = sets?.map((set) => traces[set.id]?.messages);
  const messages = chats?.every(Boolean) ? chats.reduce((sum, chat) => sum + (chat?.length ?? 0), 0) : null;
  const cells: [string, string | number | null][] = [
    ["sets", sets?.length ?? null],
    ["hours", hours],
    ["chat msgs", messages],
  ];
  return (
    <dl className="grid grid-cols-3 border-l border-t border-den-line border-t-den-ink">
      {cells.map(([label, value]) => (
        <div key={label} className="border-b border-r border-den-line px-3.5 py-3">
          <dd className="text-3xl font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[2.5rem]">{value ?? "–"}</dd>
          <dt className="mt-1.5 font-den-mono text-[11px] uppercase text-den-muted">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

/**
 * the live section's booth, laid out like a seismograph: the page's intro next to the
 * section's stats, the live monitor (the way into the live room) with the live alerts
 * signup under it, and every past set drawn to scale below. it plays through the site's
 * shared player (DenPlayerProvider), so starting a set stops the stream and vice versa,
 * and the player bar follows you around the site. see website/docs/OPIUM_DEN.md.
 *
 * @param {object} props
 * @param {ReactNode} props.intro - the page's title and blurb, rendered on the server.
 * @returns {JSX.Element} the booth.
 */
export default function DjBooth({ intro }: { intro: ReactNode }) {
  const { status, sets, error } = useDjStream();
  const traces = useDjSetTraces(sets);
  const player = useDenPlayer();
  const liveIsCurrent = player.track?.id === LIVE_TRACK_ID;

  return (
    <>
      <div className="mb-9 mt-10 grid items-end gap-7 sm:mt-12 md:grid-cols-[minmax(0,1fr)_26rem] md:gap-10">
        <div>{intro}</div>
        <Stats sets={sets} traces={traces} />
      </div>

      <LiveHero
        status={status}
        error={error}
        playing={liveIsCurrent && player.playing}
        loading={liveIsCurrent && player.loading}
        onToggle={() => player.toggle(djLiveTrack(status))}
      />
      <AlertSignup className="mt-3" />

      {sets && (
        <SetList
          sets={sets}
          traces={traces}
          currentId={player.track?.id ?? null}
          playing={player.playing}
          loading={player.loading}
          positionS={player.currentTimeS}
          onToggle={(set) => player.toggle(djSetTrack(set))}
          onSeek={(set, seconds) => player.play(djSetTrack(set), seconds)}
        />
      )}
    </>
  );
}
