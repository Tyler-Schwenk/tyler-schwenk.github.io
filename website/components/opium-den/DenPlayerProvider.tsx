"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { LIVE_ROOM_PATH, LIVE_TRACK } from "@/app/opium-den/djApi";
import { useAudioPlayer, type AudioPlayer } from "@/lib/useAudioPlayer";
import PlayerBar from "./PlayerBar";

const DenPlayerContext = createContext<AudioPlayer | null>(null);

/**
 * the opium den's one audio player, shared by every page under /opium-den. it lives in
 * the section's layout, so music keeps playing when you hop between the den and the live
 * room. renders the now-playing bar too, except in the live room while the stream's what's
 * playing, since the room's own controls already cover it.
 *
 * @param {object} props
 * @param {ReactNode} props.children - the den's pages.
 * @returns {JSX.Element} the pages with the player available, plus the bar.
 */
export default function DenPlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer();
  const pathname = usePathname() ?? "";
  const roomCoversIt = pathname.startsWith(LIVE_ROOM_PATH) && player.track?.id === LIVE_TRACK.id;

  return (
    <DenPlayerContext.Provider value={player}>
      {children}
      {!roomCoversIt && <PlayerBar player={player} />}
    </DenPlayerContext.Provider>
  );
}

/**
 * the shared den player, for anything under DenPlayerProvider.
 *
 * @returns {AudioPlayer} the player.
 * @throws {Error} when used outside the opium den's layout.
 */
export function useDenPlayer(): AudioPlayer {
  const player = useContext(DenPlayerContext);
  if (!player) throw new Error("useDenPlayer needs DenPlayerProvider -- it's set up in app/opium-den/layout.tsx");
  return player;
}
