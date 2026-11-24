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
 * the live section: everything dj. the live monitor (the live room's way in, with
 * alerts), and every recorded set drawn to scale, each opening out to its waveform and
 * chat. the frame and look come from app/opium-den/layout.tsx,
 * the player from the root layout. see website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the live section's page.
 */
export default function LiveSectionPage() {
  return (
    <main>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
        <div className="flex justify-between border-b border-den-ink pb-2.5 font-den-mono text-[11px] uppercase">
          <Link href="/opium-den" className="transition-colors hover:text-den-accent-soft">
            &larr; Opium Den
          </Link>
          <span className="hidden text-den-muted sm:inline">every set recorded, with its chat</span>
        </div>

        <DjBooth
          intro={
            <>
              <h1 className="text-[3.25rem] font-extrabold leading-[0.88] tracking-[-0.055em] sm:text-7xl lg:text-[6.5rem]">
                Live from
                <br />
                the den<span className="text-den-accent">.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-den-muted sm:text-[17px]">
                Whenever I&apos;m practicing on the decks it streams here live, with a chat to hang out in. Every session
                gets recorded, so they&apos;re all below to listen back to.
              </p>
            </>
          }
        />

        <footer className="mt-16 border-t border-den-ink pt-4">
          <Link href="/opium-den" className="font-den-mono text-[11px] uppercase text-den-muted transition-colors hover:text-den-accent-soft">
            Back to the den
          </Link>
        </footer>
      </div>
    </main>
  );
}
