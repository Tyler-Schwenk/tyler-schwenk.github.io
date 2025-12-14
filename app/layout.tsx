import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
      <body className={`${inter.variable} font-sans antialiased`}>
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  );
}
