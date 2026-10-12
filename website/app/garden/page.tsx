"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";
import PhotoLightboxGrid from "@/components/PhotoLightboxGrid";
import TimelapsePlayer from "./TimelapsePlayer";
import { TIMELAPSE_SPAN } from "./timelapse-utils";
import { API_BASE, photoUrl, videoStreamUrl, videoThumbnailUrl } from "@/lib/api";

const TIMELAPSE_SLUG = "garden-timelapse";
// slug of the Pi gallery that feeds the "Garden Photos" section below — create this
// gallery once via the admin panel (Galleries tab -> New Gallery) with this exact slug,
// then upload photos to it via Upload -> Photos -> Existing Gallery -> pick it from the list
const GARDEN_GALLERY_SLUG = "garden-photos";

const FAVORITE_TOMATO = {
  name: "Shimmer",
  href: "https://www.burpee.com/tomato-shimmer-hybrid-prod500101.html",
  source: "burpee.com",
  note: "Soooo good. and it held up really well to powdery mildew in the garden. And very bountiful",
};

const INSPIRATION_LINKS = [
  {
    title: "San Diego Seed Company",
    href: "https://sandiegoseedcompany.com/",
    source: "sandiegoseedcompany.com",
    note: "local seed company with solid info for SoCal gardening",
  },
  {
    title: "San Diego Seed Co. on YouTube",
    href: "https://www.youtube.com/@SanDiegoSeedCompany",
    source: "@SanDiegoSeedCompany",
    note: "videos on planting, growing, and harvesting for San Diego climate",
  },
  {
    title: "Trellis to make you Jealous",
    href: "https://www.youtube.com/watch?v=6vqRMKOxaW8",
    source: "youtube.com",
    note: "I use a modified version of this",
  },
];

interface VideoMeta {
  id: number;
}

interface GalleryPhoto {
  id: number;
}

/**
 * Small leaf mark used as a decorative bullet next to section eyebrows.
 *
 * @param {object} props - Component props.
 * @param {string} [props.className] - Extra classes, mostly for sizing/color.
 * @returns {JSX.Element} The leaf SVG.
 */
function LeafMark({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
      <path d="M5 19l7-7" />
    </svg>
  );
}

/**
 * Section heading with a small leafy eyebrow line above it.
 *
 * @param {object} props - Component props.
 * @param {string} props.eyebrow - Short label above the heading.
 * @param {string} props.title - The heading text.
 * @returns {JSX.Element} The heading block.
 */
function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--g-leaf)]">
        <LeafMark />
        {eyebrow}
      </div>
      <h2 className="garden-serif text-3xl text-[var(--g-ink)] sm:text-4xl">{title}</h2>
    </div>
  );
}

/**
 * Soft bordered box for loading / empty states.
 *
 * @param {object} props - Component props.
 * @param {string} [props.title] - Optional headline, e.g. "Coming soon".
 * @param {string} props.message - Supporting text.
 * @param {string} [props.className] - Extra classes, e.g. an aspect ratio.
 * @returns {JSX.Element} The placeholder box.
 */
function Placeholder({ title, message, className = "" }: { title?: string; message: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--g-border-strong)] bg-[var(--g-surface)] p-12 text-center ${className}`}>
      {title && <p className="garden-serif mb-1 text-2xl text-[var(--g-ink)]">{title}</p>}
      <p className="text-sm text-[var(--g-ink-muted)]">{message}</p>
    </div>
  );
}

/**
 * The garden page — a timelapse of the backyard garden with a live date tag,
 * a photo gallery, the favorite tomato of the year, and inspiration links.
 * Video and photos are fetched from the Pi by slug at runtime.
 *
 * @returns {JSX.Element} The garden page layout.
 */
export default function GardenPage() {
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [videoNotFound, setVideoNotFound] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[] | null>(null);

  // fetch the video ID by slug on mount — slug is stable, numeric ID is not
  useEffect(() => {
    fetch(`${API_BASE}/videos/slug/${TIMELAPSE_SLUG}`)
      .then((res) => {
        if (!res.ok) {
          setVideoNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setVideoMeta({ id: data.id });
      })
      .catch(() => setVideoNotFound(true));
  }, []);

  // fetch the garden photo gallery by slug — null until loaded, [] if it's empty/missing
  useEffect(() => {
    fetch(`${API_BASE}/galleries/slug/${GARDEN_GALLERY_SLUG}`)
      .then((res) => (res.ok ? res.json() : { photos: [] }))
      .then((data) => setGalleryPhotos(data.photos ?? []))
      .catch(() => setGalleryPhotos([]));
  }, []);

  const stats = [
    { label: "First photo", value: TIMELAPSE_SPAN.firstDate },
    { label: "Latest frame", value: TIMELAPSE_SPAN.lastDate },
    { label: "Days of growth", value: TIMELAPSE_SPAN.totalDays?.toString() ?? "-" },
  ];

  return (
    <PageWrapper>
      <div className="garden-theme min-h-screen">
        {/* hero */}
        <header className="relative overflow-hidden border-b border-[var(--g-border)] bg-gradient-to-b from-[var(--g-leaf-soft)] to-[var(--g-paper)]">
          <div className="mx-auto max-w-5xl px-6 pb-14 pt-28 sm:pt-32">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--g-leaf)]">
              <LeafMark className="h-4 w-4" />
              Home garden, San Diego
            </div>
            <h1 className="garden-serif text-6xl leading-none text-[var(--g-ink)] sm:text-7xl md:text-8xl">
              The <em className="text-[var(--g-leaf)]">Garden</em>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[var(--g-ink-muted)]">
              A season of growing, one frame at a time. Scrub through the timelapse
              to watch it fill in, or jump straight to a month.
            </p>

            <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-xl border border-[var(--g-border)] bg-[var(--g-border)]">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-[var(--g-surface)] px-4 py-3 sm:px-5 sm:py-4">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--g-ink-faint)] sm:text-xs">
                    {stat.label}
                  </dt>
                  <dd className="garden-serif mt-1 text-base text-[var(--g-ink)] sm:text-2xl">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-16">
          {/* timelapse */}
          <section className="mb-24">
            <SectionHeading eyebrow="Timelapse" title="Watch it grow" />
            {videoMeta ? (
              <>
                <TimelapsePlayer
                  src={videoStreamUrl(videoMeta.id)}
                  poster={videoThumbnailUrl(videoMeta.id)}
                />
                <p className="mt-4 hidden text-xs text-[var(--g-ink-faint)] sm:block">
                  <kbd className="garden-kbd">space</kbd> play/pause
                  <span className="mx-2">&middot;</span>
                  <kbd className="garden-kbd">&larr;</kbd> <kbd className="garden-kbd">&rarr;</kbd> step a frame
                  <span className="mx-2">&middot;</span>
                  <kbd className="garden-kbd">shift</kbd> + arrows jump a day
                  <span className="mx-2">&middot;</span>
                  <kbd className="garden-kbd">f</kbd> fullscreen
                </p>
              </>
            ) : videoNotFound ? (
              <Placeholder title="Coming soon" message="the timelapse video is being processed" className="aspect-video" />
            ) : (
              <div className="aspect-video animate-pulse rounded-2xl bg-[var(--g-surface-sunk)]" aria-label="Loading timelapse" />
            )}
          </section>

          {/* photos */}
          <section className="mb-24">
            <SectionHeading eyebrow="Snapshots" title="Garden photos" />
            {galleryPhotos === null ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Loading photos">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-lg bg-[var(--g-surface-sunk)]" />
                ))}
              </div>
            ) : galleryPhotos.length === 0 ? (
              <Placeholder title="Coming soon" message="photos will show up here once uploaded" />
            ) : (
              <PhotoLightboxGrid
                photos={galleryPhotos.map((photo) => ({
                  src: photoUrl(photo.id),
                  thumbSrc: photoUrl(photo.id, true),
                  alt: "Garden photo",
                }))}
              />
            )}
          </section>

          {/* notes */}
          <section className="mb-20">
            <SectionHeading eyebrow="Notes" title="What's working" />
            <div className="grid gap-6 md:grid-cols-5">
              {/* seed-packet card */}
              <a
                href={FAVORITE_TOMATO.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--g-border)] bg-[var(--g-surface)] shadow-[var(--g-shadow)] transition-transform hover:-translate-y-0.5 md:col-span-2"
              >
                <div className="bg-[var(--g-clay)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--g-on-clay)]">
                  Favorite tomato this year
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="garden-serif text-5xl text-[var(--g-ink)]">
                    &ldquo;{FAVORITE_TOMATO.name}&rdquo;
                  </h3>
                  <p className="garden-serif mt-4 flex-1 text-lg italic leading-relaxed text-[var(--g-ink-muted)]">
                    {FAVORITE_TOMATO.note}
                  </p>
                  <span className="mt-6 text-sm font-medium text-[var(--g-clay)] group-hover:underline">
                    {FAVORITE_TOMATO.source} &rarr;
                  </span>
                </div>
              </a>

              {/* inspiration links */}
              <div className="rounded-2xl border border-[var(--g-border)] bg-[var(--g-surface)] p-2 md:col-span-3">
                <h3 className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--g-ink-faint)]">
                  Gardening inspiration
                </h3>
                <ul className="divide-y divide-[var(--g-border)]">
                  {INSPIRATION_LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-4 rounded-xl px-4 py-4 transition-colors hover:bg-[var(--g-leaf-soft)]"
                      >
                        <span className="mt-1 text-[var(--g-leaf)]">
                          <LeafMark className="h-4 w-4" />
                        </span>
                        <span className="flex-1">
                          <span className="block font-semibold text-[var(--g-ink)]">{link.title}</span>
                          <span className="mt-0.5 block text-sm text-[var(--g-ink-muted)]">{link.note}</span>
                          <span className="mt-1 block text-xs text-[var(--g-ink-faint)]">{link.source}</span>
                        </span>
                        <span className="mt-1 text-[var(--g-ink-faint)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--g-leaf)]" aria-hidden="true">
                          &rarr;
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <div className="text-center">
            <Link href="/" className="text-sm text-[var(--g-ink-muted)] transition-colors hover:text-[var(--g-leaf)]">
              &larr; Back to main menu
            </Link>
          </div>
        </main>
      </div>
    </PageWrapper>
  );
}
