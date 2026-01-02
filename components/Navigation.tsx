import Link from "next/link";

export default function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[9999] bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold text-white hover:text-orange-500 transition-colors">
            Tyler Schwenk
          </Link>
          <ul className="flex space-x-8">
            <li>
              <Link href="/#home" className="text-slate-300 hover:text-orange-500 transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link href="/#projects" className="text-slate-300 hover:text-orange-500 transition-colors">
                Projects
              </Link>
            </li>
            <li>
              <Link href="/#contact" className="text-slate-300 hover:text-orange-500 transition-colors">
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
