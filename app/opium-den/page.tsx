import Link from "next/link";
import Navigation from "@/components/Navigation";

const NTS_RADIO_URL = "https://www.nts.live/";
const TOMMY_DJ_SET_URL = "#";

/**
 * Renders the music lounge page with curated listening links.
 *
 * @returns {JSX.Element} The opium den page layout.
 */
export default function OpiumDenPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-[#1a0508] via-[#3b0b16] to-[#0f0305] text-red-50 px-4 py-12">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-red-900/80 bg-red-950/60 p-6 md:p-10 shadow-2xl">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-wide text-red-100">Opium Den</h1>
        <p className="mt-3 text-red-200/90 leading-relaxed">
          This is an open ended project, I am not sure what will result from it but the motivation is to create a better alternative to spotify. I would love to hear your feedback below
        </p>

        <details className="mt-8 rounded-xl border border-red-800/90 bg-red-900/30 p-4">
          <summary className="inline-flex cursor-pointer list-none items-center rounded-md border border-red-700 bg-red-800 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-red-100 hover:bg-red-700 transition-colors">
            what
          </summary>
          <div className="mt-4 space-y-4 text-red-100/90 leading-relaxed">
            <p>
              self hosted music library to stream to my phone, and also share with friends. implement fun things i would like to have in a streaming service. The goal is to do this in a way that encourages supporting living artists more directly, while still progressing in th enjoyment of music, not just regressing.
            </p>
            
          </div>
        </details>

        <details className="mt-8 rounded-xl border border-red-800/90 bg-red-900/30 p-4">
          <summary className="inline-flex cursor-pointer list-none items-center rounded-md border border-red-700 bg-red-800 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-red-100 hover:bg-red-700 transition-colors">
            why?
          </summary>
          <div className="mt-4 space-y-4 text-red-100/90 leading-relaxed">
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
              className="inline-block text-red-200 underline underline-offset-4 hover:text-red-100"
            >
              https://en.wikipedia.org/wiki/Criticism_of_Spotify#Funding_defense_technology
            </a>
<p>              Also, the ability to own your music, not rent it. Over the past ~11 years I have spent about $1,900 on Spotify and own nothing. If they went bankrupt or just decided to change their terms I would lose everything. I'd rather start investing In the ownership of music.
            </p>

            <p>
              But i think in this modern world we have a great opportunity to access artists' music directly, and thus also support them directly, with a significant reduction in people skimming off the top, or worse. 
            </p>
            <p>
              I think there are also positive effects of having music be less based on instant gratification & a mentality of collection. 
            </p>
          </div>
        </details>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-medium text-red-100">Listen</h2>
          <a
            href={TOMMY_DJ_SET_URL}
            className="block w-fit rounded-md border border-red-700 bg-red-900/60 px-4 py-2 text-red-100 hover:bg-red-800 transition-colors"
          >
            Tommy&apos;s DJ Set
          </a>
          <a
            href={NTS_RADIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-fit rounded-md border border-red-700 bg-red-900/60 px-4 py-2 text-red-100 hover:bg-red-800 transition-colors"
          >
            NTS Radio
          </a>
        </section>

          <div className="mt-10">
            <Link href="/" className="text-sm text-red-300 hover:text-red-100 underline underline-offset-4">
              Return to main menu
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
