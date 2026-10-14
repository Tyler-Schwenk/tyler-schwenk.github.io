"use client";

import Link from "next/link";
import { useState } from "react";
import HomeWorld from "@/components/home/HomeWorld";
import MainMenuList from "@/components/home/MainMenuList";

type HomeView = "world" | "list";

/**
 * the home page. defaults to the explorable pixel world, with a toggle over to
 * the classic list menu for anyone who just wants to pick from a list.
 *
 * @returns {JSX.Element} the home page layout.
 */
export default function Home() {
  const [view, setView] = useState<HomeView>("world");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-black flex flex-col items-center justify-center py-4">
      {view === "world" ? (
        <HomeWorld />
      ) : (
        <div className="w-full max-w-4xl px-4">
          <MainMenuList />
        </div>
      )}

      <div className="mt-3 flex items-center gap-6 pixel-font text-[10px] text-gray-500">
        <button
          type="button"
          onClick={() => setView(view === "world" ? "list" : "world")}
          className="hover:text-[#F8D030] transition-colors"
        >
          {view === "world" ? "LIST VIEW" : "WORLD VIEW"}
        </button>
        {/* the admin page has its own login */}
        <Link href="/admin" className="hover:text-[#F8D030] transition-colors">
          ADMIN
        </Link>
      </div>
    </div>
  );
}
