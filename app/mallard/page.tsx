"use client";

import PageWrapper from "@/components/PageWrapper";
import Link from "next/link";

export default function MallardWarning() {
  return (
    <PageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20">
        <div className="container mx-auto px-6 max-w-3xl">
          
          {/* Warning Box */}
          <div className="bg-yellow-500/10 border-4 border-yellow-500 rounded-lg p-12 text-center shadow-2xl">
            <div className="text-8xl mb-6">⚠️</div>
            <h1 className="text-4xl md:text-5xl font-bold text-yellow-500 mb-6">
              WOAH THERE
            </h1>
            <p className="text-2xl text-white mb-4 leading-relaxed">
              The Mallard Counter is to be taken <span className="text-yellow-500 font-bold">seriously</span>.
            </p>
            <p className="text-xl text-slate-300 mb-8">
              Don&apos;t just go clicking it willy-nilly.
            </p>
            
            <Link href="/mallard/confirm">
              <button className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold text-xl px-12 py-4 rounded-lg transition-all transform hover:scale-105 shadow-lg">
                LET ME COUNT SOME MALLARDS
              </button>
            </Link>
          </div>

          {/* Back Link */}
          <div className="text-center mt-8">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              ← Back to Main Menu
            </Link>
          </div>

        </div>
      </div>
    </PageWrapper>
  );
}
