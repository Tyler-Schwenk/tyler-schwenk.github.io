"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WORLD_OBJECTS, pickLuckyRoute, type WorldObject } from "./worldObjects";

const WORLD_BACKDROP_SRC = "/images/home/world.png";

// matches HORIZON_Y_PX / WORLD_H_PX in scripts/generate_home_world.py
const HORIZON_PCT = 34.4;

// sprites on the horizon render at MIN, ones at the bottom edge at MAX. scaling
// by distance is what sells the fake 3D
const MIN_DEPTH_SCALE = 0.4;
const MAX_DEPTH_SCALE = 1.2;

// sprite width at depth scale 1 and size 1, as a percent of world width
const BASE_SPRITE_WIDTH_PCT = 10;

// sprites' source art is 112px; only used for next/image's aspect hint
const SPRITE_SOURCE_PX = 112;

// objects this close to a side edge anchor their name tag to that edge so it doesn't get clipped
const TAG_EDGE_MARGIN_PCT = 15;

/**
 * how big an object draws based on how far back it sits.
 *
 * @param {WorldObject} obj - the object to size.
 * @returns {number} depth scale, MIN_DEPTH_SCALE on the horizon up to MAX_DEPTH_SCALE at the bottom edge.
 */
const depthScale = (obj: WorldObject): number => {
  if (obj.scale !== undefined) return obj.scale;
  const t = (obj.y - HORIZON_PCT) / (100 - HORIZON_PCT);
  return MIN_DEPTH_SCALE + t * (MAX_DEPTH_SCALE - MIN_DEPTH_SCALE);
};

/**
 * tailwind classes that line an object's name tag up with it, or with the
 * nearest edge if it's close to one.
 *
 * @param {number} x - the object's horizontal center, percent of world width.
 * @returns {string} positioning classes for the tag.
 */
const tagAlignClasses = (x: number): string => {
  if (x < TAG_EDGE_MARGIN_PCT) return "left-0";
  if (x > 100 - TAG_EDGE_MARGIN_PCT) return "right-0";
  return "left-1/2 -translate-x-1/2";
};

/**
 * the home page as a little pixel-art world -- every section is an object
 * sitting somewhere in the scene, and clicking one goes there.
 *
 * on mouse, hovering lights an object up and shows its name. on touch there's
 * no hover, so the first tap does the lighting up and the second tap goes.
 * on narrow screens the world keeps its height and scrolls sideways instead of
 * shrinking to a sliver, starting centered.
 *
 * @returns {JSX.Element} the scrollable world.
 */
export default function HomeWorld() {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastPointerType = useRef<string>("mouse");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
  }, []);

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

  // draw back to front so nearer things overlap farther ones
  const objectsByDepth = [...WORLD_OBJECTS].sort((a, b) => a.y - b.y);

  return (
    <div
      ref={scrollerRef}
      className="w-full overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
    >
      <div
        className="relative mx-auto aspect-video w-[calc(72svh*16/9)] md:w-[min(96vw,calc(82svh*16/9))] border-4 border-black shadow-2xl overflow-hidden bg-[#62bc58]"
        onClick={(event) => {
          if (event.target === event.currentTarget) setSelectedId(null);
        }}
      >
        <Image
          src={WORLD_BACKDROP_SRC}
          alt="pixel-art meadow with a pond, a dirt path, a garden, a wooden deck, and a glowing cave in the hills"
          fill
          priority
          className="pixelated object-cover pointer-events-none select-none"
        />

        <p className="absolute top-[3%] left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none pixel-font text-[9px] md:text-xs text-[#F8D030] drop-shadow-[2px_2px_0_rgba(0,0,0,1)] animate-pulse">
          <span className="[@media(hover:none)]:hidden">CLICK SOMETHING TO EXPLORE</span>
          <span className="[@media(hover:hover)]:hidden">TAP TO LOOK, TAP AGAIN TO GO</span>
        </p>

        {objectsByDepth.map((obj) => (
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
  const widthPct = BASE_SPRITE_WIDTH_PCT * depthScale(obj) * obj.size;
  const shared = {
    className: "world-object absolute block -translate-x-1/2 -translate-y-full cursor-pointer",
    style: { left: `${obj.x}%`, top: `${obj.y}%`, width: `${widthPct}%`, zIndex: Math.round(obj.y * 10) },
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
              style={{ transform: `translateY(${obj.footPad ?? 0}%)` }}
            />
          ) : (
            <span className="world-hotspot block aspect-square border-2 border-dashed border-transparent" />
          )}
        </span>
      </span>

      <span
        aria-hidden="true"
        className={`world-tag absolute bottom-full mb-1 ${tagAlignClasses(obj.x)} whitespace-nowrap pointer-events-none pixel-font text-[8px] md:text-[10px] text-[#F8D030] bg-[#3850A0] border-2 border-black px-2 py-1 shadow-[2px_2px_0_rgba(0,0,0,1)]`}
      >
        {obj.label}
      </span>
    </>
  );
}
