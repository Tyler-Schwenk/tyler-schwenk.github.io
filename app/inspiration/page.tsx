"use client";

export default function Inspiration() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-black py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        
        {/* Title */}
        <div className="border-4 border-yellow-400 bg-blue-900 p-6 mb-8 shadow-2xl">
          <h1 className="text-4xl md:text-5xl font-bold text-yellow-400 text-center pixel-font tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            💡 INSPIRATION
          </h1>
        </div>

        {/* Friends Section */}
        <section className="mb-12">
          <div className="border-4 border-cyan-400 bg-blue-900/80 p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-yellow-300 pixel-font mb-6 text-center">
              ✨ FRIENDS
            </h2>
            <div className="space-y-3">
              <LinkCard href="https://myhalfbakedideas.com/" name="JEFF" />
              <LinkCard href="https://tavakessler.com/" name="TAVA" />
              <LinkCard href="https://vish.ventures/" name="VISHAL" />
              <LinkCard href="https://frankyhanen.com/" name="FRANKY" />
            </div>
          </div>
        </section>

        {/* Other Inspirations Section */}
        <section>
          <div className="border-4 border-cyan-400 bg-blue-900/80 p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-yellow-300 pixel-font mb-6 text-center">
              🌟 OTHER INSPIRATIONS
            </h2>
            <div className="space-y-3">
              <LinkCard href="https://botpa.vercel.app/" name="BOTPA" description="Cool app I like" />
              <LinkCard href="https://tom7.org/index.html" name="TOM7" description="Computer scientist whose work I enjoy" />
            </div>
          </div>
        </section>

      </div>

      {/* Add pixel font style */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        
        .pixel-font {
          font-family: 'Press Start 2P', cursive;
          image-rendering: pixelated;
          -webkit-font-smoothing: none;
        }
      `}</style>
    </div>
  );
}

function LinkCard({ 
  href, 
  name, 
  description 
}: { 
  href: string; 
  name: string; 
  description?: string;
}) {
  return (
    <a 
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="border-2 border-cyan-400 bg-blue-950 p-4 hover:bg-cyan-400 hover:border-yellow-400 transition-all cursor-pointer shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <h3 className="pixel-font text-sm text-yellow-300 group-hover:text-blue-950 mb-1">
              {name}
            </h3>
            {description && (
              <p className="text-xs text-cyan-300 group-hover:text-blue-900 font-mono">
                {description}
              </p>
            )}
          </div>
          <span className="text-yellow-300 group-hover:text-blue-950 pixel-font text-sm group-hover:animate-pulse">
            ▶
          </span>
        </div>
      </div>
    </a>
  );
}
