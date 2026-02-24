export type EventType = "flier" | "info";

export type EventLink = {
  label: string;
  href: string;
};

export type EventFlier = {
  src: string;
  alt: string;
};

export type EventEntry = {
  slug: string;
  title: string;
  dateText: string;
  locationText: string;
  summary: string;
  type: EventType;
  flierImage?: EventFlier;
  highlights?: string[];
  links?: EventLink[];
  rsvpLink?: EventLink;
  rsvpNote?: string;
};

const DJ_SET_URL =
  "https://soundcloud.com/byrdmp3/spectrum-techno-presents-live-from-the-techno-jungle-w-tommypips";

const RSVP_NOTE_COMING_SOON = "RSVP details coming soon.";
const LOCATION_TBD = "Venue TBD";
const LOCATION_FLIER = "See flier for details.";

export const EVENTS: EventEntry[] = [
  {
    slug: "milan-tyler-birthday-boogie",
    title: "Milan and Tyler Birthday Boogie",
    dateText: "March 28 (time TBD)",
    locationText: "Tyler's house",
    summary: "",
    type: "info",
    highlights: [
      "Tommy will be DJing.",
      "Dress theme: bug.",
      "Bring hotdogs, chips, and dips.",
    ],
    flierImage: {
      src: "/images/events/bugdj.jpg",
      alt: "Bug-themed DJ flier",
    },
    links: [
      {
        label: "DJ set: Spectrum Techno - Live from the Techno Jungle",
        href: DJ_SET_URL,
      },
    ],
    rsvpLink: {
      label: "Sign up for the address and updates",
      href: "https://docs.google.com/forms/d/e/1FAIpQLSe-ii0Tmz8NirCj6zehC-iCFb9WgKtMiYBoZ2xOxojGABI_8A/viewform?usp=publish-editor",
    },
  },
  {
    slug: "climbers-for-palestine-meetup",
    title: "Climbers for Palestine Meetups",
    dateText: "Tuesdays, 6:30 PM",
    locationText: "Mesa Rim Mission Valley",
    summary: "Climbing meetups at the gym - every damn tuesday",
    type: "flier",
    flierImage: {
      src: "/images/events/mv_meetup.png",
      alt: "Climbers for Palestine meetup flier",
    },
    links: [
      {
        label: "Instagram: climbersforpalestine_sd",
        href: "https://www.instagram.com/climbersforpalestine_sd/",
      },
      {
        label: "Join WhatsApp group",
        href: "https://chat.whatsapp.com/Dr2rt7Z9Myt19BRtcGPm50",
      },
    ],
  },
  {
    slug: "fuck-ice-punk-fundraiser",
    title: "Fuck Ice Punk Concert/Fundraiser",
    dateText: "April 4 (details TBD)",
    locationText: LOCATION_TBD,
    summary: "Concert and fundraiser. More details coming soon.",
    type: "info",
    rsvpNote: RSVP_NOTE_COMING_SOON,
  },
];

/**
 * Finds an event entry by slug.
 *
 * @param {string} slug - Event slug from the route.
 * @returns {EventEntry | undefined} The matching event or undefined.
 */
export function getEventBySlug(slug: string): EventEntry | undefined {
  return EVENTS.find((event) => event.slug === slug);
}
