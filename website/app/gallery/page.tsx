import Image from "next/image";
import GalleryModal from "@/components/GalleryModal";
import PageWrapper from "@/components/PageWrapper";

const API_BASE = "https://api.tyler-schwenk.com";

// --- API types ---

interface ApiPhoto {
  id: number;
  display_order: number;
}

// returned by GET /galleries (list)
interface ApiGallery {
  id: number;
  name: string;
  description: string | null;
  slug: string;
  photo_count: number | null;
}

// returned by GET /galleries/slug/{slug} (detail with photos)
interface ApiGalleryDetail {
  name: string;
  description: string | null;
  photos: ApiPhoto[];
}

interface ApiVideo {
  id: number;
  title: string;
  description: string | null;
  slug: string;
}

// slugs that belong under the People section; everything else is Trips
const PEOPLE_SLUGS = new Set(["friends", "college", "palestinepals", "family"]);

// external-link-only entries — not stored on the Pi so they live in code
interface ExternalEntry {
  slug: string;
  title: string;
  description: string;
  externalUrl: string;
  externalLinkText?: string;
}

const EXTERNAL_TRIPS: ExternalEntry[] = [
  {
    slug: "elcap",
    title: "El Cap",
    description: "Via triple direct.\nMay 10-16, 2025",
    externalUrl: "https://vish.ventures/triple-direct",
  },
  {
    slug: "halfdome",
    title: "Half Dome",
    description: "Via Regular Northwest Face\nMay 2024",
    externalUrl: "https://vish.ventures/yosemite-05-24/rnwf",
  },
];

const EXTERNAL_PEOPLE: ExternalEntry[] = [
  {
    slug: "bikenite",
    title: "Bike Nite",
    description: "",
    externalUrl: "https://www.instagram.com/bikenitesd/",
    externalLinkText: "ok this is on instagram",
  },
];

type GalleryEntry = {
  title: string;
  description: string;
  coverImage: string;
  media: Array<{ src: string; alt: string; type: "image" | "video" }>;
  externalUrl?: string;
  externalLinkText?: string;
};

const FALLBACK_TRIP_COVER = "/images/bikes/black-bike.jpg";
const FALLBACK_PEOPLE_COVER = "/images/pic00.jpeg";

type WhyNotInstagramReason = {
  title?: string;
  description?: string;
  linkUrl?: string;
  linkText?: string;
  imageSrc?: string;
};

const WHY_NOT_INSTAGRAM_REASONS: WhyNotInstagramReason[] = [
  {
    description: "I mean we all intuitively know this stuff is bad for us. But heres some concrete examples",
    },
  {
    title: "Intentional manipulation",
    description: "Social media platforms have the capability, and motivation, to take control of our political system.",
    linkUrl: "https://research.facebook.com/publications/a-61-million-person-experiment-in-social-influence-and-political-mobilization/",
    linkText: "From Facebook - A 61 Million Person Experiment in Social Influence and Political Mobilization",
    imageSrc: "/images/gallery/reasons/trump_mark.webp"
  }
  
];

// --- API helpers ---

/**
 * Fetches metadata for all public galleries from the Pi API.
 * Returns empty array if the API is unreachable.
 */
async function fetchAllGalleries(): Promise<ApiGallery[]> {
  try {
    const res = await fetch(`${API_BASE}/galleries`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    console.warn("could not fetch galleries from API");
    return [];
  }
}

/**
 * Fetches a gallery and its photos by slug from the Pi API.
 * Returns null if the gallery doesn't exist or the API is unreachable.
 */
async function fetchGalleryBySlug(slug: string): Promise<ApiGalleryDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/galleries/slug/${slug}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    console.warn(`could not fetch gallery "${slug}" from API — leaving it empty`);
    return null;
  }
}

/**
 * Fetches all public videos from the Pi API.
 * Returns empty array if the API is unreachable.
 */
async function fetchAllVideos(): Promise<ApiVideo[]> {
  try {
    const res = await fetch(`${API_BASE}/videos`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    console.warn("could not fetch videos from API — skipping video section");
    return [];
  }
}

/**
 * Returns the URL for a gallery photo file.
 * @param photoId - Photo ID from the API
 * @param thumbnail - If true, returns the 400x400 thumbnail instead of full resolution
 */
function photoUrl(photoId: number, thumbnail = false): string {
  const params = thumbnail ? "?thumbnail=true" : "";
  return `${API_BASE}/galleries/photos/${photoId}/file${params}`;
}

/** Returns the streaming URL for a video. */
function videoStreamUrl(videoId: number): string {
  return `${API_BASE}/videos/${videoId}/stream`;
}

/** Returns the thumbnail image URL for a video. */
function videoThumbnailUrl(videoId: number): string {
  return `${API_BASE}/videos/${videoId}/thumbnail`;
}

/**
 * Builds a GalleryEntry for a Pi-hosted gallery by fetching its photos.
 * Name and description come from the API — no hardcoding needed.
 */
async function buildApiGalleryEntry(
  gallery: ApiGallery,
  fallbackCover: string
): Promise<GalleryEntry> {
  const detail = await fetchGalleryBySlug(gallery.slug);
  const photos = detail?.photos ?? [];
  const media = photos.map((photo) => ({
    src: photoUrl(photo.id),
    alt: gallery.name,
    type: "image" as const,
  }));
  return {
    title: gallery.name,
    description: gallery.description ?? "",
    coverImage: photos.length > 0 ? photoUrl(photos[0].id, true) : fallbackCover,
    media,
  };
}

/**
 * Builds a GalleryEntry for an external-link-only gallery (no photos on the Pi).
 */
function buildExternalEntry(entry: ExternalEntry, fallbackCover: string): GalleryEntry {
  return {
    title: entry.title,
    description: entry.description,
    coverImage: fallbackCover,
    media: [],
    externalUrl: entry.externalUrl,
    externalLinkText: entry.externalLinkText,
  };
}

export default async function GalleryPage() {
  const [allGalleries, videos] = await Promise.all([fetchAllGalleries(), fetchAllVideos()]);

  const tripApiGalleries = allGalleries.filter((g) => !PEOPLE_SLUGS.has(g.slug));
  const peopleApiGalleries = allGalleries.filter((g) => PEOPLE_SLUGS.has(g.slug));

  const [tripApiEntries, peopleApiEntries] = await Promise.all([
    Promise.all(tripApiGalleries.map((g) => buildApiGalleryEntry(g, FALLBACK_TRIP_COVER))),
    Promise.all(peopleApiGalleries.map((g) => buildApiGalleryEntry(g, FALLBACK_PEOPLE_COVER))),
  ]);

  // Pi galleries come first (API order), external-link entries appended at the end
  const tripGalleries: Record<string, GalleryEntry> = Object.fromEntries([
    ...tripApiGalleries.map((g, i) => [g.slug, tripApiEntries[i]]),
    ...EXTERNAL_TRIPS.map((e) => [e.slug, buildExternalEntry(e, FALLBACK_TRIP_COVER)]),
  ]);

  const peopleGalleries: Record<string, GalleryEntry> = Object.fromEntries([
    ...peopleApiGalleries.map((g, i) => [g.slug, peopleApiEntries[i]]),
    ...EXTERNAL_PEOPLE.map((e) => [e.slug, buildExternalEntry(e, FALLBACK_PEOPLE_COVER)]),
  ]);

  // each video on the Pi becomes its own gallery card
  const videoGalleries: Record<string, GalleryEntry> = Object.fromEntries(
    videos.map((video) => [
      video.slug,
      {
        title: video.title,
        description: video.description ?? "",
        coverImage: videoThumbnailUrl(video.id),
        media: [{ src: videoStreamUrl(video.id), alt: video.title, type: "video" as const }],
      },
    ])
  );

  return (
    <PageWrapper>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-6 py-20">
        {/* Why Not Instagram Section */}
        <section className="mb-16 max-w-3xl mx-auto">
          <details className="group bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700 shadow-xl">
            <summary className="cursor-pointer px-6 py-4 text-lg font-semibold text-white hover:text-orange-400 transition-colors list-none flex items-center justify-between">
              <span>Why not just use Instagram?</span>
              <span className="text-orange-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-6 pb-6 pt-2 space-y-6 text-slate-300">
              {WHY_NOT_INSTAGRAM_REASONS.map((reason, index) => (
                <div key={index} className="space-y-3">
                  {reason.imageSrc ? (
                    <div className="flex flex-col md:flex-row gap-4 md:items-start">
                      <div className="flex-shrink-0">
                        <Image
                          src={reason.imageSrc}
                          alt={reason.title || "Reason image"}
                          width={200}
                          height={150}
                          className="rounded-lg border border-slate-600 w-full md:w-auto"
                        />
                      </div>
                      <div className="flex-1 space-y-3">
                        {(reason.title || reason.description) && (
                          <p className="leading-relaxed">
                            {reason.title && <strong className="text-white">{reason.title}:</strong>}
                            {reason.title && reason.description && " "}
                            {reason.description}
                          </p>
                        )}
                        {reason.linkUrl && (
                          <a
                            href={reason.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 underline"
                          >
                            {reason.linkText || reason.linkUrl}
                            <span>→</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {(reason.title || reason.description) && (
                        <p className="leading-relaxed">
                          {reason.title && <strong className="text-white">{reason.title}:</strong>}
                          {reason.title && reason.description && " "}
                          {reason.description}
                        </p>
                      )}
                      {reason.linkUrl && (
                        <a
                          href={reason.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 underline"
                        >
                          {reason.linkText || reason.linkUrl}
                          <span>→</span>
                        </a>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </details>
        </section>

        {/* Friends' Websites */}
        <section className="mb-16 text-center">
          <p className="text-xl text-gray-300 mb-6">
            Lots of these photos were taken by my more talented friends:
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <a 
              href="https://frankyhanen.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-400 font-mono transition-all hover:scale-105"
            >
              Franky
            </a>
            <a 
              href="https://tavakessler.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-400 font-mono transition-all hover:scale-105"
            >
              Tava
            </a>
            <a 
              href="https://vish.ventures/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-400 font-mono transition-all hover:scale-105"
            >
              Vishal
            </a>
            <a 
              href="https://www.samuelsfilm.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-400 font-mono transition-all hover:scale-105"
            >
              Sam
            </a>
          </div>
        </section>

        {/* Trips Section */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold text-white mb-12 flex items-center">
            <span className="text-orange-500 mr-3"></span>
            Trips
          </h2>
          <GalleryModal galleries={tripGalleries} />
        </section>

        {/* People Section */}
        <section className="mb-20 space-y-12">
          <h2 className="text-4xl font-bold text-white mb-12 flex items-center">
            <span className="text-orange-500 mr-3"></span>
            People
          </h2>
          
          <GalleryModal galleries={peopleGalleries} />
        </section>

        {/* Videos Section — only shown if videos exist on the Pi */}
        {Object.keys(videoGalleries).length > 0 && (
          <section className="space-y-12">
            <h2 className="text-4xl font-bold text-white mb-12 flex items-center">
              <span className="text-orange-500 mr-3"></span>
              Videos
            </h2>
            <GalleryModal galleries={videoGalleries} />
          </section>
        )}
      </div>
    </div>
    </PageWrapper>
  );
}
