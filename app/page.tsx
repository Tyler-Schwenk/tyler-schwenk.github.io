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
            <div className="bg-blue-950 border-4 border-blue-600 p-6 aspect-[4/3] relative overflow-hidden">
              
              {/* Scanline Effect */}
              <div className="absolute inset-0 pointer-events-none opacity-10" 
                   style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)'}} />
              
              {/* Title Bar */}
              <div className="border-4 border-yellow-400 bg-blue-900 p-3 mb-4 shadow-lg">
                <h1 className="text-2xl md:text-4xl font-bold text-yellow-400 text-center pixel-font tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                  TYLER SCHWENK
                </h1>
              </div>

              {/* Main Menu */}
              <div className="border-4 border-cyan-400 bg-blue-900/80 p-4 space-y-3 shadow-lg">
                <div className="mb-4 text-center">
                  <p className="text-yellow-300 pixel-font text-sm animate-pulse">
                    ▼ SELECT OPTION ▼
                  </p>
                </div>

                {/* Menu Items */}
                <MenuOption href="/pac-tyler" iconSrc="/images/8bit/pacman.png">
                  PAC-TYLER
                </MenuOption>
                <MenuOption href="/projects/ribbit-radar" iconSrc="/images/8bit/crlf_8bit.png">
                  RIBBIT RADAR
                </MenuOption>
                <MenuOption href="https://www.traderoutestcg.com/mallard.html" external iconSrc="/images/8bit/mallard_8bit.png">
                  MALLARD COUNTER
                </MenuOption>
                <MenuOption href="/projects/trade-routes" icon="🎴">
                  TRADE ROUTES
                </MenuOption>
                <MenuOption href="/gallery" icon="📷">
                  GALLERY
                </MenuOption>
                <MenuOption href="/inspiration" iconSrc="/images/8bit/lightbulb.png">
                  INSPIRATION
                </MenuOption>
                <MenuOption href="/projects/others" icon="⚡">
                  OTHER PROJECTS
                </MenuOption>
                <MenuOption href="https://tylerschwenktechnical.github.io/" external icon="💼">
                  SERVICES
                </MenuOption>
              </div>

              {/* Status Bar */}
              <div className="absolute bottom-2 left-2 right-2">
                <div className="border-4 border-yellow-400 bg-blue-900 p-2 flex justify-between items-center shadow-lg">
                  <span className="text-yellow-300 pixel-font text-xs">PRESS START</span>
                  <span className="text-green-400 pixel-font text-xs animate-pulse">●</span>
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
    <div className="group border-2 border-cyan-400 bg-blue-950 p-3 hover:bg-cyan-400 hover:text-blue-950 transition-all cursor-pointer flex items-center gap-3 shadow-md">
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
      <span className="pixel-font text-sm flex-1 text-yellow-300 group-hover:text-blue-950">{children}</span>
      <span className="text-yellow-300 group-hover:text-blue-950 pixel-font text-xs">▶</span>
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
