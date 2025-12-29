import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PeopleGalleryClient from "./PeopleGalleryClient";

// Photo data for each category
const categoryPhotos: Record<string, {
  title: string;
  description: string;
  photos: Array<{ src: string; alt: string; caption?: string }>;
}> = {
  friends: {
    title: "Friends",
    description: "Memories with friends",
    photos: [
      { src: "/images/gallery/friends/000000040005.JPG", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/000219520014.jpg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/000798260021.JPG", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/0D487A99-E14C-431D-8937-AD7876A0C500.jpg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/DSCF1049.jpeg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/East and High Sierra-0029.jpeg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/IMG_3271.JPG", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/IMG_3828.jpeg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/IMG_4025.jpeg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/IMG_7032.jpeg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/IMG_7283.PNG", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/IMG_7331.JPG", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/IMG_7726.jpeg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/IMG_9726.PNG", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/Joel_bday-0011.jpeg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/Joel_bday-0017.jpeg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/Valley_E100-0013.jpeg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/Valley_E100-0020.jpeg", alt: "Friends", caption: "" },
      { src: "/images/gallery/friends/_DSC1395.jpeg", alt: "Friends", caption: "" },
    ]
  },
  palestinepals: {
    title: "Palestine Pals",
    description: "Climbing for a cause",
    photos: [
      { src: "/images/gallery/palestinepals/8ee28ed5-c2f3-4781-94.jpg", alt: "Palestine Pals", caption: "" },
      { src: "/images/gallery/palestinepals/Climbers for Palestine_crop-0002.jpeg", alt: "Palestine Pals", caption: "" },
      { src: "/images/gallery/palestinepals/IMG_5658.jpg", alt: "Palestine Pals", caption: "" },
    ]
  },
  family: {
    title: "Family",
    description: "Family moments",
    photos: []
  }
};

export default async function PeopleGallery({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const gallery = categoryPhotos[category];

  if (!gallery) {
    notFound();
  }

  return <PeopleGalleryClient gallery={gallery} />;
}

// Generate static params for all categories
export async function generateStaticParams() {
  return Object.keys(categoryPhotos).map((category) => ({
    category: category,
  }));
}
