'use client';


import Image from 'next/image';
import Link from 'next/link';
import PageWrapper from '@/components/PageWrapper';
import EventRsvpForm from '@/components/EventRsvpForm';

const LAVENDER = '#e2a9f1';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Horizon:wght@400;700&display=swap');
  @keyframes bobbing {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(8px); }
  }
  .bobbing-chevron {
    animation: bobbing 1s ease-in-out infinite;
  }
`;

const DJS = [
  {
    name: 'SUSPIRO',
    link: 'https://youtu.be/NlpMFb0r2v4?is=JqZV-NE7QAY4AmMX',
  },
  {
    name: 'CNR',
    link: 'https://soundcloud.com/particlefm/guest-mix-w-cnr-ganymede-may?ref=clipboard&p=a&c=0&si=78b97eccf08e474ba5ec5988aa9116c5&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
  },
  {
    name: 'TRACEPOINT',
    link: 'https://www.youtube.com/@tracepoint.tracepoint',
  },
];

export default function LavenderBayPage() {
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
                <p className="font-light">Techno Renegade</p>
                <p className="font-bold" style={{ color: LAVENDER }}>July 17 — 7 PM</p>
                <p className="font-light">Mission Bay, San Diego</p>
              </div>
            </div>
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center gap-2">
              <p className="text-sm tracking-widest" style={{ color: LAVENDER }}>LINEUP</p>
              <svg className="w-6 h-6 bobbing-chevron" style={{ color: LAVENDER }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </section>

        {/* Info Section */}
        <section className="px-6 py-16 max-w-2xl mx-auto">
          <div className="space-y-8">
            

            {/* Lineup Section */}
            <div className="text-center">
              <div className="flex flex-wrap justify-center items-center gap-3">
                {DJS.map((dj, index) => (
                  <div key={dj.name} className="flex items-center gap-3">
                    <a
                      href={dj.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-3xl font-bold tracking-wide hover:opacity-80 transition"
                      style={{ color: LAVENDER }}
                    >
                      {dj.name}
                    </a>
                    {index < DJS.length - 1 && (
                      <span className="text-gray-300">•</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Tacos & RSVP Section with Background Image */}
        <section className="relative w-full py-16 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'url(/images/events/lavbay2.JPG)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: 'scaleY(-1)',
            }}
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 px-6 max-w-2xl mx-auto space-y-8">
            {/* Proceeds Section */}
            <div className="text-center py-10 px-6 space-y-0">
              <h2 className="text-gray-300 text-xl font-bold tracking-wider">
                Food • Art • Visuals
                <br />
                <br />
                All Proceeds to
              </h2>
              <a
                href="https://www.alotrolado.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-3 text-2xl font-black tracking-wider hover:opacity-80 transition"
                style={{ color: LAVENDER }}
              >
                AL OTRO LADO
              </a>
              <p className="text-gray-300 text-sm mt-3">
                Immigrant rights & mutual aid
              </p>
            </div>

            {/* RSVP Section */}
            <div>
              <EventRsvpForm eventSlug="techno" successPath="/events/techno/success" />
            </div>
          </div>
        </section>

        

      </div>
    </PageWrapper>
  );
}
