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
      { src: "/images/gallery/palestinepals/IMG_4761.jpg", alt: "Palestine Pals", caption: "" },
      { src: "/images/gallery/palestinepals/IMG_5658.jpg", alt: "Palestine Pals", caption: "" },
      { src: "/images/gallery/palestinepals/IMG_6646.jpg", alt: "Palestine Pals", caption: "" },
      { src: "/images/gallery/palestinepals/IMG_7078_Original.jpg", alt: "Palestine Pals", caption: "" },
      { src: "/images/gallery/palestinepals/IMG_9262.jpg", alt: "Palestine Pals", caption: "" },
      { src: "/images/gallery/palestinepals/IMG_9921.jpg", alt: "Palestine Pals", caption: "" },
    ]
  },
  family: {
    title: "Family",
    description: "Family moments",
    photos: [
      { src: "/images/gallery/family/IMG_3024.jpg", alt: "Family", caption: "" },
      { src: "/images/gallery/family/IMG_3524.jpg", alt: "Family", caption: "" },
      { src: "/images/gallery/family/IMG_3785.jpg", alt: "Family", caption: "" },
      { src: "/images/gallery/family/IMG_3791.jpg", alt: "Family", caption: "" },
    ]
  },
  college: {
    title: "College",
    description: "College memories at SDSU",
    photos: [
      { src: "/images/gallery/college/20181021_115353.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/20190405_185644.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_0142.JPG", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_1161.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_1225.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_1263.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_1296.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_1473.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_1481.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_1492.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_1645.jpeg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_1782.JPG", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_1973.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_3025.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_3187.JPG", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_3202.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_3536.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_3895.JPG", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_4819.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_5148.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_5789.JPG", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_6366.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_6641.JPG", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_6690.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_7143.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_7187.JPG", alt: "College", caption: "" },
      { src: "/images/gallery/college/IMG_8478.jpg", alt: "College", caption: "" },
      { src: "/images/gallery/college/Screenshot_20180602-133417_Photos.jpg", alt: "College", caption: "" },
    ]
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
