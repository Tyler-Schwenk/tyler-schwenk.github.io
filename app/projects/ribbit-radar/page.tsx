import Image from "next/image";
import type { Metadata } from "next";
import PageWrapper from "@/components/PageWrapper";

export const metadata: Metadata = {
  title: "Frog Work | Tyler Schwenk",
  description: "What the heck am I doing with those frogs",
};

export default function RibbitRadar() {
  return (
    <PageWrapper>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold text-white">
              Frog Work
            </h1>
            <p className="text-xl md:text-2xl text-slate-300">
              what the heck am i doing with those frogs
            </p>
          </div>
        </div>
      </section>

      {/* NPR Feature Section */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-slate-300 leading-relaxed">
              This podcast from NPR does a great job describing the motivation for my work and how its
               being applied. The video is not as descriptive but you can see the California Red-legged Frog there.
            </p>
            
            {/* Spotify Podcast */}
            <div className="mt-8">
              <iframe 
                data-testid="embed-iframe" 
                style={{ borderRadius: '12px' }} 
                src="https://open.spotify.com/embed/episode/3a3fDYMteSBaYuWL7zarBr?utm_source=generator" 
                width="100%" 
                height="352" 
                frameBorder="0" 
                allowFullScreen 
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                loading="lazy"
              ></iframe>
            </div>

            {/* YouTube Video */}
            <div className="mt-8">
              <div className="aspect-video w-full rounded-lg overflow-hidden shadow-2xl">
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/nC1va8pe0BQ"
                  title="California Red-Legged Frog"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            </div>

            {/* Collaboration Section */}
            <div className="mt-12">
              <h2 className="text-3xl font-bold text-white text-center mb-8">
                Made in Collaboration With
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 items-center justify-items-center">
                <a
                  href="https://www.nature.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:scale-110 transition-transform"
                  title="The Nature Conservancy"
                >
                  <div className="bg-white p-3 rounded-lg">
                    <Image src="/images/TheNatureConservancy.png" alt="The Nature Conservancy" width={150} height={80} className="object-contain" />
                  </div>
                </a>
                <a
                  href="https://www.usgs.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:scale-110 transition-transform"
                  title="USGS"
                >
                  <Image src="/images/USGS.png" alt="USGS" width={150} height={80} className="object-contain" />
                </a>
                <a
                  href="https://www.fws.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:scale-110 transition-transform"
                  title="US Fish and Wildlife Service"
                >
                  <Image src="/images/USFWS.png" alt="US Fish and Wildlife Service" width={150} height={80} className="object-contain" />
                </a>
                <a
                  href="https://www.faunadelnoroeste.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:scale-110 transition-transform"
                  title="Fauno del Noroeste"
                >
                  <Image src="/images/fauno.png" alt="Fauno del Noroeste" width={150} height={80} className="object-contain" />
                </a>
                <a
                  href="https://www.sdnhm.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:scale-110 transition-transform"
                  title="San Diego Natural History Museum"
                >
                  <div className="bg-white p-3 rounded-lg">
                    <Image src="/images/thenat.png" alt="The Nat" width={150} height={80} className="object-contain" />
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Documentation Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-4xl font-bold text-white">2025 Report for The Nature Conservancy</h2>
           
            
            {/* Documentation Link Card */}
            <a
              href="https://tnc-conservation-technology.gitbook.io/acoustic-frog-monitoring"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-8 p-8 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/30 rounded-lg shadow-xl hover:border-orange-500 hover:shadow-orange-500/20 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1">
                  <div className="flex-shrink-0 bg-white p-3 rounded-lg">
                    <Image src="/images/TheNatureConservancy.png" alt="The Nature Conservancy" width={100} height={60} className="object-contain" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                      Acoustic Frog Monitoring Guide
                    </div>
                    <div className="text-slate-400 text-lg">
                      Technical documentation of my model development, and field deployment guide
                    </div>
                  </div>
                </div>
                <div className="text-4xl text-orange-500 group-hover:translate-x-2 transition-transform">
                  →
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Custom ML Training System Section */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-4xl font-bold text-white">Custom ML Training Framework</h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              To aid in my model development I have been building this application. 
              It automates the full ML pipeline - from data prep through hyperparameter sweeps, training, inference, and model evaluation. 
              You can just set a single config and then click "go". It will train and evaluate hundreds of models while you sleep. 
              I'm pretty stoked on it, and plan to package it to send out to the bioacoustic community in 2026.
            </p>
            
            {/* GitHub Link Card */}
            <a
              href="https://github.com/Tyler-Schwenk/BirdNET-CustomClassifierSuite"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-8 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/30 rounded-lg shadow-xl hover:border-orange-500 hover:shadow-orange-500/20 transition-all duration-300 group overflow-hidden"
            >
              <div className="relative">
                <Image 
                  src="/images/analyzer.png" 
                  alt="BirdNET Custom Classifier Suite" 
                  width={1200} 
                  height={800} 
                  className="object-cover w-full group-hover:scale-105 transition-transform duration-300" 
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-center space-y-2">
                    <div className="text-3xl font-bold">BirdNET Custom Classifier Suite</div>
                    <div className="text-xl">Click to view →</div>
                  </div>
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Instinct Environmental Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Image 
                src="/images/instinct.jpg" 
                alt="Instinct Environmental" 
                width={60} 
                height={60} 
                className="object-contain rounded-lg" 
              />
              <h2 className="text-4xl font-bold text-white">Instinct Environmental</h2>
            </div>
            
            
            <p className="text-lg text-slate-300 leading-relaxed">
              Im also currently leading software development at Instinct environmental, the only company making 
              solar powered, satelite capable, ML-edge computing audio recorders. Its really cool getting to make 
              this new technology a reality, and I enjoy the quick development style of the startup.

              Sam the bullfrog slayer will use this for rapid alerts of bullfrog invasions in sensitive habitat.
            </p>
            
            {/* Company Link Card */}
            <a
              href="https://instinctenvironmental.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-8 p-8 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/30 rounded-lg shadow-xl hover:border-orange-500 hover:shadow-orange-500/20 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1">
                  <div className="flex-shrink-0">
                    <Image src="/images/instinct2.png" alt="Instinct Environmental" width={80} height={80} className="object-contain rounded-lg" />
                  </div>
                  <div className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                    Instinct Website
                  </div>
                </div>
                <div className="text-4xl text-orange-500 group-hover:translate-x-2 transition-transform">
                  →
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Ribbit Radar Section */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-4xl font-bold text-white">Ribbit Radar</h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              This is an archive of the first ML audio detecton system I got working for the California Red-legged Frog.
              It used an audio-spectrogram transformer, and I built a simple GUI for it. The model wasnt great, and neither was 
              the application, but I wasnt getting paid yet so what can you expect.
            </p>
            
            {/* GitHub Link Card */}
            <a
              href="https://github.com/Tyler-Schwenk/RibbitRadar"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-8 p-8 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/30 rounded-lg shadow-xl hover:border-orange-500 hover:shadow-orange-500/20 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                    🐸 Ribbit Radar Repository
                  </div>
                  <div className="text-slate-400 text-lg">
                    Open source code
                  </div>
                </div>
                <div className="text-4xl text-orange-500 group-hover:translate-x-2 transition-transform">
                  →
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>
    </PageWrapper>
  );
}
