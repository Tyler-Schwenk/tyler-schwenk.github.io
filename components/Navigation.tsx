import Link from "next/link";
import Image from "next/image";

export default function Navigation() {
  return (
    <nav className="fixed top-4 left-4 z-[9999]">
      <Link href="/" aria-label="Return to home" className="relative block h-12 w-12 sm:h-14 sm:w-14">
        <Image
          src="/images/8bit/crlf_8bit.png"
          alt=""
          fill
          priority
          className="object-contain pixelated"
          sizes="(max-width: 640px) 48px, 56px"
        />
      </Link>
    </nav>
  );
}
