/**
 * everything clickable on the home page, used by both the pixel world and the
 * list view. array order is the list-view order.
 *
 * positions are percents of the world box: `x` is the sprite's horizontal
 * center, `y` is where its feet touch the ground. they're lined up with the
 * landmarks painted by scripts/generate_home_world.py (pond, deck, crate...),
 * so if you move one there, move it here too.
 */

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
  /** percent of the sprite's height that's transparent below the art, so its feet can be pulled down onto the ground. */
  footPad?: number;
  /** horizontal center, percent of world width. */
  x: number;
  /** ground contact point, percent of world height. */
  y: number;
  /** multiplier on the depth-based size, for things that are small/big in real life. */
  size: number;
  /** bobs in the air with no ground shadow. */
  floating?: boolean;
  /** pins the depth scale instead of deriving it from y -- for floaters and hotspots above the horizon. */
  scale?: number;
};

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
  { id: "lucky", label: "I'M FEELING LUCKY", lucky: true, iconSrc: "/images/8bit/dice.png", footPad: 0, x: 29.7, y: 95.6, size: 0.55 },
  { id: "events", label: "UPCOMING EVENTS", href: "/events", iconSrc: "/images/8bit/events.png", footPad: 18, x: 64.1, y: 51.6, size: 0.75 },
  { id: "gallery", label: "GALLERY", href: "/gallery", iconSrc: "/images/8bit/camera.png", footPad: 24, x: 7.5, y: 46.2, size: 0.75 },
  { id: "biking", label: "BIKING", href: "/biking", iconSrc: "/images/8bit/bike.png", footPad: 23, x: 46.9, y: 88.9, size: 1.1 },
  { id: "kitchen", label: "THE KITCHEN", href: "/kitchen", iconSrc: "/images/8bit/chef.png", footPad: 7, x: 12.5, y: 88.3, size: 0.6 },
  { id: "garden", label: "THE GARDEN", href: "/garden", iconSrc: "/images/8bit/plant.png", footPad: 14, x: 79.7, y: 58.3, size: 0.9 },
  { id: "sd-workspaces", label: "SD WORKSPACES", href: "/sd-workspaces", iconSrc: "/images/8bit/coffee.png", footPad: 1, x: 66.6, y: 96.7, size: 0.5 },
  { id: "frog", label: "FROG WORK", href: "/projects/ribbit-radar", iconSrc: "/images/8bit/crlf_8bit.png", footPad: 25, x: 31.2, y: 72.4, size: 0.7 },
  { id: "solar", label: "SOLAR SETUP", href: "/solar", iconSrc: "/images/solar/solar_icon.png", footPad: 22, x: 92.5, y: 58.3, size: 1.0 },
  { id: "console", label: "THE CONSOLE", href: "/console", iconSrc: "/images/8bit/console.png", footPad: 0, x: 88.1, y: 92.2, size: 1.1 },
  { id: "mallard", label: "MALLARD COUNTER", href: "/mallard", iconSrc: "/images/8bit/mallard_8bit.png", footPad: 18, x: 18.7, y: 69.4, size: 0.75 },
  { id: "trade-routes", label: "TRADE ROUTES", href: "/projects/trade-routes", iconSrc: "/images/8bit/traderoutes.png", footPad: 11, x: 53.7, y: 41.6, size: 1.0 },
  { id: "work", label: "PROFESSIONAL SERVICES", href: "https://tylerschwenktechnical.github.io/", external: true, iconSrc: "/images/8bit/work.png", footPad: 24, x: 43.7, y: 43.3, size: 0.7 },
  { id: "community-board", label: "COMMUNITY BOARD", href: "/community-board", iconSrc: "/images/8bit/community.png", footPad: 3, x: 42.5, y: 61.1, size: 1.2 },
  { id: "library", label: "THE LIBRARY", href: "/library", iconSrc: "/images/8bit/library.png", footPad: 0, x: 74.4, y: 88.9, size: 1.1 },
  { id: "round-table", label: "ROUND TABLE", href: "/public-square", iconSrc: "/images/8bit/round_table.png", footPad: 16, x: 37.5, y: 48.3, size: 1.3 },
  { id: "inspiration", label: "INSPIRATION/MISC", href: "/projects/others", iconSrc: "/images/8bit/lightbulb.png", footPad: 20, x: 37.5, y: 30.0, size: 1.0, floating: true, scale: 0.55 },
  { id: "opium-den", label: "ENTER THE VIRTUAL OPIUM DEN", href: "/opium-den", x: 88.1, y: 32.2, size: 0.7, scale: 1 },
];
