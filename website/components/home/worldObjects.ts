import worldMeta from "./world.generated.json";

/**
 * everything clickable on the home page, used by both the pixel world and the
 * list view. array order is the list-view order.
 *
 * each object has a placement per layout (desktop landscape, mobile tall
 * scroll) in that layout's backdrop pixels -- read coords straight off
 * public/images/home/world-*.png in any image editor. things standing on a
 * painted prop (grill, crate, table, lily pad...) use the same numbers as
 * scripts/generate_home_world.py, so move both together.
 */

/** where an object sits in one layout. */
export type Placement = {
  /** horizontal center, backdrop px. */
  x: number;
  /** where its feet touch the ground, backdrop px. */
  y: number;
  /** overrides the object's size for this layout only. */
  size?: number;
  /** pins the depth scale instead of deriving it from y -- for floaters and hotspots above the horizon. */
  scale?: number;
  /** exact width in backdrop px, skipping depth scaling and size -- for sprites that must fit a painted shape (the roof). */
  widthPx?: number;
};

/** one row in the list view: where it goes and what it shows. every world object is one of these. */
export type MenuEntry = {
  /** stable key, also used for the hover/selection state. */
  id: string;
  /** shown in the hover tag and as the list-view row. */
  label: string;
  /** where it goes. left out for the lucky dice, which picks a route on click. */
  href?: string;
  /** opens in a new tab when true. */
  external?: boolean;
  /** picks a random LUCKY_ROUTES page instead of following href. */
  lucky?: boolean;
  /** sprite. without one it's an invisible hotspot in the world (the cave), and a label-only row in the list view. */
  iconSrc?: string;
  /** sprite to show instead while the kiln's firing. */
  firingIconSrc?: string;
  /** sprite to show instead while the dj stream's on air. */
  liveIconSrc?: string;
};

/** one clickable thing in the world: a menu entry plus how and where it's drawn. */
export type WorldObject = MenuEntry & {
  /** multiplier on the depth-based size, for things that are small/big in real life. */
  size: number;
  /** bobs in the air with no ground shadow. */
  floating?: boolean;
  /** skips the ground shadow -- for things that aren't standing on the ground (the roof). */
  noShadow?: boolean;
  /** music notes float up off it while the dj stream is on air (the opium den's board). */
  djNotes?: boolean;
  /** a blinking LIVE! tag sits above it while the dj stream is on air (the radio tower). */
  liveTag?: boolean;
  desktop: Placement;
  mobile: Placement;
};

/** the two layouts, keyed the same as world.generated.json. */
export type LayoutName = "desktop" | "mobile";

// pages "I'm feeling lucky" can land on. hand-picked so it skips the home page
// itself plus utility pages (admin, display kiosk, confirm/success screens)
export const LUCKY_ROUTES = [
  "/events",
  "/gallery",
  "/biking",
  "/kitchen",
  "/garden",
  "/sd-workspaces",
  "/projects/ribbit-radar",
  "/solar",
  "/kiln",
  "/console",
  "/mallard",
  "/projects/trade-routes",
  "/community-board",
  "/library",
  "/public-square",
  "/projects/others",
  "/opium-den",
  "/pac-tyler",
  "/flies",
  "/monitor",
];

/**
 * rolls a random LUCKY_ROUTES page. call it on click, not render, so the
 * server-built html and the client agree and every click rolls fresh.
 *
 * @returns {string} the route to navigate to.
 */
export const pickLuckyRoute = (): string =>
  LUCKY_ROUTES[Math.floor(Math.random() * LUCKY_ROUTES.length)];

export const WORLD_OBJECTS: WorldObject[] = [
  {
    id: "lucky", label: "I'M FEELING LUCKY", lucky: true, iconSrc: "/images/8bit/dice.png", size: 0.25,
    desktop: { x: 502, y: 311 }, mobile: { x: 158, y: 883, size: 0.3 },
  },
  {
    id: "events", label: "UPCOMING EVENTS", href: "/events", iconSrc: "/images/8bit/events.png", size: 0.75,
    desktop: { x: 392, y: 146 }, mobile: { x: 280, y: 334 },
  },
  {
    id: "gallery", label: "GALLERY", href: "/gallery", iconSrc: "/images/8bit/camera.png", size: 0.75,
    desktop: { x: 44, y: 164 }, mobile: { x: 300, y: 258 },
  },
  {
    id: "biking", label: "BIKING", href: "/biking", iconSrc: "/images/8bit/bike.png", size: 1.1,
    desktop: { x: 300, y: 322 }, mobile: { x: 186, y: 520 },
  },
  {
    id: "kitchen", label: "THE KITCHEN", href: "/kitchen", iconSrc: "/images/8bit/chef.png", size: 0.6,
    desktop: { x: 80, y: 311 }, mobile: { x: 40, y: 535 },
  },
  {
    id: "garden", label: "THE GARDEN", href: "/garden", iconSrc: "/images/8bit/plant.png", size: 0.9,
    desktop: { x: 140, y: 186 }, mobile: { x: 282, y: 456 },
  },
  {
    id: "sd-workspaces", label: "SD WORKSPACES", href: "/sd-workspaces", iconSrc: "/images/8bit/coffee.png", size: 0.4,
    desktop: { x: 532, y: 311 }, mobile: { x: 200, y: 883, size: 0.5 },
  },
  {
    id: "frog", label: "FROG WORK", href: "/projects/ribbit-radar", iconSrc: "/images/8bit/crlf_8bit.png", size: 0.7,
    desktop: { x: 206, y: 263 }, mobile: { x: 124, y: 463 },
  },
  {
    // the sprite is the house roof, so it's placed from the roof footprint the generator measured
    id: "solar", label: "SOLAR SETUP", href: "/solar", iconSrc: "/images/8bit/solar.png", size: 1, noShadow: true,
    desktop: worldMeta.layouts.desktop.roof, mobile: worldMeta.layouts.mobile.roof,
  },
  {
    id: "kiln", label: "THE KILN", href: "/kiln", iconSrc: "/images/8bit/kiln-idle.png",
    firingIconSrc: "/images/8bit/kiln-firing.png", size: 1,
    desktop: { x: 372, y: 342, size: 0.85 }, mobile: { x: 292, y: 548, size: 0.9 },
  },
  {
    id: "console", label: "THE CONSOLE", href: "/console", iconSrc: "/images/8bit/console.png", size: 0.8,
    desktop: { x: 470, y: 270 }, mobile: { x: 104, y: 820, size: 1.1 },
  },
  {
    id: "mallard", label: "MALLARD COUNTER", href: "/mallard", iconSrc: "/images/8bit/mallard.png", size: 0.6,
    desktop: { x: 120, y: 252 }, mobile: { x: 60, y: 450 },
  },
  {
    id: "trade-routes", label: "TRADE ROUTES", href: "/projects/trade-routes", iconSrc: "/images/8bit/traderoutes.png", size: 1.0,
    desktop: { x: 342, y: 150 }, mobile: { x: 190, y: 198 },
  },
  {
    id: "work", label: "PROFESSIONAL SERVICES", href: "https://tylerschwenktechnical.github.io/", external: true, iconSrc: "/images/8bit/work.png", size: 0.7,
    desktop: { x: 276, y: 156 }, mobile: { x: 118, y: 204 },
  },
  {
    id: "community-board", label: "COMMUNITY BOARD", href: "/community-board", iconSrc: "/images/8bit/community.png", size: 1.2,
    desktop: { x: 276, y: 228 }, mobile: { x: 80, y: 350 },
  },
  {
    id: "library", label: "THE LIBRARY", href: "/library", iconSrc: "/images/8bit/library.png", size: 0.8,
    desktop: { x: 568, y: 270 }, mobile: { x: 254, y: 820, size: 1.1 },
  },
  {
    id: "flies", label: "FLY KILL COUNT", href: "/flies", iconSrc: "/images/8bit/fly.png", size: 0.35,
    desktop: { x: 600, y: 334 }, mobile: { x: 310, y: 905, size: 0.45 },
  },
  {
    // on the floor by the console, across the rug from the fly
    id: "monitor", label: "SYSTEM MONITOR", href: "/monitor", iconSrc: "/images/8bit/pi.png", size: 0.5,
    desktop: { x: 438, y: 334 }, mobile: { x: 60, y: 905, size: 0.6 },
  },
  {
    id: "round-table", label: "ROUND TABLE", href: "/public-square", iconSrc: "/images/8bit/round_table.png", size: 1.3,
    desktop: { x: 240, y: 172 }, mobile: { x: 80, y: 266 },
  },
  {
    id: "inspiration", label: "INSPIRATION/MISC", href: "/projects/others", iconSrc: "/images/8bit/lightbulb.png", size: 1.0, floating: true,
    desktop: { x: 300, y: 96, scale: 0.55 }, mobile: { x: 150, y: 110, scale: 0.7 },
  },
  {
    // the dj board sits on the cave floor, sized to fit inside the mouth the generator paints
    // (draw_cave: desktop 40px wide at (614, 118), mobile 36px at (300, 168))
    id: "opium-den", label: "ENTER THE VIRTUAL OPIUM DEN", href: "/opium-den", iconSrc: "/images/8bit/dj_board.png",
    size: 1, noShadow: true, djNotes: true,
    desktop: { x: 614, y: 116, widthPx: 32 }, mobile: { x: 300, y: 166, widthPx: 28 },
  },
  {
    // the den's broadcast tower, on the hill just left of the cave. above the horizon on
    // desktop, so its scale is pinned like the lightbulb's
    id: "live-room", label: "LIVE FROM THE OPIUM DEN", href: "/opium-den/live",
    iconSrc: "/images/8bit/radio-tower-idle.png", liveIconSrc: "/images/8bit/radio-tower-live.png",
    size: 0.55, liveTag: true,
    desktop: { x: 566, y: 112, scale: 0.6 }, mobile: { x: 252, y: 166 },
  },
];

/**
 * pages that are only in the list view, not the pixel world. a page sits here
 * while it's waiting on its sprite, then moves into WORLD_OBJECTS.
 */
export const LIST_ONLY_ENTRIES: MenuEntry[] = [
  { id: "mic", label: "THE MILITARY-INDUSTRIAL COMPLEX", href: "/mic" },
];

/** every list-view row, in order: the world objects, then the list-only pages. */
export const MENU_ENTRIES: MenuEntry[] = [...WORLD_OBJECTS, ...LIST_ONLY_ENTRIES];

/** what's going on in the house right now, which some objects show with a different sprite. */
export type WorldState = {
  /** the kiln's firing. */
  kilnFiring: boolean;
  /** the dj stream's on air. */
  djLive: boolean;
};

/**
 * picks which sprite an object shows right now.
 *
 * @param {MenuEntry} obj - the object.
 * @param {WorldState} state - whether the kiln's firing and the stream's live.
 * @returns {string | undefined} the sprite's url, undefined for an invisible hotspot.
 */
export const currentIconSrc = (obj: MenuEntry, state: WorldState): string | undefined => {
  if (state.kilnFiring && obj.firingIconSrc) return obj.firingIconSrc;
  if (state.djLive && obj.liveIconSrc) return obj.liveIconSrc;
  return obj.iconSrc;
};
