"use client";

import Image from "next/image";
import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";
import PhotoLightboxGrid from "@/components/PhotoLightboxGrid";

// keep in sync with the accent color used throughout this page's inline classes
const ACCENT_HEX = "#3275a8";

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
 * A framed photo shown at its full extent (never cropped) on a soft neutral backdrop.
 *
 * @param {object} props - Component props.
 * @param {string} props.src - Image path.
 * @param {string} props.alt - Accessible description of the photo.
 * @returns {JSX.Element} The framed photo.
 */
function PhotoFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 100vw, 672px"
      />
    </div>
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

          {/* Disclaimer */}
          <div
            className="mb-16 rounded-lg px-5 py-4"
            style={{ borderLeft: `4px solid ${ACCENT_HEX}`, backgroundColor: `${ACCENT_HEX}0d` }}
          >
            <p className="text-sm leading-relaxed text-slate-700">
              This project is still in development. The panels and batteries and whatnot are wired
              up and working, but I want to connect a battery monitor to my Pi to track its usage
              over time and see how much savings come from it.
            </p>
          </div>

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
