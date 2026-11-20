"use client";

import { djLiveTrack, djSetTrack, LIVE_TRACK_ID } from "@/app/opium-den/djApi";
import { useDjStream } from "@/lib/useDjStream";
import AlertSignup from "./AlertSignup";
import { useDenPlayer } from "./DenPlayerProvider";
import LiveHero from "./LiveHero";
import SetList from "./SetList";

/**
 * the live section's booth, laid out like a streaming app: the way into the live room up
 * top with the live alerts signup under it, and every past set as a track list below. it
 * plays through the site's shared player (DenPlayerProvider), so starting a set stops the
 * stream and vice versa, and the player bar follows you around the site. see
 * website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the booth.
 */
export default function DjBooth() {
  const { status, sets, error } = useDjStream();
  const player = useDenPlayer();
  const liveIsCurrent = player.track?.id === LIVE_TRACK_ID;

  return (
    <div className="mt-10">
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
          currentId={player.track?.id ?? null}
          playing={player.playing}
          loading={player.loading}
          onToggle={(set) => player.toggle(djSetTrack(set))}
        />
      )}
    </div>
  );
}
