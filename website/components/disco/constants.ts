// everything the disco december invite needs to agree on: media paths, the
// timing that lines the video up with the cloud loop, and the video's look.

const MEDIA_DIR = "/video/disco";

/** the full invite video. phones get the 720p cut since they're likely on cell data */
export const INVITE_VIDEO_DESKTOP_SRC = `${MEDIA_DIR}/invite-1080.mp4`;
export const INVITE_VIDEO_MOBILE_SRC = `${MEDIA_DIR}/invite-720.mp4`;

/** one second, 30 frame seamless loop of the hand drawn clouds from the end of the video */
export const CLOUD_LOOP_WEBM_SRC = `${MEDIA_DIR}/clouds-loop.webm`;
export const CLOUD_LOOP_MP4_SRC = `${MEDIA_DIR}/clouds-loop.mp4`;
export const CLOUD_LOOP_POSTER_SRC = `${MEDIA_DIR}/clouds-poster.jpg`;

/**
 * the attire clip: three archival disco floor clips, crossfaded one after another
 * into one loop. cropped square (clear of the station logo), 360px, silent.
 */
export const ATTIRE_CLIP = {
  webmSrc: `${MEDIA_DIR}/attire.webm`,
  mp4Src: `${MEDIA_DIR}/attire.mp4`,
  posterSrc: `${MEDIA_DIR}/attire.jpg`,
};

/**
 * the moment in the invite video where the cloud drawing matches frame 0 of the
 * loop. swapping to the loop here is invisible. after this the video's clouds
 * fade to black, but its audio keeps going, so the video plays on underneath.
 */
export const CLOUD_HANDOFF_S = 58.61;

/** pause on the clouds after the video's audio ends, before they part */
export const PART_DELAY_MS = 900;

/** how long the clouds take to slide apart */
export const PART_DURATION_MS = 2600;

/** the event this invite is for, looked up in app/events/data.ts */
export const DISCO_EVENT_SLUG = "disco";

/** the page's own path, printed on the saved card */
export const DISCO_PAGE_URL_TEXT = "tyler-schwenk.com/events/disco";

/**
 * the title palette from the invite video. letters cycle through these in order,
 * so neighbours never share a color.
 */
export const DISCO_LETTER_COLORS = [
  "#4a3cf0", // electric blue
  "#f3c4dc", // pale pink
  "#b456ea", // violet
  "#f27fe6", // hot pink
  "#fdf2fa", // near white
  "#e3a0d8", // dusty pink
] as const;

/** the ornament colors: lime and blue concentric squares, teal diamonds */
export const ORNAMENT_LIME = "#a6e25b";
export const ORNAMENT_BLUE = "#3d5be8";
export const ORNAMENT_TEAL = "#4fb39a";

/** the deep blue of the video's starry space scene, used behind the flier */
export const NIGHT_SKY_TOP = "#0b0d3f";
export const NIGHT_SKY_BOTTOM = "#1c0f45";

/** the snoopy dance floor: hot pink tiles, dark grout, and the colors the tiles light up in */
export const FLOOR_PINK = "#e8318a";
export const FLOOR_GROUT = "#6e0f45";
export const FLOOR_LIGHT_COLORS = ["#ff3b3b", "#ff8a1f", "#ffd23a", "#2fb39a", "#6a3cf0"] as const;

/** squares in the box ornament row, and diamonds in the saved card's diamond row, same as the video */
export const BOX_ROW_COUNT = 13;
export const DIAMOND_ROW_COUNT = 12;

/** everything the flier says besides the title */
export const DISCO_DETAILS = {
  date: "Saturday, Dec. 12th",
  time: "8pm",
  addressStreet: "5375 Hewlett Dr",
  addressCity: "San Diego, CA 92115",
  lineup: { dancefloor: "Dancefloor DJs", den: "Ambient Den" },
  attire: "Bell bottoms + dancing shoes",
  phones: "iPhones haven’t been invented yet",
} as const;

/** the full address, for the maps link */
export const DISCO_ADDRESS = `${DISCO_DETAILS.addressStreet}, ${DISCO_DETAILS.addressCity}`;

/** one entry in the more info section: a heading, with a line under it if it needs one */
export interface MoreInfoItem {
  heading: string;
  text?: string;
}

/**
 * the extra details below the poster, past the scroll. the poster holds what fits
 * in one screenshot; anything longer goes here.
 */
export const DISCO_MORE_INFO: readonly MoreInfoItem[] = [
  { heading: "BYOB" },
  {
    heading: "Coming from out of town?",
    text: "Feel free to reach out to me and we’ll make sure there’s space for you to stay in the Opium Den.",
  },
];
