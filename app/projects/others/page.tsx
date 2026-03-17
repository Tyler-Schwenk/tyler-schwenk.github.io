"use client";

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import PageWrapper from "@/components/PageWrapper";
import { useState } from "react";
import GalleryModal from "@/components/GalleryModal";

export default function Others() {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const treeGalleries = {
    tree: {
      title: "Tree",
      description: "",
      coverImage: "/images/tree/summer.jpg",
      media: [
        { src: "/images/tree/summer.jpg", alt: "", type: "image" as const },
        { src: "/images/tree/full.jpg", alt: "", type: "image" as const },
        { src: "/images/tree/branch.jpg", alt: "", type: "image" as const },
        { src: "/images/tree/fish.jpg", alt: "", type: "image" as const },
        { src: "/images/tree/bike.jpg", alt: "", type: "image" as const },
        { src: "/images/tree/friends.JPG", alt: "", type: "image" as const }
      ]
    }
  };

  return (
    <PageWrapper>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="pt-32 pb-12">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold text-white">Inspiration/Misc</h1>
            <p className="text-xl text-slate-300">
              Random things that inspire me or that I find interesting
            </p>
          </div>
        </div>
      </section>

      {/* Earthrise Section */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-white">"Earthrise"</h2>
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
                  
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Inspirational Links Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-white">Links</h2>
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-lg p-6 hover:bg-slate-800/70 transition-colors">
                <a
                  href="https://youtu.be/jTRwxNpFNjA?si=WLrqOdv577E6odan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block space-y-2"
                >
                  <h3 className="text-xl font-bold text-orange-500 hover:text-orange-400 transition-colors">
                    Bird Scooter Hack
                  </h3>
                  <p className="text-slate-300">
                    Kyle and I did this as a project for our Systems Programming project.
                  </p>
                </a>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-6 hover:bg-slate-800/70 transition-colors">
                <a
                  href="https://www.cameronsworld.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block space-y-2"
                >
                  <h3 className="text-xl font-bold text-orange-500 hover:text-orange-400 transition-colors">
                    Cameron's World
                  </h3>
                  <p className="text-slate-300">
                    GeoCities was a web-hosting service that made it possible for people to build their own homepages. During the 90s, users from all over the world created personalised corners of the Internet.</p>
<p className="text-slate-300">Cameron’s World brings together archived material from thousands of these sites.</p>

<p className="text-slate-300">In an age where we interact primarily with branded and marketed web content, Cameron’s World is a tribute to the lost days of unrefined self-expression on the Internet. This project recalls the visual aesthetics from an era when it was expected that personal spaces would always be under construction.</p>

                  
                </a>
              </div>              <div className="bg-slate-800/50 rounded-lg p-6 hover:bg-slate-800/70 transition-colors">
                <a
                  href="https://m.youtube.com/watch?v=hCAvBmY7ZgA&pp=ygUTQ29ldm9sdXRpb24gZWNvbG9neQ%3D%3D"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block space-y-2"
                >
                  <h3 className="text-xl font-bold text-orange-500 hover:text-orange-400 transition-colors">
                    Coevolution Ecology
                  </h3>
                  <p className="text-slate-300">
                    An interesting perspective on ecological relationships and coevolution.
                  </p>
                </a>
              </div>            </div>
          </div>
        </div>
      </section>

      {/* Favorite Tree Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-white">My Favorite Tree</h2>      
            
            {/* Tree Gallery */}
            <GalleryModal galleries={treeGalleries} />
          </div>
        </div>
      </section>

      {/* Old Projects */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto space-y-8">
            <h2 className="text-4xl font-bold text-white text-center">Old Projects</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* RoboSub */}
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-white">RoboSub</h3>
                <a
                  href="https://github.com/Mechatronics-SDSU/Mechatronics-2023"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:opacity-90 transition-opacity"
                >
                  <Image
                    src="/images/pic20.jpg"
                    alt="RoboSub autonomous submarine"
                    width={800}
                    height={400}
                    className="w-full rounded-lg"
                  />
                </a>
                <p className="text-slate-300 leading-relaxed">
                  Autonomous robotic submarine from my college Mechatronics club. I built the computer vision ML model for object recognition.{" "}
                  <a
                    href="https://github.com/Mechatronics-SDSU/Mechatronics-2023"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:text-orange-400 underline transition-colors"
                  >
                    GitHub
                  </a>
                </p>
              </div>

              {/* Hamming Code */}
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-white">Hamming Code</h3>
                <a
                  href="https://github.com/Tyler-Schwenk/Hamming-Code"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:opacity-90 transition-opacity"
                >
                  <Image
                    src="/images/pic13.jpg"
                    alt="Hamming Code circuit"
                    width={800}
                    height={400}
                    className="w-full rounded-lg"
                  />
                </a>
                <p className="text-slate-300 leading-relaxed">
                  Bit-error correcting circuit implementation using logical gates in Logicworks. Automatically detects and corrects errors in transmitted data.{" "}
                  <a
                    href="https://github.com/Tyler-Schwenk/Hamming-Code"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:text-orange-400 underline transition-colors"
                  >
                    Learn more
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Easter Egg */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Image
              src="/images/ric-roll.gif"
              alt="Fun easter egg"
              width={800}
              height={600}
              className="w-full rounded-lg"
            />
          </div>
        </div>
      </section>

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
