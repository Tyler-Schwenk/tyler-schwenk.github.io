import Link from "next/link";
import Image from "next/image";

interface ProjectCardProps {
  title: string;
  description: string;
  href: string;
  image: string;
  imageAlt: string;
}

export default function ProjectCard({ title, description, href, image, imageAlt }: ProjectCardProps) {
  return (
    <Link
      href={href}
      className="block group bg-slate-800 rounded-lg border border-slate-700 hover:border-orange-500 transition-all hover:transform hover:scale-105 overflow-hidden"
    >
      <div className="relative h-48 w-full bg-slate-900">
        <Image
          src={image}
          alt={imageAlt}
          fill
          className="object-cover group-hover:opacity-90 transition-opacity"
        />
      </div>
      <div className="p-6">
        <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-orange-500 transition-colors">
          {title}
        </h3>
        <p className="text-slate-400">{description}</p>
      </div>
    </Link>
  );
}
