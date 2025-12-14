import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trade Routes | Tyler Schwenk",
  description: "Peer-to-peer marketplace for collectible card trading with robust database and advanced filtering",
};

export default function TradeRoutes() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="flex justify-center">
              <Image
                src="/images/trade-routes-logo.png"
                alt="Trade Routes Logo"
                width={250}
                height={250}
                className="rounded-lg"
              />
            </div>
            <p className="text-xl md:text-2xl text-slate-300">
              A peer-to-peer marketplace for collectible cards with a robust database that allows intuitive searching & filtering of listings.
            </p>
          </div>
        </div>
      </section>

      {/* Marketplace Section */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-4xl font-bold text-white">The Marketplace</h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              <a
                href="https://traderoutestcg.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-400 underline transition-colors"
              >
                Trade Routes
              </a>{" "}
              hits a niche in the trading card market that was previously unfilled. It provides the ability to buy and sell peer-to-peer, but with robust search otherwise only available from authorized retailers.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed">
              Features include advanced card filtering, direct communication with sellers, and a backend optimized for precise card matching — so users spend less time browsing and more time collecting.
            </p>
            <div className="mt-8">
              <video
                className="w-full max-w-3xl mx-auto rounded-lg shadow-2xl"
                autoPlay
                muted
                loop
                playsInline
              >
                <source src="/video/search_listing_example_compres.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* My Role Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-4xl font-bold text-white">My Role</h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              I co-founded Trade Routes and have led both the technical and business sides of the company since its inception.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed">
              On the engineering side, I architected and implemented the platform using a modern stack — including Next.js, PostgreSQL on AWS RDS, Docker, and GitHub-based CI/CD pipelines.
              I designed the database schema, built out frontend and backend features, deployed infrastructure with AWS, and managed integrations with external APIs.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed">
              In parallel, I've managed all business operations, and now lead efforts around monetization strategies as we grow our user base.
            </p>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-white mb-12">Technology</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-orange-500">Frontend</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• Next.js</li>
                  <li>• TypeScript</li>
                  <li>• Vercel (CI/CD)</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-orange-500">Backend</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• Django + GraphQL</li>
                  <li>• PostgreSQL (AWS RDS)</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-orange-500">DevOps</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• Docker (DockerHub)</li>
                  <li>• AWS Elastic Beanstalk</li>
                  <li>• GitHub Actions & Docker CI/CD</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-orange-500">Integrations</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• WhatsApp API (buyer-seller chat)</li>
                  <li>• Scryfall API (card metadata)</li>
                  <li>• Amazon S3 (image & file storage)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
