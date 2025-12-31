"use client";

import PageWrapper from "@/components/PageWrapper";
import Image from "next/image";

export default function Cookbook() {
  return (
    <PageWrapper>
    <div className="min-h-screen bg-cover bg-center bg-fixed py-20" style={{ backgroundImage: "url('/images/woodbackground.jpg')" }}>
      <div className="container mx-auto px-6 max-w-4xl">
        
        {/* Title */}
        <div className="bg-gradient-to-br from-amber-800 to-amber-900 p-8 mb-8 shadow-2xl rounded-lg border-4 border-amber-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyYWluIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIiB3aWR0aD0iNjAiIGhlaWdodD0iNjAiPjxyZWN0IHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgZmlsbD0iIzAwMDAwMDAzIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyYWluKSIvPjwvc3ZnPg==')] opacity-40"></div>
          <h1 className="text-4xl md:text-5xl font-bold text-amber-50 text-center relative z-10 drop-shadow-[2px_2px_4px_rgba(0,0,0,0.5)]" style={{ fontFamily: 'Georgia, serif' }}>
            The Kitchen
          </h1>
        </div>

        {/* Submit Recipe Section */}
        <section className="mb-12">
          <div className="bg-gradient-to-br from-amber-100 to-orange-100 p-8 shadow-xl rounded-lg border-2 border-amber-300">
            <h2 className="text-3xl font-bold text-amber-900 mb-6 text-center" style={{ fontFamily: 'Georgia, serif' }}>
              Share Your Recipe
            </h2>
            <div className="space-y-4">
              <p className="text-amber-800 text-center mb-6 text-lg leading-relaxed" style={{ fontFamily: 'Georgia, serif' }}>
                Help, I need to think of something to eat every day or I die!
              </p>
              <a 
                href="https://forms.gle/5WZb1k6DvaceAnfa7" 
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="bg-gradient-to-br from-amber-200 to-orange-200 p-6 hover:from-orange-300 hover:to-amber-300 transition-all cursor-pointer shadow-lg rounded-lg border-2 border-amber-400 hover:border-amber-600">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-amber-900 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                        Submit Your Recipe
                      </h3>
                      <p className="text-sm text-amber-700" style={{ fontFamily: 'Georgia, serif' }}>
                        Click to open submission form
                      </p>
                    </div>
                    
                  </div>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Main Download Section */}
        <section className="mb-12">
          <div className="bg-gradient-to-br from-yellow-100 to-amber-100 p-8 shadow-xl rounded-lg border-2 border-amber-300">
            <h2 className="text-3xl font-bold text-amber-900 mb-6 text-center" style={{ fontFamily: 'Georgia, serif' }}>
              Download the Cookbook
            </h2>
            <div className="space-y-4">
              
              {/* Image */}
              <div className="flex justify-center mb-6">
                <Image 
                  src="/images/recipies.png" 
                  alt="Recipes" 
                  width={400} 
                  height={300}
                  className="rounded-lg shadow-lg"
                />
              </div>
              
              <a 
                href="https://drive.google.com/file/d/13BWPrmZUnqTKYk3aeeXbBb_ateAsxtT5/view?usp=sharing" 
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="bg-gradient-to-br from-amber-200 to-orange-200 p-6 hover:from-orange-300 hover:to-amber-300 transition-all cursor-pointer shadow-lg rounded-lg border-2 border-amber-400 hover:border-amber-600">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-amber-900 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                        Recipies from Friends and Friends of Friends
                      </h3>
                      <p className="text-sm text-amber-700" style={{ fontFamily: 'Georgia, serif' }}>
                        Click to view/download PDF
                      </p>
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Featured Recipes Section */}
        <section className="mb-12">
          <div className="bg-gradient-to-br from-yellow-100 to-amber-100 p-8 shadow-xl rounded-lg border-2 border-amber-300">
            <h2 className="text-3xl font-bold text-amber-900 mb-6 text-center" style={{ fontFamily: 'Georgia, serif' }}>
              Featured Recipes
            </h2>
            <div className="space-y-4">
              <RecipeCard 
                name="Coming Soon" 
                description="Featured recipes will appear here"
              />
            </div>
          </div>
        </section>

      </div>
    </div>
    </PageWrapper>
  );
}

function RecipeCard({ 
  name, 
  description 
}: { 
  name: string; 
  description: string;
}) {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-md rounded-lg border-2 border-amber-300 hover:border-amber-500 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-amber-900 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            {name}
          </h3>
          <p className="text-sm text-amber-700" style={{ fontFamily: 'Georgia, serif' }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function TipCard({ 
  tip, 
  description 
}: { 
  tip: string; 
  description: string;
}) {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-md rounded-lg border-2 border-amber-300">
      <div className="flex items-center gap-4">
        <span className="text-3xl">💡</span>
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-amber-900 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            {tip}
          </h3>
          <p className="text-sm text-amber-700" style={{ fontFamily: 'Georgia, serif' }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
