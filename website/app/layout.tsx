import type { Metadata } from "next";
import { Inter, Press_Start_2P, Caveat, Newsreader, DM_Sans, Geist_Mono, Archivo_Black, JetBrains_Mono, Libre_Caslon_Display, Libre_Caslon_Text, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// only Press Start 2P (the homepage/nav pixel font) is preloaded. everything
// below is section-specific, and a root-layout preload would make every page
// download it up front. with preload off the browser only fetches a font
// once a page actually renders text in it.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  preload: false,
});

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  preload: false,
});

// The Kitchen section uses its own retro desktop-OS design system (see
// website/docs/themes/cookbook.md) with a dedicated serif/sans/mono stack.
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-kitchen-serif",
  preload: false,
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-kitchen-sans",
  preload: false,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-kitchen-mono",
  preload: false,
});

// Round Table (/public-square) uses the neobrutalism design system (see
// website/docs/themes/neobrutalism.md) -- a heavy display font for its
// shouty headings, plus a dedicated mono for tags/timestamps. Body/UI text
// reuses the site's existing Inter font (--font-inter above).
const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-neo-display",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-neo-mono",
  preload: false,
});

// The garden page (/garden) borrows from old seed catalogs and herbarium
// labels: Caslon for display and running text, a typewriter-ish mono for data.
const caslonDisplay = Libre_Caslon_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-garden-display",
  preload: false,
});

const caslonText = Libre_Caslon_Text({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-garden-text",
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-garden-mono",
  preload: false,
});

const SITE_NAME = "Tyler Schwenk";
const SITE_URL = "https://tyler-schwenk.github.io";
const DEFAULT_TITLE = "Tyler Schwenk - Personal Website";
const TITLE_TEMPLATE = "%s | Tyler Schwenk";
const DEFAULT_DESCRIPTION =
  "Lots of fun projects on here. Welcome to the small web";
const OG_IMAGE_PATH = "/images/favicon/android-chrome-512x512.png";
const OG_IMAGE_WIDTH = 512;
const OG_IMAGE_HEIGHT = 512;
const KEYWORDS = [
  "software developer",
  "full-stack",
  "sustainable development",
  "machine learning",
  "web development",
  "Next.js",
  "TypeScript",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: TITLE_TEMPLATE,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  alternates: {
    canonical: "/",
  },
  keywords: KEYWORDS,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_PATH,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * Root layout for the site shell.
 *
 * @param {Readonly<{ children: React.ReactNode }>} props - Layout properties.
 * @returns {JSX.Element} Root HTML layout wrapper.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/images/favicon/favicon.ico" sizes="any" />
        <link rel="icon" href="/images/favicon/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/images/favicon/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/images/favicon/apple-touch-icon.png" />
        <link rel="manifest" href="/images/favicon/site.webmanifest" />
      </head>
      <body className={`${inter.variable} ${pressStart2P.variable} ${caveat.variable} ${newsreader.variable} ${dmSans.variable} ${geistMono.variable} ${archivoBlack.variable} ${jetbrainsMono.variable} ${caslonDisplay.variable} ${caslonText.variable} ${plexMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
