"use client";

import PageWrapper from "@/components/PageWrapper";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function MallardConfirm() {
  const [realMallardsChecked, setRealMallardsChecked] = useState(false);
  const [delinquentChecked, setDelinquentChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  const handleTermsScroll = () => {
    if (termsRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = termsRef.current;
      // Check if scrolled to within 10px of bottom
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        setHasScrolledToBottom(true);
      }
    }
  };

  const allChecked = realMallardsChecked && delinquentChecked && termsChecked && hasScrolledToBottom;

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20">
        <div className="container mx-auto px-6 max-w-4xl">
          
          <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-lg border border-slate-700 shadow-xl">
            <h1 className="text-4xl font-bold text-white mb-8 text-center">
              Mallard Counter Agreement
            </h1>

            <div className="space-y-6 mb-8">
              
              {/* Checkbox 1 */}
              <label className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-all">
                <input
                  type="checkbox"
                  checked={realMallardsChecked}
                  onChange={(e) => setRealMallardsChecked(e.target.checked)}
                  className="mt-1 w-5 h-5 cursor-pointer"
                />
                <span className="text-lg text-white">
                  I will only count <span className="font-bold text-yellow-500">real mallards</span>
                  <a 
                    href="https://www.allaboutbirds.org/guide/Mallard/id" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-400 hover:text-blue-300 mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    → Learn how to identify a mallard
                  </a>
                </span>
              </label>

              {/* Checkbox 2 */}
              <label className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-all">
                <input
                  type="checkbox"
                  checked={delinquentChecked}
                  onChange={(e) => setDelinquentChecked(e.target.checked)}
                  className="mt-1 w-5 h-5 cursor-pointer"
                />
                <span className="text-lg text-white">
                  I understand that if I perform a delinquent count I will owe Kyle and Tyler <span className="font-bold text-yellow-500">a mallard</span>
                </span>
              </label>

              {/* Terms of Service */}
              <div className="bg-slate-900/50 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Terms of Service</h2>
                <div 
                  ref={termsRef}
                  onScroll={handleTermsScroll}
                  className="h-64 overflow-y-scroll bg-slate-950/50 p-4 rounded border border-slate-700 mb-4"
                >
                  <div className="text-sm text-slate-300 space-y-4">
                    <p className="font-bold text-lg text-white">MALLARD COUNTER TERMS & CONDITIONS</p>
                    
                    <p><strong>ARTICLE I: DEFINITIONS</strong></p>
                    <p>1.1 "Mallard" shall mean any waterfowl of the species Anas platyrhynchos, living or deceased, but explicitly EXCLUDING any and all non-mallard waterfowl including but not limited to: ducks, geese, swans, coots, grebes, and any avian species that may resemble a mallard to the untrained eye.</p>
                    
                    <p>1.2 "Count" shall mean the act of numerical enumeration performed by the User with full cognitive awareness and intent, excluding accidental clicks, pocket dials, or counts performed under duress, intoxication, or while operating heavy machinery.</p>
                    
                    <p>1.3 "Delinquent Count" shall mean any count performed in violation of Section 2.3 or any count deemed by Kyle or Tyler, in their sole and absolute discretion, to be fraudulent, frivolous, or otherwise not in keeping with the spirit of mallard enumeration.</p>
                    
                    <p><strong>ARTICLE II: USER OBLIGATIONS</strong></p>
                    <p>2.1 User hereby agrees to count only genuine mallards and to exercise reasonable care and diligence in mallard identification.</p>
                    
                    <p>2.2 User acknowledges that Kyle and Tyler are the supreme arbiters of all mallard-related disputes and their decisions are final, binding, and not subject to appeal in any court of law, court of equity, or kangaroo court.</p>
                    
                    <p>2.3 User agrees not to count the same mallard more than once within a 24-hour period, unless said mallard has undergone significant transformation (molting, migration, or existential crisis).</p>
                    
                    <p><strong>ARTICLE III: LIABILITIES & INDEMNIFICATION</strong></p>
                    <p>3.1 In the event of a Delinquent Count, User shall be obligated to provide Kyle and Tyler with one (1) live mallard of reasonable health and temperament, delivered within thirty (30) days of notification.</p>
                    
                    <p>3.2 User hereby releases, waives, discharges and covenants not to sue Kyle, Tyler, their heirs, assigns, and any associated waterfowl, from any and all liability for injury, death, property damage, or emotional distress arising from the use of the Mallard Counter.</p>
                    
                    <p>3.3 User agrees to indemnify and hold harmless Kyle and Tyler from any claims brought by: (a) non-mallard waterfowl mistakenly counted; (b) ornithological societies; or (c) the ghost of John James Audubon.</p>
                    
                    <p><strong>ARTICLE IV: INTELLECTUAL PROPERTY</strong></p>
                    <p>4.1 User acknowledges that all mallard count data becomes the exclusive property of Kyle and Tyler upon submission, including but not limited to: count totals, timestamps, GPS coordinates, heartbeat data, 3D body scans, fecal & urine samples, and any associated mallard biometric data.</p>
                    
                    <p>4.2 Kyle and Tyler reserve the right to publish, broadcast, or otherwise disseminate User&apos;s mallard count data for purposes of scientific research, entertainment, or otherwise.</p>
                    
                    <div className="flex justify-center my-6">
                      <pre className="text-yellow-500 text-xs leading-tight font-mono">
{`           
>(.)__ <(.)__ =(.)__
 (___/  (___/  (___/  `}
                      </pre>
                    </div>
                    
                    <p><strong>ARTICLE V: FORCE MAJEURE</strong></p>
                    <p>5.1 Neither party shall be liable for failure to perform due to Acts of God, acts of waterfowl, duck migrations, or avian flu outbreaks.</p>
                    
                    <p><strong>ARTICLE VI: AMENDMENTS</strong></p>
                    <p>6.1 Kyle and Tyler reserve the right to modify these terms at any time, for any reason, or without reason. User&apos;s continued use of the Mallard Counter constitutes acceptance of any and all modifications, past, present, and future.</p>
                    
                    <p className="font-bold text-white mt-6">BY CHECKING THE BOX BELOW, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS, AND THAT YOU ARE OF SOUND MIND AND LEGAL AGE TO COUNT MALLARDS IN YOUR JURISDICTION.</p>
                  </div>
                </div>
                
                <label className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-all">
                  <input
                    type="checkbox"
                    checked={termsChecked}
                    onChange={(e) => setTermsChecked(e.target.checked)}
                    disabled={!hasScrolledToBottom}
                    className="mt-1 w-5 h-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className={`text-lg ${hasScrolledToBottom ? 'text-white' : 'text-slate-500'}`}>
                    I have read and agree to the Terms of Service
                    {!hasScrolledToBottom && <span className="block text-sm text-yellow-500 mt-1">(Please read all the terms above)</span>}
                  </span>
                </label>
              </div>

            </div>

            {/* Submit Button */}
            <div className="text-center space-y-4">
              <a
                href="https://www.traderoutestcg.com/mallard.html"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-block px-12 py-4 rounded-lg text-xl font-bold transition-all ${
                  allChecked
                    ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer transform hover:scale-105 shadow-lg'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                }`}
                onClick={(e) => {
                  if (!allChecked) {
                    e.preventDefault();
                  }
                }}
              >
                PROCEED TO MALLARD COUNTER
              </a>
              
              {!allChecked && (
                <p className="text-yellow-500 text-sm">
                  Please complete all requirements above
                </p>
              )}
            </div>

            {/* Back Link */}
            <div className="text-center mt-8">
              <Link href="/mallard" className="text-slate-400 hover:text-white transition-colors">
                ← Back
              </Link>
            </div>

          </div>

        </div>
      </div>
    </PageWrapper>
  );
}
