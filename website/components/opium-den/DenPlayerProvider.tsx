"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAudioPlayer, type AudioPlayer } from "@/lib/useAudioPlayer";
import PlayerBar from "./PlayerBar";

/**
 * the player, which track's full view is on screen (the bar steps aside for it), and
 * whether there's an earlier page on the site to go back to.
 */
type DenPlayerContextValue = {
  player: AudioPlayer;
  setCoveredTrackId: (trackId: string | null) => void;
  hasEarlierPage: () => boolean;
};

const DenPlayerContext = createContext<DenPlayerContextValue | null>(null);

// pages with no room for the bar: the kiosk screens, and the admin page's own bottom nav
const BAR_HIDDEN_PATH_PREFIXES = ["/display", "/admin"];

/**
 * the opium den's one audio player, for the whole site. it lives in the root layout, so
 * a set or the stream keeps playing wherever you go. renders the minimized player (the
 * bar along the bottom) whenever something's loaded, except while that track's own full
 * view is open (its set page, or the live room), which has the controls already.
 *
 * @param {object} props
 * @param {ReactNode} props.children - the site.
 * @returns {JSX.Element} the site with the player available, plus the bar.
 */
export default function DenPlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer();
  const [coveredTrackId, setCoveredTrackId] = useState<string | null>(null);
  const pathname = usePathname() ?? "";
  const hiddenHere = BAR_HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const covered = player.track !== null && player.track.id === coveredTrackId;

  // once the path's changed at least once, going back stays on the site
  const firstPathRef = useRef(pathname);
  const navigatedRef = useRef(false);
  useEffect(() => {
    if (pathname !== firstPathRef.current) navigatedRef.current = true;
  }, [pathname]);
  const hasEarlierPage = useCallback(() => navigatedRef.current, []);

  return (
    <DenPlayerContext.Provider value={{ player, setCoveredTrackId, hasEarlierPage }}>
      {children}
      {!hiddenHere && !covered && <PlayerBar player={player} />}
    </DenPlayerContext.Provider>
  );
}

/**
 * the context, or a clear error when DenPlayerProvider's missing.
 *
 * @returns {DenPlayerContextValue} the context.
 * @throws {Error} when used outside the root layout's provider.
 */
function useDenPlayerContext(): DenPlayerContextValue {
  const context = useContext(DenPlayerContext);
  if (!context) throw new Error("useDenPlayer needs DenPlayerProvider -- it's set up in app/layout.tsx");
  return context;
}

/**
 * the site's shared player.
 *
 * @returns {AudioPlayer} the player.
 */
export function useDenPlayer(): AudioPlayer {
  return useDenPlayerContext().player;
}

/**
 * for a track's full view (a set page, the live room): hides the player bar while this
 * page is up and that track's the one loaded, since the page has its own controls.
 *
 * @param {string | null} trackId - the track this page is the full view of, null while it's unknown.
 *
 * Side effects: sets and clears the provider's covered track as the page mounts and unmounts.
 */
export function useCoverPlayerBar(trackId: string | null): void {
  const { setCoveredTrackId } = useDenPlayerContext();
  useEffect(() => {
    setCoveredTrackId(trackId);
    return () => setCoveredTrackId(null);
  }, [trackId, setCoveredTrackId]);
}

/**
 * for a track's full view: shrinks it back to the player bar. goes back to whatever page
 * you were on (scroll and all) when there is one on the site, or to the fallback when the
 * full view's the first page you landed on. the audio keeps playing either way.
 *
 * @param {string} fallbackPath - where to go when there's no earlier page on the site.
 * @returns {() => void} minimizes the full view.
 *
 * Side effects: navigates.
 */
export function useMinimizePlayer(fallbackPath: string): () => void {
  const { hasEarlierPage } = useDenPlayerContext();
  const router = useRouter();
  return useCallback(() => {
    if (hasEarlierPage()) router.back();
    else router.push(fallbackPath);
  }, [hasEarlierPage, router, fallbackPath]);
}
