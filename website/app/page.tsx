"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

// pages "I'm feeling lucky" can land on. hand-picked so it skips the menu itself
// plus utility pages (admin, display kiosk, confirm/success screens)
const LUCKY_ROUTES = [
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
 * Renders the retro main menu landing page.
 *
 * @returns {JSX.Element} The home page layout.
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-black flex items-center justify-center p-4">
      {/* Main Container */}
      <div className="w-full max-w-4xl">
        {/* Screen */}
        <div className="bg-[#3850A0] border-4 border-black p-6 relative flex flex-col min-h-[80vh] max-h-[90vh] shadow-2xl">
          
          {/* Scanline Effect */}
          <div className="absolute inset-0 pointer-events-none opacity-10" 
               style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)'}} />
          
          {/* Title */}
          <div className="mb-6 flex-shrink-0 relative z-10">
            <h1 className="text-3xl md:text-5xl font-bold text-[#F8D030] text-center pixel-font tracking-wider drop-shadow-[3px_3px_0_rgba(0,0,0,1)]">
              MAIN MENU
            </h1>
          </div>

          {/* Main Menu - Scrollable */}
          <div className="relative flex-1 min-h-0 z-10">
            <div className="absolute inset-0 overflow-y-auto pb-16 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="space-y-2">
                <div className="mb-4 text-center">
                  <p className="text-[#F8D030] pixel-font text-sm animate-pulse drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]">
                    ▼ SELECT OPTION ▼
                  </p>
                </div>

                {/* Menu Items */}
                <LuckyOption />
                <MenuOption href="/events" iconSrc="/images/8bit/events.png">
                  UPCOMING EVENTS
                </MenuOption>
                <MenuOption href="/gallery" iconSrc="/images/8bit/camera.png">
                  GALLERY
                </MenuOption>
                <MenuOption href="/biking" iconSrc="/images/8bit/bike.png">
                  BIKING
                </MenuOption>
                <MenuOption href="/kitchen" iconSrc="/images/8bit/chef.png">
                  THE KITCHEN
                </MenuOption>
                <MenuOption href="/garden" iconSrc="/images/8bit/plant.png">
                  THE GARDEN
                </MenuOption>
                <MenuOption href="/sd-workspaces" iconSrc="/images/8bit/coffee.png">
                  SD WORKSPACES
                </MenuOption>
                <MenuOption href="/projects/ribbit-radar" iconSrc="/images/8bit/crlf_8bit.png">
                  FROG WORK
                </MenuOption>
                <MenuOption href="/solar" iconSrc="/images/solar/solar_icon.png">
                  SOLAR SETUP
                </MenuOption>
                <MenuOption href="/console" iconSrc="/images/8bit/console.png">
                  THE CONSOLE
                </MenuOption>
                <MenuOption href="/mallard" iconSrc="/images/8bit/mallard_8bit.png">
                  MALLARD COUNTER
                </MenuOption>
                <MenuOption href="/projects/trade-routes" iconSrc="/images/8bit/traderoutes.png">
                  TRADE ROUTES
                </MenuOption>
                <MenuOption href="https://tylerschwenktechnical.github.io/" external iconSrc="/images/8bit/work.png">
                  PROFESSIONAL SERVICES
                </MenuOption>
                <MenuOption href="/community-board" iconSrc="/images/8bit/community.png">
                  COMMUNITY BOARD
                </MenuOption>
                <MenuOption href="/library" iconSrc="/images/8bit/library.png">
                  THE LIBRARY
                </MenuOption>
                <MenuOption href="/public-square" iconSrc="/images/8bit/round_table.png">
                  ROUND TABLE
                </MenuOption>
                <MenuOption href="/projects/others" iconSrc="/images/8bit/lightbulb.png">
                  INSPIRATION/MISC
                </MenuOption>
                <MenuOption href="/opium-den">
                  ENTER THE VIRTUAL OPIUM DEN
                </MenuOption>
              </div>
            </div>
            
            {/* Scroll Indicator - Subtle fade at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#3850A0] to-transparent pointer-events-none" />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="text-[#F8D030] pixel-font text-xs animate-bounce opacity-70">▼</div>
            </div>
          </div>
        </div>

        {/* Admin link -- the admin page has its own login */}
        <div className="mt-3 text-center">
          <Link
            href="/admin"
            className="pixel-font text-[10px] text-gray-500 hover:text-[#F8D030] transition-colors"
          >
            ADMIN
          </Link>
        </div>
      </div>
    </div>
  );
}

// Menu Option Component
/**
 * Renders a single menu option with an icon.
 *
 * @param {object} props - Component props.
 * @param {string} props.href - Navigation target.
 * @param {string} [props.icon] - Text icon fallback.
 * @param {string} [props.iconSrc] - Image icon source.
 * @param {React.ReactNode} props.children - Option label.
 * @param {boolean} [props.external=false] - Opens link in a new tab when true.
 * @returns {JSX.Element} The menu option entry.
 */
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
    <MenuRow icon={icon} iconSrc={iconSrc}>
      {children}
    </MenuRow>
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

/**
 * Menu option that sends you to a random page from LUCKY_ROUTES.
 *
 * the pick happens on click rather than render so the server-built html and
 * the client agree, and every click rolls fresh.
 *
 * @returns {JSX.Element} The "I'm feeling lucky" menu entry.
 */
function LuckyOption() {
  const router = useRouter();

  /** rolls the dice and navigates to the winning route. */
  const goSomewhereRandom = () => {
    const route = LUCKY_ROUTES[Math.floor(Math.random() * LUCKY_ROUTES.length)];
    router.push(route);
  };

  return (
    <button type="button" onClick={goSomewhereRandom} className="block w-full text-left">
      <MenuRow iconSrc="/images/8bit/dice.png">I&apos;M FEELING LUCKY</MenuRow>
    </button>
  );
}

/**
 * The visual row shared by every menu option -- icon, label, and arrow.
 *
 * @param {object} props - Component props.
 * @param {string} [props.icon] - Text icon fallback.
 * @param {string} [props.iconSrc] - Image icon source.
 * @param {React.ReactNode} props.children - Option label.
 * @returns {JSX.Element} The styled row, with no link/click behavior of its own.
 */
function MenuRow({
  icon,
  iconSrc,
  children,
}: {
  icon?: string;
  iconSrc?: string;
  children: React.ReactNode;
}) {
  return (
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
      ) : icon ? (
        <span className="text-xl group-hover:animate-bounce">{icon}</span>
      ) : null}
      <span className="pixel-font text-sm flex-1 text-white group-hover:text-[#3850A0] drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)]">{children}</span>
      <span className="text-white group-hover:text-[#3850A0] pixel-font text-xs">▶</span>
    </div>
  );
}
