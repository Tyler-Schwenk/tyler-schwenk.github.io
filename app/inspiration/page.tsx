"use client";

import PageWrapper from "@/components/PageWrapper";
import Image from "next/image";
import { useState } from "react";

export default function Inspiration() {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  return (
    <PageWrapper>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        
        {/* Title */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            💡 Inspiration
          </h1>
          <p className="text-slate-400 text-lg">
            People and projects that inspire my work
          </p>
        </div>

        {/* Friends Section */}
        <section className="mb-12">
          <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-lg border border-slate-700 shadow-xl">
            <h2 className="text-3xl font-bold text-white mb-6">
              ✨ Friends
            </h2>
            <div className="space-y-4">
              <LinkCard href="https://myhalfbakedideas.com/" name="Jeff" />
              <LinkCard href="https://tavakessler.com/" name="Tava" />
              <LinkCard href="https://vish.ventures/" name="Vishal" />
              <LinkCard href="https://frankyhanen.com/" name="Franky" />
            </div>
          </div>
        </section>

        {/* Other Inspirations Section */}
        <section className="mb-12">
          <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-lg border border-slate-700 shadow-xl">
            <h2 className="text-3xl font-bold text-white mb-6">
              🌟 Other Inspirations
            </h2>
            <div className="space-y-4">
              <LinkCard href="https://botpa.vercel.app/" name="BOTPA" description="Cool app I like" />
              <LinkCard href="https://tom7.org/index.html" name="Tom7" description="Computer scientist whose work I enjoy" />
            </div>
          </div>
        </section>

        {/* Earthrise Section */}
        <section>
          <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-lg border border-slate-700 shadow-xl">
            <h2 className="text-3xl font-bold text-white mb-6">
              🌍 Earthrise
            </h2>
            <div 
              className="relative cursor-pointer group overflow-hidden rounded-lg"
              onClick={() => setFullscreenImage("/images/earthride.jpg")}
            >
              <Image 
                src="/images/earthride.jpg" 
                alt="Earthrise" 
                width={1200} 
                height={800}
                className="w-full h-auto transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <span className="text-white text-4xl opacity-0 group-hover:opacity-100 transition-opacity">
                  🔍
                </span>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Fullscreen Modal */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white text-4xl hover:text-orange-500 transition-colors"
            onClick={() => setFullscreenImage(null)}
          >
            ×
          </button>
          <Image 
            src={fullscreenImage} 
            alt="Fullscreen view" 
            width={1920} 
            height={1080}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
    </PageWrapper>
  );
}

function LinkCard({ 
  href, 
  name, 
  description 
}: { 
  href: string; 
  name: string; 
  description?: string;
}) {
  return (
    <a 
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-600 hover:border-orange-500 hover:bg-slate-900/80 transition-all shadow-md hover:shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white group-hover:text-orange-500 mb-1 transition-colors">
              {name}
            </h3>
            {description && (
              <p className="text-sm text-slate-400 group-hover:text-slate-300">
                {description}
              </p>
            )}
          </div>
          <span className="text-slate-400 group-hover:text-orange-500 text-xl transition-colors">
            →
          </span>
        </div>
      </div>
    </a>
  );
}
