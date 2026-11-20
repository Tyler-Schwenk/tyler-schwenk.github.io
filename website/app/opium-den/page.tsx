import Link from "next/link";
import Navigation from "@/components/Navigation";
import DjBooth from "@/components/opium-den/DjBooth";
import { ChevronIcon, ExternalIcon } from "@/components/opium-den/playerIcons";
import { DEFAULT_PREVIEW_IMAGE, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Opium Den",
  description: "An open ended music project, trying to make a better alternative to Spotify",
  path: "/opium-den",
  image: DEFAULT_PREVIEW_IMAGE,
});

const NTS_RADIO_URL = "https://www.nts.live/";
const TOMMY_DJ_SET_URL = "#";
const TOMMY_TRACEPOINT_URL = "https://youtu.be/vQVDN9WMmeY?si=30ZEHBMureSoWbwB";
const DUBLAB_URL = "https://www.dublab.com/archive/andy-oro-and-akumen-made-to-move-radio-09-06-25";
const THE_LOT_URL = "https://www.thelotradio.com/";

/** something worth listening to elsewhere: what it is and who or where it's from. */
type ListenLink = { name: string; source: string; url: string };

const LISTEN_LINKS: ListenLink[] = [
  { name: "Nightwalk hong kong", source: "Tommy aka Tracepoint", url: TOMMY_TRACEPOINT_URL },
  { name: "old TommyPips set", source: "Tommy aka Tracepoint", url: TOMMY_DJ_SET_URL },
  { name: "NTS Radio", source: "radio", url: NTS_RADIO_URL },
  { name: "dublab", source: "radio", url: DUBLAB_URL },
  { name: "the lot", source: "radio", url: THE_LOT_URL },
];

/**
 * one outside link as a row: the name, where it's from, and an arrow. opens in a new tab
 * unless it's a placeholder that doesn't go anywhere yet.
 *
 * @param {object} props
 * @param {ListenLink} props.link - the link.
 * @returns {JSX.Element} the row.
 */
function ListenRow({ link }: { link: ListenLink }) {
  const external = link.url.startsWith("http");
  return (
    <li>
      <a
        href={link.url}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="group flex items-center gap-4 py-3.5"
      >
        {/* stacked on phones so long names don't get cut off, side by side once there's room */}
        <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <span className="truncate text-den-ink transition-colors group-hover:text-white">{link.name}</span>
          <span className="truncate text-sm text-den-faint">{link.source}</span>
        </span>
        <ExternalIcon className="h-4 w-4 shrink-0 text-den-faint transition-colors group-hover:text-den-ink" />
      </a>
    </li>
  );
}

/**
 * the opium den: what the project is, the dj booth (live stream, past sets, player), and
 * a list of outside radio and sets worth hearing. flat and quiet on purpose, with one red
 * accent for what's live or playing. see website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the opium den page layout.
 */
export default function OpiumDenPage() {
  return (
    <>
      <Navigation />
      <main className="den-page min-h-screen bg-den-bg text-den-ink">
        <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-24 sm:pt-28">
          <header>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Opium Den</h1>
            <p className="mt-4 max-w-xl leading-relaxed text-den-muted">
              This is an open ended project, I am not sure what will result from it but the motivation is to create a better alternative to spotify. I would love to hear your feedback below
            </p>

            <details className="group mt-4">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm text-den-ink/80 transition-colors hover:text-den-ink [&::-webkit-details-marker]:hidden">
                what is this
                <ChevronIcon direction="down" className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-den-muted">
                self hosted music library to stream to my phone, and also share with friends. implement fun things i would like to have in a streaming service. The goal is to do this in a way that encourages supporting living artists more directly, while still providing a good experience.
              </p>
            </details>

            {/* <details className="group mt-2">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm text-den-ink/80 transition-colors hover:text-den-ink [&::-webkit-details-marker]:hidden">
                why?
              </summary>
              <div className="mt-3 max-w-xl space-y-3 text-sm leading-relaxed text-den-muted">
                <p>
                  Listen, I fucking love spotify. leaving all of my playlists is going to hurt real bad. Ive been building them for over 10 years and I must say that there are some bangers there. That being said I may download my catalogue some way and perhaps keep some of thos eplaylists alive...
                </p>
                <p>
                  But sadly Spotify evil :(
                </p>
                <p>
                  In a story that is very familiar in the world of music they have consistently exploited their artists.
                    The straw that broke the camels back for me (and many other people such as KGLW) was their investment of over $800 million in Helsing - a German private military company that produces AI powered military drones. The CEO of Spotify also joined the board of that company as he continues to funnel money from spotify premium memberships to the creation of war, rather than.. musicians.
                </p>
                <a
                  href="https://en.wikipedia.org/wiki/Criticism_of_Spotify#Funding_defense_technology"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block break-all text-den-ink/80 underline underline-offset-4 hover:text-den-ink"
                >
                  https://en.wikipedia.org/wiki/Criticism_of_Spotify#Funding_defense_technology
                </a>
                <p>Also, the ability to own your music, not rent it. Over the past ~11 years I have spent about $1,900 on Spotify and own nothing. If they went bankrupt or just decided to change their terms I would lose everything. I&apos;d rather start investing In the ownership of music.
                </p>
                <p>
                  I think there are also positive effects of having music feel less like an infinite, disposable commodity, and rather something special that you have to seek out.
                </p>
              </div>
            </details> */}
          </header>

          <DjBooth />

          <section className="mt-16">
            <h2 className="border-b border-den-line pb-3 text-base font-semibold">Listen</h2>
            <ul className="mt-1 divide-y divide-den-line">
              {LISTEN_LINKS.map((link) => (
                <ListenRow key={link.name} link={link} />
              ))}
            </ul>
          </section>

          <footer className="mt-16 border-t border-den-line pt-6">
            <Link href="/" className="text-sm text-den-faint transition-colors hover:text-den-ink">
              Back to main menu
            </Link>
          </footer>
        </div>
      </main>
    </>
  );
}
