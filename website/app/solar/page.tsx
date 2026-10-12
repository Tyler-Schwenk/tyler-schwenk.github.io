"use client";

import Image from "next/image";
import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";
import PhotoLightboxGrid from "@/components/PhotoLightboxGrid";

// keep in sync with the accent color used throughout this page's inline classes
const ACCENT_HEX = "#3275a8";
// warm color so the plug-in solar notice reads as an alert, not part of the page's blue theme
const NOTICE_HEX = "#ea580c";

const EXECUTED_PHOTOS = [
  { src: "/images/solar/1.jpg", thumbSrc: "/images/solar/1.jpg", alt: "Solar install, step 1" },
  { src: "/images/solar/2.jpg", thumbSrc: "/images/solar/2.jpg", alt: "Solar install, step 2" },
  { src: "/images/solar/3.jpg", thumbSrc: "/images/solar/3.jpg", alt: "Solar install, step 3" },
  { src: "/images/solar/4.jpg", thumbSrc: "/images/solar/4.jpg", alt: "Solar install, step 4" },
];

/**
 * A single content block: a small heading (with optional subtitle) followed by its body.
 *
 * @param {object} props - Component props.
 * @param {string} props.title - Section heading.
 * @param {string} [props.subtitle] - Optional secondary line under the heading.
 * @param {React.ReactNode} props.children - Section body content.
 * @returns {JSX.Element} The section block.
 */
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-16">
      <h2 className="text-lg font-medium text-slate-900 mb-1 tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

/**
 * A framed photo at full column width, sized to its own aspect ratio so it's never cropped
 * or letterboxed (portrait shots just come out tall).
 *
 * @param {object} props - Component props.
 * @param {string} props.src - Image path.
 * @param {string} props.alt - Accessible description of the photo.
 * @returns {JSX.Element} The framed photo.
 */
function PhotoFrame({ src, alt }: { src: string; alt: string }) {
  // 0x0 lets the browser use the file's natural size (incl. EXIF rotation) via h-auto
  return (
    <Image
      src={src}
      alt={alt}
      width={0}
      height={0}
      className="h-auto w-full rounded-lg border border-slate-200"
      sizes="(max-width: 768px) 100vw, 672px"
    />
  );
}

/**
 * An inline link to an outside site, opened in a new tab and styled with the page accent.
 *
 * @param {object} props - Component props.
 * @param {string} props.href - External URL.
 * @param {React.ReactNode} props.children - Link text.
 * @returns {JSX.Element} The link.
 */
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#3275a8] underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

/**
 * The Solar Setup page — a minimalist writeup of the home solar install: the plan,
 * the panels, the build itself, and the output. Deliberately styled apart from the
 * site's retro 8-bit theme, using a single blue accent color throughout.
 *
 * @returns {JSX.Element} The Solar Setup page.
 */
export default function SolarPage() {
  return (
    <PageWrapper>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-2xl px-6 py-20 md:py-28">
          {/* Header */}
          <div className="flex items-center gap-4 mb-3">
            <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-slate-200">
              <Image src="/images/solar/solar_icon.png" alt="" fill className="object-contain" />
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
              Solar Setup
            </h1>
          </div>
          <div className="h-1 w-16 rounded-full mb-10" style={{ backgroundColor: ACCENT_HEX }} />

          {/* Plug-in solar notice, collapsed by default */}
          <details
            className="group mb-16 rounded-lg px-5 py-4"
            style={{ borderLeft: `4px solid ${NOTICE_HEX}`, backgroundColor: `${NOTICE_HEX}1a` }}
          >
            <summary
              className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden"
              style={{ color: NOTICE_HEX }}
            >
              CA approved plug-in solar!!
              <span className="transition-transform group-open:rotate-180">
                &#9662;
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              So now you don&apos;t have to do what I did, just get one of those. You won&apos;t
              need to deal with a battery, inverter, and installation, which drive the majority of
              the cost (the panels themselves only make up ~20% of a typical rooftop solar install).
              They&apos;re super simple, easy to use as a renter, and help offset peak price spikes
              during the day when the sun is shining most and everyone is running their A/C due to
              the changing climate and diminishing availability of oil.{" "}
              <ExternalLink href="https://www.brightsaver.org/plug-in-solar-products">
                Check them out
              </ExternalLink>
              .
            </p>
          </details>

          <Section title="The Plan">
            <PhotoFrame src="/images/solar/plan.jpg" alt="Hand-drawn plan for the solar setup" />
          </Section>

          <Section title="The Panels" subtitle="240 watts total">
            <PhotoFrame src="/images/solar/panels.jpg" alt="Solar panels" />
          </Section>

          <Section title="The Plan, Executed">
            <PhotoLightboxGrid photos={EXECUTED_PHOTOS} />
          </Section>

          <Section title="The Output">
            <PhotoFrame src="/images/solar/monitor.jpg" alt="Power output monitor" />
          </Section>

          <Section title="Inspiration">
            <div className="space-y-4 text-sm leading-relaxed text-slate-700">
              <p>
                Mostly this project was motivated by the fact that if we don&apos;t start using more
                sustainable energy, all of us humans will die horrible deaths due to things like
                famine, poisoned water, and increasingly frequent and intense natural disasters. And
                by the fact that this is already happening, particularly for people in the colonized
                parts of the world. Solar is a very good solution that&apos;s been proven effective.
                It&apos;s literally free energy raining down from the sky that would otherwise just
                make your house a little hotter, so you might as well capture it and use it. Plants
                do it all the time, we might as well join them.
              </p>
              <p>
                This project has been nice on one hand to just get some solar capacity, but also to
                gain a better understanding of the system, the costs, and where the inefficiencies
                are (mostly the inverter, which is why plug-in solar is extra epic). It&apos;s also
                given me a better perspective on how much power these panels supply, and how much my
                different appliances draw (cool to see how the power draw changes when listening to
                music at different volume levels).
              </p>
            </div>
          </Section>

          <Section title="Wright's Law">
            <div className="space-y-4 text-sm leading-relaxed text-slate-700">
              <p>
                Solar is becoming steadily cheaper and more efficient following Wright&apos;s law,{" "}
                <ExternalLink href="https://ourworldindata.org/learning-curve">
                  check it out
                </ExternalLink>
                .
              </p>
              <PhotoFrame
                src="/images/solar/solar-pv-prices-vs-cumulative-capacity.png"
                alt="Solar PV module prices vs. cumulative installed capacity"
              />
            </div>
          </Section>

          <Section title="Solarpunk">
            <div className="space-y-4 text-sm leading-relaxed text-slate-700">
              <p>
                I also think the idea of{" "}
                <ExternalLink href="https://en.wikipedia.org/wiki/Solarpunk">Solarpunk</ExternalLink>{" "}
                is cool. I just got{" "}
                <ExternalLink href="https://en.wikipedia.org/wiki/The_Dispossessed">
                  The Dispossessed
                </ExternalLink>
                , which I think will be interesting since it&apos;s considered solarpunk but was
                written in 1974. I&apos;m curious what an anarchist utopian future would look like
                to someone from that time. I&apos;ll come back here to let y&apos;all know what I
                think of it after reading.
              </p>
              <PhotoFrame src="/images/solar/solarpunk_flag.webp" alt="Solarpunk flag" />
            </div>
          </Section>

          {/* Back Link */}
          <div className="text-center">
            <Link
              href="/"
              className="text-sm text-slate-400 transition-colors hover:text-[#3275a8]"
            >
              &larr; Back to Main Menu
            </Link>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
