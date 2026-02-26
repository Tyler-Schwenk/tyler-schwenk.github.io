export type CommunityBoardLink = {
  id: string;
  name: string;
  href: string;
  description: string;
  isHeader?: boolean;
};

export const COMMUNITY_BOARD_LINKS: CommunityBoardLink[] = [
  {
    id: "header-friends",
    name: "Friends",
    href: "",
    description: "",
    isHeader: true,
  },
  {
    id: "jeff",
    name: "Jeff",
    href: "https://myhalfbakedideas.com/",
    description: "Friend project and ideas",
  },
  {
    id: "tava",
    name: "Tava",
    href: "https://tavakessler.com/",
    description: "Friend portfolio",
  },
  {
    id: "vishal",
    name: "Vishal",
    href: "https://vish.ventures/",
    description: "Friend projects and writing",
  },
  {
    id: "franky",
    name: "Franky",
    href: "https://frankyhanen.com/",
    description: "Friend site",
  },
  {
    id: "fiona",
    name: "Fiona",
    href: "https://fiona-sullivan.github.io/",
    description: "Friend portfolio",
  },
  {
    id: "tommy",
    name: "Tommy (DJ TommyPips)",
    href: "https://soundcloud.com/byrdmp3/spectrum-techno-presents-live-from-the-techno-jungle-w-tommypips",
    description: "Spectrum Techno - Live from the Techno Jungle",
  },
  {
    id: "header-local-orgs",
    name: "Beloved Local Orgs",
    href: "",
    description: "",
    isHeader: true,
  },
  {
    id: "bikes-del-pueblo",
    name: "Bikes del Pueblo",
    href: "https://www.bikesdelpueblo.org/",
    description: "Beloved local organization",
  },
  {
    id: "al-otro-lado",
    name: "Al Otro Lado",
    href: "https://www.alotrolado.org/",
    description: "Beloved local organization",
  },
  {
    id: "border-angels",
    name: "Border Angels",
    href: "https://www.borderangels.org/",
    description: "Beloved local organization",
  },
  {
    id: "climbers-for-palestine-sd",
    name: "Climbers for Palestine SD",
    href: "https://www.instagram.com/climbersforpalestine_sd/",
    description: "Beloved local organization",
  },
  {
    id: "header-inspirations",
    name: "Other Inspirations",
    href: "",
    description: "",
    isHeader: true,
  },
  {
    id: "botpa",
    name: "BOTPA",
    href: "https://botpa.vercel.app/",
    description: "Cool app",
  },
  {
    id: "tom7",
    name: "Tom7",
    href: "https://tom7.org/index.html",
    description: "Computer scientist whose work I enjoy",
  },
];
