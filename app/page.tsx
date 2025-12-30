import Image from "next/image";
import ProjectCard from "@/components/ProjectCard";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section id="home" className="pt-32 pb-20">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center md:justify-start">
              <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-orange-500 shadow-2xl">
                <Image
                  src="/images/pic00.jpeg"
                  alt="Tyler Schwenk profile photo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            <div className="space-y-6 text-center md:text-left">
              <h1 className="text-5xl md:text-6xl font-bold text-white">
                Tyler Schwenk
              </h1>
              <h2 className="text-2xl md:text-3xl text-slate-300">
                <span className="text-orange-500">Sustainable,</span> full-stack software development
              </h2>
              <p className="text-lg text-slate-400">
                Providing services through{" "}
                <a
                  href="https://tylerschwenktechnical.github.io/"
                  className="text-orange-500 hover:text-orange-400 transition-colors underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Tyler Schwenk Technical
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="py-20 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-white text-center mb-16">
            Recent Projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <ProjectCard
              title="Ribbit Radar"
              description="Bioacoustic ML Algorithm developed for the conservation of endangered frog species"
              href="/projects/ribbit-radar"
              image="/images/pic19.jpg"
              imageAlt="Ribbit Radar - Bioacoustic ML Algorithm project"
            />
            <ProjectCard
              title="Trade Routes"
              description="Peer-to-peer marketplace for collectible card trading"
              href="/projects/trade-routes"
              image="/images/trade-routes-logo.png"
              imageAlt="Trade Routes - Peer-to-peer marketplace"
            />
            <ProjectCard
              title="Others"
              description="Additional projects including RoboSub, Pac-Tyler, and more"
              href="/projects/others"
              image="/images/funkyness.jpg"
              imageAlt="Additional projects showcase"
            />
            <ProjectCard
              title="Pac-Tyler"
              description="Biking the length of every street in San Diego"
              href="/pac-tyler"
              image="/images/logo-Pac-Tyler.png"
              imageAlt="Pac-Tyler - Biking the length of every street in San Diego"
            />
            <ProjectCard
              title="Gallery"
              description="my photos"
              href="/gallery"
              image="/images/gallery/friends/DSC00356.jpeg"
              imageAlt="Photo gallery"
            />
            <ProjectCard
              title="Misc"
              description="Things I'd like to share with the world"
              href="/interests"
              image="/images/funkyness.jpg"
              imageAlt="Things I enjoy"
            />
          </div>
        </div>
      </section>

    </div>
  );
}
