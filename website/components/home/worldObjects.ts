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
};

/** one clickable thing in the world. */
export type WorldObject = {
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
  /** sprite. without one it's an invisible hotspot over the painted backdrop (the cave). */
  iconSrc?: string;
  /** multiplier on the depth-based size, for things that are small/big in real life. */
  size: number;
  /** bobs in the air with no ground shadow. */
  floating?: boolean;
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
  "/console",
  "/mallard",
  "/projects/trade-routes",
  "/community-board",
  "/library",
  "/public-square",
  "/projects/others",
  "/opium-den",
  "/pac-tyler",
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
    id: "lucky", label: "I'M FEELING LUCKY", lucky: true, iconSrc: "/images/8bit/dice.png", size: 0.55,
    desktop: { x: 190, y: 344 }, mobile: { x: 290, y: 610 },
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
    desktop: { x: 300, y: 322 }, mobile: { x: 178, y: 600 },
  },
  {
    id: "kitchen", label: "THE KITCHEN", href: "/kitchen", iconSrc: "/images/8bit/chef.png", size: 0.6,
    desktop: { x: 80, y: 311 }, mobile: { x: 64, y: 565 },
  },
  {
    id: "garden", label: "THE GARDEN", href: "/garden", iconSrc: "/images/8bit/plant.png", size: 0.9,
    desktop: { x: 140, y: 186 }, mobile: { x: 282, y: 456 },
  },
  {
    id: "sd-workspaces", label: "SD WORKSPACES", href: "/sd-workspaces", iconSrc: "/images/8bit/coffee.png", size: 0.4,
    desktop: { x: 518, y: 311 }, mobile: { x: 180, y: 883, size: 0.5 },
  },
  {
    id: "frog", label: "FROG WORK", href: "/projects/ribbit-radar", iconSrc: "/images/8bit/crlf_8bit.png", size: 0.7,
    desktop: { x: 206, y: 263 }, mobile: { x: 124, y: 463 },
  },
  {
    id: "solar", label: "SOLAR SETUP", href: "/solar", iconSrc: "/images/8bit/solar.png", size: 0.8,
    desktop: { x: 480, y: 170 }, mobile: { x: 120, y: 662 },
  },
  {
    id: "console", label: "THE CONSOLE", href: "/console", iconSrc: "/images/8bit/console.png", size: 0.8,
    desktop: { x: 470, y: 270 }, mobile: { x: 104, y: 820, size: 1.1 },
  },
  {
    id: "mallard", label: "MALLARD COUNTER", href: "/mallard", iconSrc: "/images/8bit/mallard_8bit.png", size: 0.75,
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
    id: "round-table", label: "ROUND TABLE", href: "/public-square", iconSrc: "/images/8bit/round_table.png", size: 1.3,
    desktop: { x: 240, y: 172 }, mobile: { x: 80, y: 266 },
  },
  {
    id: "inspiration", label: "INSPIRATION/MISC", href: "/projects/others", iconSrc: "/images/8bit/lightbulb.png", size: 1.0, floating: true,
    desktop: { x: 300, y: 96, scale: 0.55 }, mobile: { x: 150, y: 110, scale: 0.7 },
  },
  {
    id: "opium-den", label: "ENTER THE VIRTUAL OPIUM DEN", href: "/opium-den", size: 0.7,
    desktop: { x: 564, y: 118, scale: 1 }, mobile: { x: 300, y: 168, scale: 1, size: 0.45 },
  },
];
