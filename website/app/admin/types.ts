/**
 * Shapes of what the admin page reads from the backend (see
 * pi/docs/api/website-backend-api.md). Only the fields the page uses.
 */

export interface Gallery {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  display_order: number;
  photo_count: number | null;
}

export interface GalleryPhoto {
  id: number;
}

export interface Video {
  id: number;
  title: string;
  slug: string;
  is_public: boolean;
  /** Seconds. */
  duration: number | null;
}

export interface Rsvp {
  id: number;
  event_slug: string;
  name: string | null;
  contact_type: string;
  contact_value: string;
  friends_count: number;
  wants_address: boolean;
  wants_reminder: boolean;
  created_at: string;
}

export interface SquarePost {
  id: number;
  title: string;
  content: string;
  score: number;
  nickname: string | null;
  comment_count: number;
  created_at: string;
}

export interface SquareComment {
  id: number;
  content: string;
  score: number;
  nickname: string | null;
  created_at: string;
}
