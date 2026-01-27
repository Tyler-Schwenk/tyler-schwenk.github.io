"use client";

import PageWrapper from "@/components/PageWrapper";

export default function SDWorkspaces() {
  return (
    <PageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-black py-20">
        <div className="container mx-auto px-6 max-w-6xl">
          
          {/* Title */}
          <div className="bg-[#3850A0] border-4 border-black p-6 mb-8 shadow-2xl">
            <h1 className="text-3xl md:text-5xl font-bold text-[#F8D030] text-center pixel-font tracking-wider drop-shadow-[3px_3px_0_rgba(0,0,0,1)]">
              SD WORKSPACES
            </h1>
          </div>

          {/* Description Section */}
          <div className="bg-[#2840A0] border-2 border-black p-6 mb-6 shadow-md">
            <p className="text-white pixel-font text-sm leading-relaxed">
              Tava and I have been on a mission to find the best workspaces in San Diego. 
              We rate coffee shops, cafes, and other venues based on their workability - 
              including wifi, seating, ambiance, and of course, the coffee quality.
            </p>
          </div>

          {/* Embedded Google Sheets */}
          <div className="bg-white border-4 border-black shadow-2xl">
            <div className="w-full" style={{ height: 'calc(100vh - 350px)', minHeight: '600px' }}>
              <iframe 
                src="https://docs.google.com/spreadsheets/d/e/2PACX-1vQb8v471W90j8OrmKpMlij5kMDcZBvbOMaYNJnM_8RwnGw4LGEIAy4gl1aFUk6B8ZSavJ83Nw_-dnDz/pubhtml?gid=0&amp;single=true&amp;widget=true&amp;headers=false"
                className="w-full h-full border-0"
                title="SD Workspaces Rating System"
              />
            </div>
          </div>

        </div>
      </div>
    </PageWrapper>
  );
}
