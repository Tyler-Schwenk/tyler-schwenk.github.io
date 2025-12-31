"use client";

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-black flex items-center justify-center p-4">
      {/* Game Boy Screen Container */}
      <div className="w-full max-w-4xl">
        {/* Outer Game Boy Shell */}
        <div className="bg-gray-700 p-8 rounded-3xl shadow-2xl border-8 border-gray-900">
          {/* Screen */}
          <div className="bg-black p-4 rounded-lg shadow-inner">
            {/* Inner Screen Content */}
            <div className="bg-blue-950 border-4 border-blue-600 p-6 relative flex flex-col min-h-[600px] max-h-[80vh]">
              
              {/* Scanline Effect */}
              <div className="absolute inset-0 pointer-events-none opacity-10" 
                   style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)'}} />
              
              {/* Title Bar */}
              <div className="border-4 border-black bg-[#3850A0] p-3 mb-4 shadow-lg flex-shrink-0">
                <h1 className="text-2xl md:text-4xl font-bold text-[#F8D030] text-center pixel-font tracking-wider drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]">
                  MAIN MENU
                </h1>
              </div>

              {/* Main Menu - Scrollable */}
              <div className="border-4 border-black bg-[#3850A0]/90 p-4 space-y-2 shadow-lg flex-1 overflow-y-auto mb-4">
                <div className="mb-3 text-center">
                  <p className="text-[#F8D030] pixel-font text-sm animate-pulse drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]">
                    ▼ SELECT OPTION ▼
                  </p>
                </div>

                {/* Menu Items */}
                <MenuOption href="https://tylerschwenktechnical.github.io/" external iconSrc="/images/8bit/work.png">
                  PROFESSIONAL SERVICES
                </MenuOption>
                <MenuOption href="/pac-tyler" iconSrc="/images/8bit/pacman.png">
                  PAC-TYLER
                </MenuOption>
                <MenuOption href="/projects/ribbit-radar" iconSrc="/images/8bit/crlf_8bit.png">
                  RIBBIT RADAR
                </MenuOption>
                <MenuOption href="/mallard" iconSrc="/images/8bit/mallard_8bit.png">
                  MALLARD COUNTER
                </MenuOption>
                <MenuOption href="/projects/trade-routes" iconSrc="/images/8bit/traderoutes.png">
                  TRADE ROUTES
                </MenuOption>
                <MenuOption href="/gallery" iconSrc="/images/8bit/camera.png">
                  GALLERY
                </MenuOption>
                <MenuOption href="/cookbook" iconSrc="/images/8bit/chef.png">
                  COOKBOOK
                </MenuOption>
                <MenuOption href="/inspiration" iconSrc="/images/8bit/lightbulb.png">
                  INSPIRATION
                </MenuOption>
                <MenuOption href="/projects/others" icon="⚡">
                  OTHER PROJECTS
                </MenuOption>
              </div>

              {/* Status Bar */}
              <div className="flex-shrink-0">
                <div className="border-4 border-black bg-[#3850A0] p-2 flex justify-between items-center shadow-lg">
                  <span className="text-[#F8D030] pixel-font text-xs drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]">PRESS START</span>
                  <span className="text-[#F8D030] pixel-font text-xs animate-pulse">●</span>
                </div>
              </div>
            </div>
          </div>

          {/* Game Boy Controls Hint */}
          <div className="mt-4 text-center">
            <p className="text-gray-400 pixel-font text-sm">
              USE ARROW KEYS OR CLICK TO SELECT
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Menu Option Component
function MenuOption({ 
  href, 
  icon, 
  iconSrc,
  children, 
  external = false 
}: { 
  href: string; 
  icon?: string;
  iconSrc?: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const content = (
    <div className="group border-2 border-black bg-[#2840A0] p-3 hover:bg-[#F8D030] hover:text-[#3850A0] transition-all cursor-pointer flex items-center gap-3 shadow-md">
      {iconSrc ? (
        <div className="w-12 h-12 relative flex-shrink-0 group-hover:animate-bounce">
          <Image 
            src={iconSrc} 
            alt="" 
            width={48} 
            height={48}
            className="pixelated"
          />
        </div>
      ) : (
        <span className="text-xl group-hover:animate-bounce">{icon}</span>
      )}
      <span className="pixel-font text-sm flex-1 text-white group-hover:text-[#3850A0] drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)]">{children}</span>
      <span className="text-white group-hover:text-[#3850A0] pixel-font text-xs">▶</span>
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={href}>{content}</Link>;
}
