import type { Metadata } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

export const metadata: Metadata = {
  title: "Tyler Schwenk - Software Developer",
  description: "Full-stack software developer specializing in sustainable software development. Showcasing projects including Ribbit Radar, Trade Routes, and more.",
  authors: [{ name: "Tyler Schwenk", url: "https://tyler-schwenk.github.io" }],
  keywords: ["software developer", "full-stack", "sustainable development", "machine learning", "web development"],
};

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
      <body className={`${inter.variable} ${pressStart2P.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
