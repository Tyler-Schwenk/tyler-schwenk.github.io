"use client";

import { formatDate } from "@/app/admin/format";
import { DJ_LIVE_URL, djSetAudioUrl, djSetTitle, djSetTrackId, type DjSet } from "@/app/opium-den/djApi";
import { useAudioPlayer, type PlayerTrack } from "@/lib/useAudioPlayer";
import { useDjStream } from "@/lib/useDjStream";
import LiveHero from "./LiveHero";
import PlayerBar from "./PlayerBar";
import SetList from "./SetList";

const LIVE_TRACK: PlayerTrack = {
  id: "live",
  title: "Live from the den",
  subtitle: "live now",
  src: DJ_LIVE_URL,
  live: true,
};

/**
 * a recorded set as something the player can play.
 *
 * @param {DjSet} set - the set.
 * @returns {PlayerTrack} the track.
 */
function setToTrack(set: DjSet): PlayerTrack {
  return {
    id: djSetTrackId(set.id),
    title: djSetTitle(set),
    subtitle: set.title ? formatDate(set.started_at) : "untitled set",
    src: djSetAudioUrl(set.id),
    live: false,
  };
}

/**
 * the opium den's dj booth, laid out like a streaming app: the live stream up top when
 * i'm on the decks, every past set as a track list below, and a now-playing bar pinned
 * to the bottom once something's playing. one shared player, so starting a set stops the
 * stream and vice versa. see website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the booth.
 */
export default function DjBooth() {
  const { status, sets, error } = useDjStream();
  const player = useAudioPlayer();
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
          onToggle={(set) => player.toggle(setToTrack(set))}
        />
      )}
      <PlayerBar player={player} />
    </div>
  );
}
