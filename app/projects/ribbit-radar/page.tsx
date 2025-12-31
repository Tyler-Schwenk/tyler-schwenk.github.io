import Image from "next/image";
import type { Metadata } from "next";
import PageWrapper from "@/components/PageWrapper";

export const metadata: Metadata = {
  title: "Ribbit Radar | Tyler Schwenk",
  description: "Bioacoustic Machine-Learning model for the detection of ecologically significant frog species",
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
              Ribbit Radar
            </h1>
            <p className="text-xl md:text-2xl text-slate-300">
              Bioacoustic Machine-Learning model fine tuned for the detection of ecologically significant frog species
            </p>
          </div>
        </div>
      </section>

      {/* Motivation Section */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-4xl font-bold text-white">Motivation</h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              <span className="text-orange-500 font-semibold">Built for biologists</span>, Ribbit Radar significantly reduces the time spent analyzing audio data from the field.
              Initially developed to aid in monitoring the endangered California Red-Legged Frog as it is reintroduced to ponds in Southern California,
              Ribbit Radar was later expanded to identify the invasive American Bullfrog, a major threat to native biodiversity.
            </p>
            
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
          </div>
        </div>
      </section>

      {/* Function Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-4xl font-bold text-white">Function</h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              Given a folder of audio data, Ribbit Radar autonomously processes all files, generating a spreadsheet with timestamps of identified species of interest.
              It includes metadata such as recording device ID, date/time, and air temperature. The tool supports user inputs for inference settings and output formatting.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed">
              My{" "}
              <a
                href="https://github.com/Tyler-Schwenk/RibbitRadar"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-400 underline transition-colors"
              >
                GitHub repository
              </a>{" "}
              contains the open source code, as well as more technical details.
            </p>
          </div>
        </div>
      </section>

      {/* Continued Development Section */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-4xl font-bold text-white">Continued Development</h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              With robust monitoring in place for the California Red-Legged Frog, our focus has shifted to preventing American Bullfrog invasions.
              Rapid intervention is crucial, and this requires real-time monitoring solutions.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed">
              To meet this need, we are developing an{" "}
              <span className="text-orange-500 font-semibold">autonomous real-time monitoring system</span>{" "}
              capable of remotely alerting biologists to bullfrog vocalizations detected in the field.
            </p>
          </div>
        </div>
      </section>

      {/* Technical Documentation Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-4xl font-bold text-white">Technical Documentation</h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              For comprehensive technical details on acoustic frog monitoring methodology, deployment guides, and best practices, 
              explore our detailed documentation on GitBook.
            </p>
            
            {/* Documentation Link Card */}
            <a
              href="https://tnc-conservation-technology.gitbook.io/acoustic-frog-monitoring"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-8 p-8 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/30 rounded-lg shadow-xl hover:border-orange-500 hover:shadow-orange-500/20 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                    📚 Acoustic Frog Monitoring Guide
                  </div>
                  <div className="text-slate-400 text-lg">
                    Technical documentation, deployment guides, and best practices
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

      {/* Collaboration Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-white text-center mb-12">
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
                <Image src="/images/TheNatureConservancy.png" alt="The Nature Conservancy" width={150} height={80} className="object-contain" />
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
                <Image src="/images/thenat.png" alt="The Nat" width={150} height={80} className="object-contain" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
    </PageWrapper>
  );
}
