"use client";

import { djSetTrack, LIVE_TRACK } from "@/app/opium-den/djApi";
import { useDjStream } from "@/lib/useDjStream";
import { useDenPlayer } from "./DenPlayerProvider";
import LiveHero from "./LiveHero";
import SetList from "./SetList";

/**
 * the opium den's dj booth, laid out like a streaming app: the way into the live room up
 * top, and every past set as a track list below. it plays through the den's shared player
 * (DenPlayerProvider), so starting a set stops the stream and vice versa, and the
 * now-playing bar comes from the layout. see website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the booth.
 */
export default function DjBooth() {
  const { status, sets, error } = useDjStream();
  const player = useDenPlayer();
  const liveIsCurrent = player.track?.id === LIVE_TRACK.id;

  return (
    <div className="mt-14">
      <LiveHero
        status={status}
        error={error}
        playing={liveIsCurrent && player.playing}
        loading={liveIsCurrent && player.loading}
        onToggle={() => player.toggle(LIVE_TRACK)}
      />
      {sets && (
        <SetList
          sets={sets}
          currentId={player.track?.id ?? null}
          playing={player.playing}
          loading={player.loading}
          onToggle={(set) => player.toggle(djSetTrack(set))}
        />
      )}
    </div>
  );
}
