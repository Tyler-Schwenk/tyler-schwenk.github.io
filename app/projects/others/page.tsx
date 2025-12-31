import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import PageWrapper from "@/components/PageWrapper";

export const metadata: Metadata = {
  title: "Other Projects | Tyler Schwenk",
  description: "Additional software development projects including Pac-Tyler, RoboSub, and more",
};

export default function Others() {
  return (
    <PageWrapper>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="pt-32 pb-12">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold text-white">Others</h1>
            <p className="text-xl text-slate-300">
              Projects that are still being developed, or are too small to warrant their own page
            </p>
          </div>
        </div>
      </section>

      {/* Pac-Tyler */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-8">
            <Link href="/pac-tyler" className="block hover:opacity-90 transition-opacity">
              <Image
                src="/images/logo-Pac-Tyler.png"
                alt="Pac-Tyler Logo"
                width={800}
                height={400}
                className="w-full rounded-lg"
              />
            </Link>
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white">
                <Link href="/pac-tyler" className="hover:text-orange-500 transition-colors">
                  Pac-Tyler
                </Link>
              </h2>
              <p className="text-lg text-slate-300 leading-relaxed">
                A gamified personal challenge where I bike every street in San Diego, tracked with Strava and
                visualized via custom software built on Python and Mapbox.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RoboSub */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-white">RoboSub</h2>
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
            <p className="text-lg text-slate-300 leading-relaxed">
              This is the autonomous robotic submarine that I worked on in the Mechatronics club in college. The submarine was
              able to navigate a course autonomously and complete a variety of tasks. My primary contributions were towards the computer vision ML
              model for object recognition. View our{" "}
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
        </div>
      </section>

      {/* Hamming Code */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-white">Hamming Code</h2>
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
            <p className="text-lg text-slate-300 leading-relaxed">
              Above is my implementation of a bit-error correcting code using logical gates and circuits in Logicworks. The circuit
              implements a 5-bit Hamming code, which is able to automatically detect and correct errors in 8 bits of transmitted data.{" "}
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
    </div>
    </PageWrapper>
  );
}
