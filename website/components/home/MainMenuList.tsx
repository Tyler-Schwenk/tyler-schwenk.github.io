"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WORLD_OBJECTS, pickLuckyRoute, type WorldObject } from "./worldObjects";

const MENU_ICON_PX = 48;

/**
 * the classic retro main menu -- a scrollable list of every world object.
 * it's the home page's "list view" for anyone who'd rather not hunt around the world.
 *
 * @returns {JSX.Element} the menu screen.
 */
export default function MainMenuList() {
  return (
    <div className="bg-[#3850A0] border-4 border-black p-6 relative flex flex-col min-h-[80vh] max-h-[90vh] shadow-2xl">
      {/* scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)" }}
      />

      <div className="mb-6 flex-shrink-0 relative z-10">
        <h1 className="text-3xl md:text-5xl font-bold text-[#F8D030] text-center pixel-font tracking-wider drop-shadow-[3px_3px_0_rgba(0,0,0,1)]">
          MAIN MENU
        </h1>
      </div>

      <div className="relative flex-1 min-h-0 z-10">
        <div className="absolute inset-0 overflow-y-auto pb-16 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="space-y-2">
            <div className="mb-4 text-center">
              <p className="text-[#F8D030] pixel-font text-sm animate-pulse drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]">
                ▼ SELECT OPTION ▼
              </p>
            </div>
            {WORLD_OBJECTS.map((obj) => (
              <MenuOption key={obj.id} obj={obj} />
            ))}
          </div>
        </div>

        {/* fade + arrow hinting there's more below */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#3850A0] to-transparent pointer-events-none" />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="text-[#F8D030] pixel-font text-xs animate-bounce opacity-70">▼</div>
        </div>
      </div>
    </div>
  );
}

/**
 * one menu entry -- a link, a new-tab link, or the lucky dice button.
 *
 * @param {object} props - component props.
 * @param {WorldObject} props.obj - the object this row stands for.
 * @returns {JSX.Element} the clickable row.
 */
function MenuOption({ obj }: { obj: WorldObject }) {
  const router = useRouter();
  const row = <MenuRow iconSrc={obj.iconSrc}>{obj.label}</MenuRow>;

  if (obj.lucky) {
    return (
      <button type="button" onClick={() => router.push(pickLuckyRoute())} className="block w-full text-left">
        {row}
      </button>
    );
  }
  if (obj.external) {
    return (
      <a href={obj.href} target="_blank" rel="noopener noreferrer">
        {row}
      </a>
    );
  }
  return <Link href={obj.href ?? "/"}>{row}</Link>;
}

/**
 * the visual row shared by every menu option -- icon, label, and arrow.
 *
 * @param {object} props - component props.
 * @param {string} [props.iconSrc] - icon image. rows without one just show the label.
 * @param {React.ReactNode} props.children - option label.
 * @returns {JSX.Element} the styled row, with no link/click behavior of its own.
 */
function MenuRow({ iconSrc, children }: { iconSrc?: string; children: React.ReactNode }) {
  return (
    <div className="group border-2 border-black bg-[#2840A0] p-3 hover:bg-[#F8D030] hover:text-[#3850A0] transition-all cursor-pointer flex items-center gap-3 shadow-md">
      {iconSrc && (
        <div className="w-12 h-12 relative flex-shrink-0 group-hover:animate-bounce">
          <Image src={iconSrc} alt="" width={MENU_ICON_PX} height={MENU_ICON_PX} className="pixelated" />
        </div>
      )}
      <span className="pixel-font text-sm flex-1 text-white group-hover:text-[#3850A0] drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)]">
        {children}
      </span>
      <span className="text-white group-hover:text-[#3850A0] pixel-font text-xs">▶</span>
    </div>
  );
}
