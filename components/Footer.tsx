"use client";

import { useState, useEffect } from "react";
import { funFacts } from "@/data/funFacts";

export default function Footer() {
  const [currentFact, setCurrentFact] = useState("");

  useEffect(() => {
    // Pick a random fun fact when the component mounts
    const randomIndex = Math.floor(Math.random() * funFacts.length);
    setCurrentFact(funFacts[randomIndex]);
  }, []);

  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-16">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="text-xs text-slate-500 uppercase tracking-wide">
            random tyler fact:
          </div>
          <div className="text-slate-400 italic text-lg">
            {currentFact}
          </div>
        </div>
      </div>
    </footer>
  );
}
