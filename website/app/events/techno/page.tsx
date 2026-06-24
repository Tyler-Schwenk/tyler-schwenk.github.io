'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import PageWrapper from '@/components/PageWrapper';
import EventRsvpForm from '@/components/EventRsvpForm';

const LAVENDER = '#e2a9f1';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Horizon:wght@400;700&display=swap');
`;

const DJS = [
  {
    name: 'Suspiro',
    link: 'https://youtu.be/NlpMFb0r2v4?is=JqZV-NE7QAY4AmMX',
  },
  {
    name: 'CNR',
    link: 'https://soundcloud.com/particlefm/guest-mix-w-cnr-ganymede-may?ref=clipboard&p=a&c=0&si=78b97eccf08e474ba5ec5988aa9116c5&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
  },
  {
    name: 'tracepoint',
    link: 'https://www.youtube.com/@tracepoint.tracepoint',
  },
];

export default function LavenderBayPage() {
  const [rsvpOpen, setRsvpOpen] = useState(false);

  return (
    <PageWrapper hideFooter hideNavigation>
      <style>{styles}</style>
      <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'Horizon, sans-serif' }}>
        {/* Hero Section */}
        <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
          <Image
            src="/images/events/lavbay2.JPG"
            alt="Lavender Bay backdrop"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40" />

          <div className="relative z-10 px-6 text-center flex flex-col items-center justify-center h-full">
            <div className="relative z-20">
              <h1
                className="text-5xl md:text-7xl font-bold mb-8 tracking-wider"
                style={{ color: LAVENDER }}
              >
                LAVENDER BAY
              </h1>
              <div className="text-gray-300 text-lg space-y-2">
                <p className="font-light">July 17 — 7 PM</p>
                <p className="font-light">Mission Bay, San Diego</p>
              </div>
            </div>
          </div>
        </section>

        {/* Info Section */}
        <section className="px-6 py-16 max-w-2xl mx-auto">
          <div className="space-y-8">
            

            {/* Lineup Section */}
            <div>
              <h2
                className="text-3xl font-bold mb-6 tracking-wider"
                style={{ color: LAVENDER }}
              >
                LINEUP
              </h2>

              <div className="space-y-4">
                {DJS.map((dj) => (
                  <a
                    key={dj.name}
                    href={dj.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="flex items-center justify-between p-6 border border-gray-700 hover:border-gray-500 transition bg-gray-950/30 hover:bg-gray-950/60 transition">
                      <span className="text-2xl font-light tracking-wide">{dj.name}</span>
                      <span
                        className="text-sm font-bold"
                        style={{ color: LAVENDER }}
                      >
                        LISTEN
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Proceeds Section */}
            <div className="text-center space-y-6">
              <h2 className="text-2xl font-bold tracking-wider">
                All Proceeds to
              </h2>
              <a
                href="https://www.alotrolado.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block group"
              >
                <div
                  className="px-8 py-4 border-2 font-bold text-lg tracking-wider hover:opacity-80 transition"
                  style={{
                    color: LAVENDER,
                    borderColor: LAVENDER,
                  }}
                >
                  AL OTRO LADO
                </div>
                <p className="text-gray-400 text-sm mt-3">
                  Immigrant rights & mutual aid
                </p>
              </a>
            </div>

            

            {/* RSVP Section */}
            <div>
              <div className="text-center text-gray-400 py-4">
              <p className="text-sm tracking-wide">FREE ENTRY</p>
              </div>
              <button
                onClick={() => setRsvpOpen(!rsvpOpen)}
                className="w-full border-2 border-gray-700 hover:border-gray-500 py-6 px-4 transition text-lg font-bold tracking-wide"
                style={{
                  color: LAVENDER,
                  backgroundColor: rsvpOpen ? 'rgba(226, 169, 241, 0.05)' : 'transparent',
                }}
              >
                {rsvpOpen ? '−' : '+'} RSVP FOR LOCATION
              </button>
              {rsvpOpen && (
                <div className="mt-6 border border-gray-800 p-6 bg-gray-950/50">
                  <EventRsvpForm eventSlug="techno" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Imagery Section */}
        <section className="px-6 py-16 max-w-2xl mx-auto border-t border-gray-800">
          <div className="space-y-6">
            <Image
              src="/images/events/lavbay1.JPG"
              alt="Lavender Bay - water imagery 1"
              width={800}
              height={600}
              className="w-full h-auto object-cover"
            />
            <Image
              src="/images/events/lavbay3.JPG"
              alt="Lavender Bay - water imagery 2"
              width={800}
              height={600}
              className="w-full h-auto object-cover"
            />
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 max-w-2xl mx-auto text-center text-gray-500 text-sm space-y-4">
          <Link href="/events" className="block hover:text-white transition">
            Back to events
          </Link>
          <p className="text-xs tracking-widest">FOOD • ART • VISUALS</p>
        </section>
      </div>
    </PageWrapper>
  );
}
