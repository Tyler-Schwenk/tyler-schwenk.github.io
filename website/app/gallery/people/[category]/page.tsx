import { notFound } from "next/navigation";
import PeopleGalleryClient from "./PeopleGalleryClient";
import PageWrapper from "@/components/PageWrapper";

const API_BASE = "https://api.tyler-schwenk.com";

interface ApiPhoto {
  id: number;
  display_order: number;
}

interface ApiGalleryDetail {
  photos: ApiPhoto[];
}

// config for all people category detail pages — slug must match Pi API gallery slug
const CATEGORY_CONFIG: Record<string, { title: string; description: string; slug: string }> = {
  friends: { title: "Friends", description: "Memories with friends", slug: "friends" },
  palestinepals: { title: "Palestine Pals", description: "Climbing for a cause", slug: "palestinepals" },
  family: { title: "Family", description: "Family moments", slug: "family" },
  college: { title: "College", description: "College memories at SDSU", slug: "college" },
};

/**
 * Fetches a gallery and its photos by slug from the Pi API.
 * Returns null on failure so we can show an empty state instead of crashing the build.
 */
async function fetchGalleryBySlug(slug: string): Promise<ApiGalleryDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/galleries/slug/${slug}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    console.warn(`could not fetch gallery "${slug}" from API — showing empty state`);
    return null;
  }
}

export default async function PeopleGallery({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const config = CATEGORY_CONFIG[category];

  if (!config) {
    notFound();
  }

  const gallery = await fetchGalleryBySlug(config.slug);
  const photos = (gallery?.photos ?? []).map((photo) => ({
    src: `${API_BASE}/galleries/photos/${photo.id}/file`,
    alt: config.title,
    caption: "",
  }));

  return (
    <PageWrapper>
      <PeopleGalleryClient
        gallery={{ title: config.title, description: config.description, photos }}
      />
    </PageWrapper>
  );
}

export async function generateStaticParams() {
  return Object.keys(CATEGORY_CONFIG).map((category) => ({ category }));
}

