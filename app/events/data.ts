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
  schedule?: string;
  highlights?: string[];
  links?: EventLink[];
  rsvpLink?: EventLink;
  rsvpNote?: string;
};

const DJ_SET_URL =
  "https://soundcloud.com/tommypips/01-dare-u-mastered/s-mx54M3H05nq?ref=clipboard&p=a&c=1&si=35b9cc96db6146089a2d14a5250edd1b&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing";

const RSVP_NOTE_COMING_SOON = "RSVP details coming soon.";
const LOCATION_TBD = "Venue TBD";
const LOCATION_FLIER = "See flier for details.";

export const EVENTS: EventEntry[] = [
  {
    slug: "milan-tyler-birthday-boogie",
    title: "Milan and Tyler Birthday Boogie and \"Welcome Back Tommy and Ruby\" Party",
    dateText: "March 28",
    locationText: "Tyler's house",
    summary: "",
    type: "info",
    schedule: "Grilling starts at sunset, boogieing at night time",
    highlights: [
      "Tommy will be DJing on Lavender Soundsystem.",
      "Synth/noise performance by Joel - likely.",
      "Perhaps some other performances.",
      "Dress theme: bug.",
      "Bring hotdogs, chips, and dips? maybe we will just get a bunch of hot dogs",
      "No phones on the dance floor, please"
    ],
    flierImage: {
      src: "/images/events/bugdj.jpg",
      alt: "Bug-themed DJ flier",
    },
    links: [
      {
        label: "Something along these lines: One of Tommy's past sets",
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
    slug: "cfp-mission-gorge-meetup",
    title: "CFP Mission Gorge Meetup",
    dateText: "March 22",
    locationText: "Mission Gorge",
    summary: "Outdoor climbing meetup at Mission Gorge.",
    type: "flier",
    flierImage: {
      src: "/images/events/outdoor_meetup.jpg",
      alt: "CFP Mission Gorge outdoor meetup flier",
    },
  },
  {
    slug: "fuck-ice-punk-fundraiser",
    title: '"Fuck Ice" Punk Concert/Fundraiser',
    dateText: "May 8",
    locationText: "Probably my house",
    summary: "Danny and Andrew will be unleashing hell",
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
