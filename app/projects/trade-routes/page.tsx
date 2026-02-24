import Image from "next/image";
import type { Metadata } from "next";
import PageWrapper from "@/components/PageWrapper";

export const metadata: Metadata = {
  title: "Trade Routes | Tyler Schwenk",
  description: "Peer-to-peer marketplace for collectible card trading with robust database and advanced filtering",
};

export default function TradeRoutes() {
  return (
    <PageWrapper>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="flex justify-center">
              <a
                href="https://traderoutestcg.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Visit Trade Routes website"
              >
                <Image
                  src="/images/trade-routes-logo.png"
                  alt="Trade Routes Logo"
                  width={250}
                  height={250}
                  className="rounded-lg"
                />
              </a>
            </div>
            <p className="text-xl md:text-2xl text-slate-300">
              Trade Routes is a peer-to-peer marketplace for Magic the Gathering cards, built by me and Kyle.
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
              hits a niche in the trading card market that was previously unfilled. It provides the ability to buy and sell cards peer-to-peer, but with a robust search capable of indexing all listing and card metadata.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed">
              Features include detailed card filtering, direct buyer-seller communication, and a data model tuned for accurate card matching, so collectors can find exactly what they want faster.
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
                  <li>• Custom Messanger (buyer-seller chat)</li>
                  <li>• Scryfall API (card metadata)</li>
                  <li>• Amazon S3 (image & file storage)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    </PageWrapper>
  );
}
