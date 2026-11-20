import Link from "next/link";
import DjBooth from "@/components/opium-den/DjBooth";
import { DEFAULT_PREVIEW_IMAGE, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Live from the den",
  description: "Tyler's DJ sets from the Opium Den: live when he's on the decks, and every past set with its chat",
  path: "/opium-den/live",
  image: DEFAULT_PREVIEW_IMAGE,
});

/**
 * the live section: everything dj. the live room's way in (with alerts), and every
 * recorded set, each opening out to its waveform and chat. the frame and look come from
 * app/opium-den/layout.tsx, the player from the root layout. see website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the live section's page.
 */
export default function LiveSectionPage() {
  return (
    <main>
      <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-24 sm:pt-28">
        <header>
          <Link href="/opium-den" className="text-sm text-den-accent-soft transition-colors hover:text-den-ink">
            &larr; Opium Den
          </Link>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Live from the den</h1>
          <p className="mt-4 max-w-xl leading-relaxed text-den-muted">
            Whenever I&apos;m practicing on the decks it streams here live, with a chat to hang out in. Every session gets
            recorded, so they&apos;re all below to listen back to, chat and all.
          </p>
        </header>

        <DjBooth />

        <footer className="mt-16 border-t border-den-line pt-6">
          <Link href="/opium-den" className="text-sm text-den-faint transition-colors hover:text-den-accent-soft">
            Back to the den
          </Link>
        </footer>
      </div>
    </main>
  );
}
