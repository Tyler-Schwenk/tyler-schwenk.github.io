"use client";

import type { ReactNode } from "react";
import { djLiveTrack, djSetTrack, LIVE_TRACK_ID } from "@/app/opium-den/djApi";
import { useDjSetTraces } from "@/lib/useDjSetTraces";
import { useDjStream } from "@/lib/useDjStream";
import AlertSignup from "./AlertSignup";
import { useDenPlayer } from "./DenPlayerProvider";
import LiveHero from "./LiveHero";
import SetList from "./SetList";

/**
 * the live section's booth: the page's intro, the live monitor (the way into the live
 * room), and every past set below with the section's stats. off air the monitor itself
 * asks people to sign up for live alerts; while live, the small signup link sits under it.
 * it plays through the site's shared player (DenPlayerProvider), so starting a set stops
 * the stream and vice versa, and the player bar follows you around the site. see
 * website/docs/OPIUM_DEN.md.
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
      <div className="mb-9 mt-10 sm:mt-12">{intro}</div>

      <LiveHero
        status={status}
        error={error}
        playing={liveIsCurrent && player.playing}
        loading={liveIsCurrent && player.loading}
        onToggle={() => player.toggle(djLiveTrack(status))}
      />
      {status?.live && <AlertSignup className="mt-3" />}

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
