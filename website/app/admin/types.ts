/**
 * Shapes of what the admin page reads from the backend (see
 * pi/docs/api/website-backend-api.md). Only the fields the page uses.
 */

/** One person on the Home tab (GET /presence). */
export interface PresencePerson {
  name: string;
  /** Epoch ms their phone last answered, null if not since the agent started. */
  last_seen_ms: number | null;
  /** Epoch ms their phone came back after being away, null if no arrival seen since the backend started. */
  arrived_at_ms: number | null;
  home: boolean;
}

/** Who's home (GET /presence). */
export interface PresenceState {
  agent_online: boolean;
  /** The backend's clock, epoch ms. */
  now_ms: number;
  /** How long a phone can be silent before its owner counts as away. */
  away_after_ms: number;
  people: PresencePerson[];
}

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
