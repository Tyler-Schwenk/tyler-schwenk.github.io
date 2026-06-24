'use client';

import Image from 'next/image';
import PageWrapper from '@/components/PageWrapper';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Horizon:wght@400;700&display=swap');
`;

export default function TechnoRsvpSuccessPage() {
  return (
    <PageWrapper hideFooter hideNavigation>
      <style>{styles}</style>
      <div className="min-h-screen w-full bg-black flex flex-col items-center" style={{ fontFamily: 'Horizon, sans-serif' }}>
        <div className="text-center px-6 py-10">
          <p className="text-gray-300 text-2xl font-bold tracking-wider">We got your RSVP</p>
          <p className="text-gray-300 text-base mt-3 tracking-wide">Location will be sent the day before</p>
        </div>
        <div className="w-full">
          <Image
            src="/images/events/lav_flier.png"
            alt="Lavender Bay flier"
            width={1200}
            height={1600}
            className="w-full h-auto"
            priority
          />
        </div>
      </div>
    </PageWrapper>
  );
}
