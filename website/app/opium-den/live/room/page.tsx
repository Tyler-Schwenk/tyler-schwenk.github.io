import LiveRoom from "@/components/opium-den/LiveRoom";
import { DEFAULT_PREVIEW_IMAGE, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Live room",
  description: "Live DJ sets from the Opium Den, with a chat to hang out in while they play",
  path: "/opium-den/live/room",
  image: DEFAULT_PREVIEW_IMAGE,
});

/**
 * the opium den's live room: the stream and its chat, the live stream's full view. the
 * frame comes from app/opium-den/layout.tsx, the player from the root layout.
 *
 * @returns {JSX.Element} the live room page.
 */
export default function LiveRoomPage() {
  return <LiveRoom />;
}
