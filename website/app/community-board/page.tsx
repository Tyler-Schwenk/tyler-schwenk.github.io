import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import BoardLabel from "@/components/community-board/BoardLabel";
import BoardNote from "@/components/community-board/BoardNote";
import styles from "@/components/community-board/communityBoard.module.css";
import { COMMUNITY_BOARD_SECTIONS } from "@/data/communityBoardLinks";

// widest a section cluster gets on desktop before its notes wrap to a new row
const SECTION_MAX_COLUMNS = 3;

export const metadata: Metadata = {
  title: "Community Board",
  description: "Friends' websites, local orgs, and other corners of the web I like",
};

/**
 * The community board: a framed cork board with links to friends' sites and
 * other favorites, each pinned up as a note. sections come straight from
 * COMMUNITY_BOARD_SECTIONS, and the layout reflows from a two-across stack on
 * phones to side-by-side clusters on desktop.
 *
 * @returns {JSX.Element} Community board page.
 */
export default function CommunityBoard() {
  return (
    <>
      <Navigation />
      <main className={styles.wall}>
        <div className={styles.frame}>
          <div className={styles.cork}>
            <div className={styles.titleWrap}>
              <BoardLabel id="board-title" text="Community Board" as="h1" className={styles.titleLabel} />
            </div>
            <div className={styles.sections}>
              {COMMUNITY_BOARD_SECTIONS.map((section) => {
                const columns = Math.min(section.links.length, SECTION_MAX_COLUMNS);
                const sectionStyle = { "--section-cols": columns } as CSSProperties;

                return (
                  <section key={section.id} className={styles.section} style={sectionStyle}>
                    <BoardLabel id={section.id} text={section.title} />
                    <div className={styles.notes}>
                      {section.links.map((link) => (
                        <BoardNote key={link.id} link={link} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
