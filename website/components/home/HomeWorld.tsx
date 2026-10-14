"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties } from "react";
import worldMeta from "./world.generated.json";
import { WORLD_OBJECTS, pickLuckyRoute, type LayoutName, type WorldObject } from "./worldObjects";

/** how sprites scale with depth in each layout. */
type DepthTuning = {
  /** scale for something sitting right on the horizon. */
  minScale: number;
  /** scale for something at the bottom edge. */
  maxScale: number;
  /** sprite width at scale 1 and size 1, as a percent of the world width. */
  baseSpriteWidthPct: number;
};

// desktop leans hard on shrink-with-distance to sell the fake 3D. mobile keeps
// things big since the screen's narrow and fingers need something to hit
const DEPTH_TUNING: Record<LayoutName, DepthTuning> = {
  desktop: { minScale: 0.4, maxScale: 1.2, baseSpriteWidthPct: 10 },
  mobile: { minScale: 0.7, maxScale: 1.0, baseSpriteWidthPct: 22 },
};

const LAYOUT_NAMES: LayoutName[] = ["desktop", "mobile"];

// css var prefix per layout -- globals.css reads --m-* by default and --d-* from md up
const VAR_PREFIX: Record<LayoutName, string> = { desktop: "--d", mobile: "--m" };

// matches tailwind's md breakpoint, where globals.css switches to the --d-* vars
const DESKTOP_MEDIA_QUERY = "(min-width: 48rem)";

// sprites' source art is 112px; only used for next/image's aspect hint
const SPRITE_SOURCE_PX = 112;

// objects this close to a side edge anchor their name tag to that edge so it doesn't get clipped
const TAG_EDGE_MARGIN_PCT = 15;

// depth sorts by y, times this, so z-indexes stay whole numbers but keep sub-pixel order
const Z_INDEX_PER_PX = 10;

const FOOT_PADS: Record<string, number> = worldMeta.footPads;

/**
 * where a name tag sits relative to its object, as css values.
 *
 * @param {number} xPct - the object's horizontal center, percent of world width.
 * @returns {{left: string, right: string, shift: string}} tag left/right and horizontal translate.
 */
const tagPosition = (xPct: number) => {
  if (xPct < TAG_EDGE_MARGIN_PCT) return { left: "0", right: "auto", shift: "0" };
  if (xPct > 100 - TAG_EDGE_MARGIN_PCT) return { left: "auto", right: "0", shift: "0" };
  return { left: "50%", right: "auto", shift: "-50%" };
};

/**
 * css custom properties placing an object in one layout: position, width,
 * stacking, and name-tag anchoring. globals.css picks which layout's vars apply.
 *
 * @param {WorldObject} obj - the object to place.
 * @param {LayoutName} layoutName - which layout to compute for.
 * @returns {Record<string, string>} vars like --d-left, --d-width, --d-z.
 */
const layoutVars = (obj: WorldObject, layoutName: LayoutName): Record<string, string> => {
  const layout = worldMeta.layouts[layoutName];
  const tuning = DEPTH_TUNING[layoutName];
  const placement = obj[layoutName];

  const depthT = (placement.y - layout.horizonPx) / (layout.heightPx - layout.horizonPx);
  const scale = placement.scale ?? tuning.minScale + depthT * (tuning.maxScale - tuning.minScale);
  const widthPct = tuning.baseSpriteWidthPct * scale * (placement.size ?? obj.size);
  const xPct = (placement.x / layout.widthPx) * 100;
  const tag = tagPosition(xPct);
  const prefix = VAR_PREFIX[layoutName];

  return {
    [`${prefix}-left`]: `${xPct}%`,
    [`${prefix}-top`]: `${(placement.y / layout.heightPx) * 100}%`,
    [`${prefix}-width`]: `${widthPct}%`,
    [`${prefix}-z`]: `${Math.round(placement.y * Z_INDEX_PER_PX)}`,
    [`${prefix}-tag-left`]: tag.left,
    [`${prefix}-tag-right`]: tag.right,
    [`${prefix}-tag-shift`]: tag.shift,
  };
};

/**
 * the home page as a little pixel-art world -- every section is an object
 * sitting somewhere in the scene, and clicking one goes there.
 *
 * there are two scenes: a wide landscape from tailwind's md breakpoint up,
 * and a tall one on phones that you scroll down through. both render from the
 * same elements -- each object carries css vars for both placements and
 * globals.css switches between them, and the backdrop is a <picture> so the
 * browser only downloads the one it needs.
 *
 * on mouse, hovering lights an object up and shows its name. on touch there's
 * no hover, so the first tap does the lighting up and the second tap goes.
 *
 * @returns {JSX.Element} the world.
 */
export default function HomeWorld() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastPointerType = useRef("mouse");
  const { desktop, mobile } = worldMeta.layouts;

  /**
   * click handler shared by every object. swallows the first touch tap so it
   * only selects, and rolls the dice for the lucky object.
   *
   * @param {React.MouseEvent} event - the click.
   * @param {WorldObject} obj - the object that was clicked.
   */
  const handleActivate = (event: React.MouseEvent, obj: WorldObject) => {
    if (lastPointerType.current === "touch" && selectedId !== obj.id) {
      event.preventDefault();
      setSelectedId(obj.id);
      return;
    }
    if (obj.lucky) router.push(pickLuckyRoute());
  };

  const sceneVars = {
    "--m-aspect": `${mobile.widthPx} / ${mobile.heightPx}`,
    "--d-aspect": `${desktop.widthPx} / ${desktop.heightPx}`,
  } as CSSProperties;

  return (
    <div
      className="world-scene relative w-full border-y-4 md:border-4 border-black shadow-2xl overflow-hidden bg-[#62bc58]"
      style={sceneVars}
      onClick={(event) => {
        if (event.target === event.currentTarget) setSelectedId(null);
      }}
    >
      <picture>
        <source media={DESKTOP_MEDIA_QUERY} srcSet={desktop.backdropSrc} />
        {/* plain img on purpose: next/image can't do art direction, and <picture> is
            what keeps phones from downloading the desktop scene and vice versa */}
        <img
          src={mobile.backdropSrc}
          alt="pixel-art meadow with a pond, a dirt path, a garden, a cutaway house, and a glowing cave in the hills"
          className="pixelated absolute inset-0 w-full h-full pointer-events-none select-none"
          draggable={false}
        />
      </picture>

      <p className="absolute top-[1%] md:top-[3%] left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none pixel-font text-[9px] md:text-xs text-[#F8D030] drop-shadow-[2px_2px_0_rgba(0,0,0,1)] animate-pulse text-center">
        <span className="[@media(hover:none)]:hidden">CLICK SOMETHING TO EXPLORE</span>
        <span className="[@media(hover:hover)]:hidden">TAP TO LOOK, TAP AGAIN TO GO</span>
      </p>

      {WORLD_OBJECTS.map((obj) => (
        <WorldObjectLink
          key={obj.id}
          obj={obj}
          selected={selectedId === obj.id}
          onPointerDown={(event) => {
            lastPointerType.current = event.pointerType;
          }}
          onKeyDown={() => {
            lastPointerType.current = "keyboard";
          }}
          onClick={(event) => handleActivate(event, obj)}
        />
      ))}
    </div>
  );
}

/**
 * one object placed in the world: shadow, sprite (or invisible hotspot), and
 * name tag, wrapped in whatever element fits -- a button for the lucky dice,
 * a new-tab link for external sites, a Next link otherwise.
 *
 * @param {object} props - component props.
 * @param {WorldObject} props.obj - what to draw and where it goes.
 * @param {boolean} props.selected - lit up from a first touch tap.
 * @param {Function} props.onPointerDown - records the pointer type for tap-to-select.
 * @param {Function} props.onKeyDown - marks keyboard use so enter goes straight through.
 * @param {Function} props.onClick - shared activate handler.
 * @returns {JSX.Element} the positioned, clickable object.
 */
function WorldObjectLink({
  obj,
  selected,
  onPointerDown,
  onKeyDown,
  onClick,
}: {
  obj: WorldObject;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
  onKeyDown: () => void;
  onClick: (event: React.MouseEvent) => void;
}) {
  const vars = Object.assign({}, ...LAYOUT_NAMES.map((name) => layoutVars(obj, name)));
  const shared = {
    className: "world-object absolute block -translate-x-1/2 -translate-y-full cursor-pointer",
    style: vars as CSSProperties,
    "aria-label": obj.label,
    "data-selected": selected,
    onPointerDown,
    onKeyDown,
    onClick,
  };
  const body = <WorldObjectBody obj={obj} />;

  if (obj.lucky) {
    return (
      <button type="button" {...shared}>
        {body}
      </button>
    );
  }
  if (obj.external) {
    return (
      <a href={obj.href} target="_blank" rel="noopener noreferrer" {...shared}>
        {body}
      </a>
    );
  }
  return (
    <Link href={obj.href ?? "/"} {...shared}>
      {body}
    </Link>
  );
}

/**
 * the visible parts of a world object, with no click behavior of its own.
 *
 * @param {object} props - component props.
 * @param {WorldObject} props.obj - the object to draw.
 * @returns {JSX.Element} shadow + sprite/hotspot + name tag.
 */
function WorldObjectBody({ obj }: { obj: WorldObject }) {
  // pull the art down past its transparent padding so its feet land on the spot
  const footPad = obj.iconSrc ? (FOOT_PADS[obj.iconSrc] ?? 0) : 0;

  return (
    <>
      {!obj.floating && obj.iconSrc && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3/4 aspect-[4/1] rounded-[50%] bg-black/25 pointer-events-none" />
      )}

      <span className="world-lift block">
        <span className={`block ${obj.floating ? "world-float" : ""}`}>
          {obj.iconSrc ? (
            <Image
              src={obj.iconSrc}
              alt=""
              width={SPRITE_SOURCE_PX}
              height={SPRITE_SOURCE_PX}
              draggable={false}
              className="world-sprite pixelated block w-full h-auto select-none"
              style={{ transform: `translateY(${footPad}%)` }}
            />
          ) : (
            <span className="world-hotspot block aspect-square border-2 border-dashed border-transparent" />
          )}
        </span>
      </span>

      <span
        aria-hidden="true"
        className="world-tag absolute bottom-full mb-1 whitespace-nowrap pointer-events-none pixel-font text-[8px] md:text-[10px] text-[#F8D030] bg-[#3850A0] border-2 border-black px-2 py-1 shadow-[2px_2px_0_rgba(0,0,0,1)]"
      >
        {obj.label}
      </span>
    </>
  );
}
