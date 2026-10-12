"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";
import PhotoLightbox from "@/components/PhotoLightbox";
import TimelapsePlayer from "./TimelapsePlayer";
import { TIMELAPSE_SPAN } from "./timelapse-utils";
import { API_BASE, photoUrl, videoStreamUrl, videoThumbnailUrl } from "@/lib/api";

const TIMELAPSE_SLUG = "garden-timelapse";
// slug of the Pi gallery that feeds the photographs section — create this
// gallery once via the admin panel (Galleries tab -> New Gallery) with this exact slug,
// then upload photos to it via Upload -> Photos -> Existing Gallery -> pick it from the list
const GARDEN_GALLERY_SLUG = "garden-photos";
// used to reserve space for photos the API has no dimensions for
const FALLBACK_PHOTO_WIDTH_PX = 4;
const FALLBACK_PHOTO_HEIGHT_PX = 3;
const PLATE_NUMBER_DIGITS = 2;
const NARROW_PHOTO_COLUMNS = 2;
const WIDE_PHOTO_COLUMNS = 3;

const FAVORITE_TOMATO = {
  name: "Shimmer",
  variety: "hybrid tomato",
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

const HERBARIUM_FIELDS = [
  { label: "Locality", value: "San Diego, California" },
  { label: "Habitat", value: "home garden" },
  { label: "Collected", value: TIMELAPSE_SPAN.range },
  { label: "Duration", value: TIMELAPSE_SPAN.totalDays ? `${TIMELAPSE_SPAN.totalDays} days` : "-" },
];

interface VideoMeta {
  id: number;
}

interface GalleryPhoto {
  id: number;
  width: number | null;
  height: number | null;
}

/**
 * Running head that opens each section: a full-width ink rule with a mono
 * label on the left and an optional aside on the right.
 *
 * @param {object} props - Component props.
 * @param {string} props.label - Section name.
 * @param {string} [props.aside] - Small supporting text on the right.
 * @returns {JSX.Element} The section head.
 */
function RunningHead({ label, aside }: { label: string; aside?: string }) {
  return (
    <div className="garden-mono mb-6 flex items-baseline justify-between gap-4 border-t border-[var(--g-ink)] pt-2 text-xs">
      <h2 className="uppercase tracking-wider">{label}</h2>
      {aside && <span className="text-[var(--g-ink-soft)]">{aside}</span>}
    </div>
  );
}

/**
 * Typed specimen label, like the ones pinned to herbarium sheets — holds the
 * garden's vital stats instead of a row of stat tiles.
 *
 * @returns {JSX.Element} The label.
 */
function HerbariumLabel() {
  return (
    <figure className="garden-mono w-full max-w-sm border border-[var(--g-ink)] bg-[var(--g-paper-raised)] p-4 text-xs md:rotate-[-1.5deg]">
      <figcaption className="mb-3 border-b-[3px] border-double border-[var(--g-ink)] pb-2 text-center uppercase tracking-[0.15em]">
        Herbarium of T. Schwenk
      </figcaption>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
        {HERBARIUM_FIELDS.map((field) => (
          <div key={field.label} className="contents">
            <dt className="text-[var(--g-ink-soft)]">{field.label}</dt>
            <dd className="border-b border-dotted border-[var(--g-ink-faint)]">{field.value}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

/**
 * Formats a 1-based plate number with leading zeros, e.g. 3 -> "03".
 *
 * @param {number} n - Plate number.
 * @returns {string} Zero-padded plate number.
 */
function plateNumber(n: number): string {
  return n.toString().padStart(PLATE_NUMBER_DIGITS, "0");
}

/**
 * Deals photos into columns, always adding to the currently shortest one (by
 * height relative to width), so columns end up roughly even and the plate
 * numbers still read left to right across the top. CSS columns would fill
 * top-to-bottom instead and leave ragged bottoms with only a few photos.
 *
 * @param {GalleryPhoto[]} photos - Photos in display order.
 * @param {number} columnCount - How many columns to fill.
 * @returns {number[][]} Photo indices for each column, top to bottom.
 */
function balanceColumns(photos: GalleryPhoto[], columnCount: number): number[][] {
  const columns: number[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array<number>(columnCount).fill(0);
  photos.forEach((photo, i) => {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest].push(i);
    heights[shortest] += (photo.height ?? FALLBACK_PHOTO_HEIGHT_PX) / (photo.width ?? FALLBACK_PHOTO_WIDTH_PX);
  });
  return columns;
}

interface PhotoPlateProps {
  photo: GalleryPhoto;
  index: number;
  onOpen: (index: number) => void;
}

/**
 * One photograph at its natural proportions with a "Pl. 01" caption; clicking
 * opens it in the lightbox.
 *
 * @param {PhotoPlateProps} props - The photo, its position in the gallery, and the open handler.
 * @returns {JSX.Element} The captioned photo.
 */
function PhotoPlate({ photo, index, onOpen }: PhotoPlateProps) {
  const plate = plateNumber(index + 1);
  return (
    <figure>
      <button
        type="button"
        onClick={() => onOpen(index)}
        className="block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-tomato)]"
        aria-label={`Open plate ${plate}`}
      >
        <Image
          src={photoUrl(photo.id, true)}
          alt={`Garden photograph, plate ${plate}`}
          width={photo.width ?? FALLBACK_PHOTO_WIDTH_PX}
          height={photo.height ?? FALLBACK_PHOTO_HEIGHT_PX}
          sizes="(max-width: 1024px) 50vw, 33vw"
          className="h-auto w-full bg-[var(--g-paper-raised)] transition-opacity hover:opacity-90"
        />
      </button>
      <figcaption className="garden-mono mt-1.5 text-[10px] text-[var(--g-ink-faint)]">Pl. {plate}</figcaption>
    </figure>
  );
}

/**
 * Photographs laid out in balanced columns — two on phones/tablets, three on
 * wide screens. Both layouts are rendered and swapped with CSS so there's no
 * resize listener; the hidden one's lazy images never load.
 *
 * @param {object} props - Component props.
 * @param {GalleryPhoto[]} props.photos - Photos in display order.
 * @param {(index: number) => void} props.onOpen - Called with a photo's index when it's clicked.
 * @returns {JSX.Element} The photo columns.
 */
function PhotoColumns({ photos, onOpen }: { photos: GalleryPhoto[]; onOpen: (index: number) => void }) {
  const layouts = [
    { count: NARROW_PHOTO_COLUMNS, className: "flex gap-3 sm:gap-5 lg:hidden" },
    { count: WIDE_PHOTO_COLUMNS, className: "hidden gap-5 lg:flex" },
  ];
  return (
    <>
      {layouts.map((layout) => (
        <div key={layout.count} className={layout.className}>
          {balanceColumns(photos, layout.count).map((column, c) => (
            <div key={c} className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-6">
              {column.map((i) => (
                <PhotoPlate key={photos[i].id} photo={photos[i]} index={i} onOpen={onOpen} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * The garden page — a seed-catalog style page with the timelapse player,
 * photographs at their natural proportions, and growing notes. Video and
 * photos are fetched from the Pi by slug at runtime.
 *
 * @returns {JSX.Element} The garden page layout.
 */
export default function GardenPage() {
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [videoNotFound, setVideoNotFound] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[] | null>(null);
  const [openPhotoIndex, setOpenPhotoIndex] = useState<number | null>(null);

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

  const lightboxPhotos = (galleryPhotos ?? []).map((photo, i) => ({
    src: photoUrl(photo.id),
    alt: `Garden photograph, plate ${plateNumber(i + 1)}`,
  }));

  return (
    <PageWrapper>
      <div className="garden-theme min-h-screen">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          {/* masthead */}
          <header className="pb-16 pt-24 sm:pt-28 md:pb-24">
            <div className="garden-mono mb-8 flex justify-between gap-4 border-b border-[var(--g-rule)] pb-2 text-[11px] text-[var(--g-ink-soft)] sm:text-xs">
              <span>tyler-schwenk.com / garden</span>
              <span>San Diego, Calif.</span>
            </div>

            <div className="grid gap-10 md:grid-cols-12 md:items-end">
              <div className="md:col-span-8">
                <h1 className="garden-display text-[clamp(4.5rem,17vw,11rem)] leading-[0.82] tracking-tight">
                  The<br />Garden
                </h1>
                <p className="mt-8 max-w-[34ch] text-lg leading-relaxed text-[var(--g-ink-soft)] sm:text-xl">
                  A home garden in San Diego, and a camera pointed at it. Drag along
                  the ruler under the video to move through the season.
                </p>
              </div>
              <div className="md:col-span-4 md:flex md:justify-end md:pb-2">
                <HerbariumLabel />
              </div>
            </div>
          </header>

          {/* timelapse */}
          <section className="mb-20 md:mb-28">
            <RunningHead label="Timelapse" aside={TIMELAPSE_SPAN.range} />
            {videoMeta ? (
              <>
                <TimelapsePlayer
                  src={videoStreamUrl(videoMeta.id)}
                  poster={videoThumbnailUrl(videoMeta.id)}
                />
                <p className="garden-mono mt-6 hidden text-[11px] text-[var(--g-ink-faint)] [@media(hover:hover)]:md:block">
                  keys: space play &middot; &larr;/&rarr; frame &middot; shift + &larr;/&rarr; day &middot; f full screen
                </p>
              </>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-[var(--g-paper-raised)]">
                <p className="text-lg italic text-[var(--g-ink-soft)]">
                  {videoNotFound ? "The timelapse is still being put together." : "Loading the timelapse…"}
                </p>
              </div>
            )}
          </section>

          {/* photographs */}
          <section className="mb-20 md:mb-28">
            <RunningHead
              label="Photographs"
              aside={galleryPhotos && galleryPhotos.length > 0 ? `${galleryPhotos.length} plates` : undefined}
            />
            {galleryPhotos === null ? (
              <p className="garden-mono text-xs text-[var(--g-ink-faint)]">loading&hellip;</p>
            ) : galleryPhotos.length === 0 ? (
              <p className="text-lg italic text-[var(--g-ink-soft)]">Nothing here yet. Photos show up once they&rsquo;re uploaded.</p>
            ) : (
              <PhotoColumns photos={galleryPhotos} onOpen={setOpenPhotoIndex} />
            )}
          </section>

          {/* notes */}
          <section className="mb-20">
            <RunningHead label="Notes" />
            <div className="divide-y divide-[var(--g-rule)]">
              <div className="grid gap-3 pb-10 md:grid-cols-12 md:gap-8">
                <h3 className="garden-mono text-xs text-[var(--g-ink-soft)] md:col-span-3">Tomato of the year</h3>
                <div className="md:col-span-9">
                  <p className="garden-display text-6xl leading-none sm:text-7xl">{FAVORITE_TOMATO.name}</p>
                  <p className="garden-mono mt-3 text-xs text-[var(--g-ink-soft)]">
                    {FAVORITE_TOMATO.variety} &middot;{" "}
                    <a
                      href={FAVORITE_TOMATO.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--g-tomato)] underline decoration-1 underline-offset-2 hover:no-underline"
                    >
                      {FAVORITE_TOMATO.source}
                    </a>
                  </p>
                  <blockquote className="mt-6 max-w-[36ch] border-l-2 border-[var(--g-tomato)] pl-5 text-xl italic leading-relaxed sm:text-2xl">
                    &ldquo;{FAVORITE_TOMATO.note}&rdquo;
                  </blockquote>
                </div>
              </div>

              <div className="grid gap-3 pt-10 md:grid-cols-12 md:gap-8">
                <h3 className="garden-mono text-xs text-[var(--g-ink-soft)] md:col-span-3">Further reading</h3>
                <ol className="md:col-span-9">
                  {INSPIRATION_LINKS.map((link, i) => (
                    <li key={link.href} className="flex gap-4 border-b border-dotted border-[var(--g-rule)] py-4 first:pt-0 last:border-b-0">
                      <span className="garden-mono pt-1 text-xs text-[var(--g-ink-faint)]">{i + 1}.</span>
                      <div>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xl underline decoration-[var(--g-rule)] decoration-1 underline-offset-4 transition-colors hover:text-[var(--g-tomato)] hover:decoration-[var(--g-tomato)]"
                        >
                          {link.title}
                        </a>
                        <p className="mt-1 text-[var(--g-ink-soft)]">
                          {link.note}{" "}
                          <span className="garden-mono whitespace-nowrap text-[11px] text-[var(--g-ink-faint)]">({link.source})</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          {/* colophon */}
          <footer className="garden-mono flex flex-col gap-2 border-t border-[var(--g-ink)] py-4 text-[11px] text-[var(--g-ink-soft)] sm:flex-row sm:justify-between">
            <Link href="/" className="hover:text-[var(--g-tomato)]">&larr; Main menu</Link>
            <span>Set in Libre Caslon &amp; IBM Plex Mono</span>
          </footer>
        </div>
      </div>

      {openPhotoIndex !== null && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={openPhotoIndex}
          onIndexChange={setOpenPhotoIndex}
          onClose={() => setOpenPhotoIndex(null)}
        />
      )}
    </PageWrapper>
  );
}
