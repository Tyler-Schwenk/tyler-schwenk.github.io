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
        description: "Jeff is an inspiratin in clean UI/UX",
      },
      {
        id: "tava",
        name: "Tava",
        href: "https://tavakessler.com/",
        description: "My mom loves Tava's videos",
      },
      {
        id: "vishal",
        name: "Vishal",
        href: "https://vish.ventures/",
        description: "Great photos and writing",
      },
      {
        id: "franky",
        name: "Franky",
        href: "https://frankyhanen.com/",
        description: "Also great film & photography",
      },
      {
        id: "sam",
        name: "Sam",
        href: "https://www.samuelsfilm.com/",
        description: "His film portfolio",
      },
      {
        id: "kyle",
        name: "Kyle",
        href: "https://kylewuzhere.com/#/welcome/",
        description: "Awesome fun site with much to explore",
      },
      {
        id: "tommy",
        name: "Tommy (DJ TommyPips)",
        href: "https://soundcloud.com/byrdmp3/spectrum-techno-presents-live-from-the-techno-jungle-w-tommypips",
        description: "He goes by Tracepoint now!!",
      },
      {
        id: "rimma",
        name: "Rimma",
        href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12871695/",
        description: "Her PhD paper. I dont get it",
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
        description: "They will show you how to fix your bike & give you parts for cheap",
      },
      {
        id: "al-otro-lado",
        name: "Al Otro Lado",
        href: "https://www.alotrolado.org/",
        description: "Legal aid & more for migrants and refugees",
      },
      {
        id: "climbers-for-palestine-sd",
        name: "Climbers for Palestine SD",
        href: "https://www.instagram.com/climbersforpalestine_sd/",
        description: "Title says it all, come join us!",
      },
      {
        id: "kpbs-sd-news",
        name: "KPBS San Diego News Now",
        href: "https://www.kpbs.org/podcasts/san-diego-news-now",
        description: "Where I get most of my news these days",
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
