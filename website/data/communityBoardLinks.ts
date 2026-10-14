/** one note on the community board — a link out to someone else's corner of the web */
export type CommunityBoardLink = {
  id: string;
  name: string;
  href: string;
  description: string;
};

/** a labeled cluster of notes on the board */
export type CommunityBoardSection = {
  id: string;
  title: string;
  links: CommunityBoardLink[];
};

// ids drive each note's paper, pin, and tilt, so changing an id reshuffles that note's look
export const COMMUNITY_BOARD_SECTIONS: CommunityBoardSection[] = [
  {
    id: "friends",
    title: "Friends",
    links: [
      {
        id: "jeff",
        name: "Jeff",
        href: "https://jeffsdigitalworld.com/",
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
        id: "sam",
        name: "Sam",
        href: "https://www.samuelsfilm.com/",
        description: "Friend film portfolio",
      },
      {
        id: "fiona",
        name: "Fiona",
        href: "https://fiona-sullivan.github.io/",
        description: "Friend portfolio",
      },
      {
        id: "kyle",
        name: "Kyle",
        href: "https://kylewuzhere.com/#/welcome/",
        description: "Friend site",
      },
      {
        id: "tommy",
        name: "Tommy (DJ TommyPips)",
        href: "https://soundcloud.com/byrdmp3/spectrum-techno-presents-live-from-the-techno-jungle-w-tommypips",
        description: "Spectrum Techno - Live from the Techno Jungle",
      },
    ],
  },
  {
    id: "local-orgs",
    title: "Beloved Local Orgs",
    links: [
      {
        id: "bikes-del-pueblo",
        name: "Bikes del Pueblo",
        href: "https://www.bikesdelpueblo.org/",
        description: "Community bike shop",
      },
      {
        id: "al-otro-lado",
        name: "Al Otro Lado",
        href: "https://www.alotrolado.org/",
        description: "Legal aid for migrants and refugees",
      },
      {
        id: "border-angels",
        name: "Border Angels",
        href: "https://www.borderangels.org/",
        description: "Migrant advocacy and water drops",
      },
      {
        id: "climbers-for-palestine-sd",
        name: "Climbers for Palestine SD",
        href: "https://www.instagram.com/climbersforpalestine_sd/",
        description: "Climbing community organizing",
      },
      {
        id: "kpbs-sd-news",
        name: "KPBS San Diego News Now",
        href: "https://www.kpbs.org/podcasts/san-diego-news-now",
        description: "Daily local news podcast",
      },
    ],
  },
  {
    id: "inspirations",
    title: "Other Inspirations",
    links: [
      {
        id: "tom7",
        name: "Tom7",
        href: "https://tom7.org/index.html",
        description: "Computer scientist whose work I enjoy",
      },
      {
        id: "botpa",
        name: "BOTPA",
        href: "https://botpa.vercel.app/",
        description: "Cool app",
      },
    ],
  },
  {
    id: "personal",
    title: "Personal Links",
    links: [
      {
        id: "goodreads",
        name: "Goodreads",
        href: "https://www.goodreads.com/user/show/179009098-tyler-schwenk",
        description: "What I'm reading",
      },
    ],
  },
];
