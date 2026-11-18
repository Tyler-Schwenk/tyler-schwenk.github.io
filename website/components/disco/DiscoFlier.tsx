"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { DISCO_ADDRESS, DISCO_DETAILS } from "./constants";
import DiscoText from "./DiscoText";
import {
  BellBottoms,
  BoxRow,
  DiamondRow,
  DiscoBall,
  NoPhoneIcon,
  PosterCircles,
  PosterStars,
  StarField,
} from "./Ornaments";
import { deliverFlierCard, renderFlierCard, type FlierCardInfo, type SaveResult } from "./saveFlierCard";
import { useMapsUrl } from "./useMapsUrl";
import styles from "./disco.module.css";

// the poster's blocks rise in one after another as the clouds clear
const KICKER_DELAY_MS = 400;
const TITLE_DELAY_MS = 600;
const TITLE_WORD_STAGGER_MS = 450;
const BOXES_DELAY_MS = 1300;
const FEATURING_DELAY_MS = 1600;
const ATTIRE_DELAY_MS = 1900;
const FACTS_DELAY_MS = 2200;
const PHONES_DELAY_MS = 2600;

const SAVE_MESSAGES: Record<SaveResult, string> = {
  shared: "saved! see you on the dance floor",
  downloaded: "downloaded disco-december.png",
  cancelled: "",
};

/**
 * the inline style that holds a block back until its turn to rise in.
 * @param {number} delayMs - how long after the flier appears it should start.
 * @returns {CSSProperties} the delay as the --rise-delay css variable.
 */
function riseDelay(delayMs: number): CSSProperties {
  return { "--rise-delay": `${delayMs}ms` } as CSSProperties;
}

interface DiscoFlierProps {
  info: FlierCardInfo;
  /** phones get the share sheet for saving, desktops get a download */
  isMobile: boolean;
  /** play the invite video again from the start */
  onReplay: () => void;
}

/**
 * the flier under the clouds, laid out like an old disco flier: a framed poster
 * with a tilted title, overlapping circles, stars, a hanging disco ball, and the
 * details set off to either side. the address opens in the person's maps app.
 * @param {DiscoFlierProps} props - the event title, device type, and the replay handler.
 * @returns {JSX.Element} the full screen, scrollable flier.
 */
export default function DiscoFlier({ info, isMobile, onReplay }: DiscoFlierProps) {
  const [card, setCard] = useState<Blob | null>(null);
  const [status, setStatus] = useState("");
  const mapsUrl = useMapsUrl(DISCO_ADDRESS);
  const { title } = info;
  // geo: links hand off to an app, https ones open best in a new tab
  const opensInNewTab = mapsUrl.startsWith("https:");

  useEffect(() => {
    let cancelled = false;
    renderFlierCard({ title })
      .then((blob) => {
        if (!cancelled) {
          setCard(blob);
        }
      })
      .catch((error: unknown) => {
        console.error("disco invite: couldn't draw the flier card for saving", error);
        if (!cancelled) {
          setStatus("couldn't make the image, sorry. a screenshot works too");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [title]);

  /** hands over the pre-drawn card, straight from the tap so ios allows the share sheet */
  const handleSave = () => {
    if (!card) {
      setStatus("still drawing it, try again in a sec");
      return;
    }
    deliverFlierCard(card, title, isMobile)
      .then((result) => setStatus(SAVE_MESSAGES[result]))
      .catch((error: unknown) => {
        console.error("disco invite: sharing the flier card failed", error);
        setStatus("couldn't share the image. a screenshot works too");
      });
  };

  return (
    <div className={styles.flier}>
      <StarField />
      <div className={styles.flierScroll}>
        <article className={styles.poster}>
          <PosterCircles />
          <PosterStars />

          <p className={`${styles.kicker} ${styles.rise}`} style={riseDelay(KICKER_DELAY_MS)}>
            {DISCO_DETAILS.kicker}
          </p>
          <div className={styles.ballSlot}>
            <DiscoBall />
          </div>

          <div className={styles.titleBlock}>
            <div className={styles.speedStripes} aria-hidden="true" />
            <h1 className={styles.title} aria-label={title}>
              {title.split(" ").map((word, i) => (
                <DiscoText
                  key={word}
                  text={word}
                  className={styles.titleWord}
                  delayMs={TITLE_DELAY_MS + i * TITLE_WORD_STAGGER_MS}
                />
              ))}
            </h1>
          </div>

          <div className={`${styles.boxSlot} ${styles.rise}`} style={riseDelay(BOXES_DELAY_MS)}>
            <BoxRow />
          </div>

          <section className={`${styles.featuring} ${styles.rise}`} style={riseDelay(FEATURING_DELAY_MS)}>
            <h2 className={styles.script}>Featuring:</h2>
            {DISCO_DETAILS.lineup.map((act, i) => (
              <p key={act} className={styles.act}>
                {i > 0 && <span className={styles.actJoin}>+ </span>}
                <DiscoText text={act} delayMs={FEATURING_DELAY_MS} />
              </p>
            ))}
          </section>

          <section className={`${styles.attire} ${styles.rise}`} style={riseDelay(ATTIRE_DELAY_MS)}>
            <BellBottoms />
            <h2 className={styles.script}>Attire:</h2>
            <p className={styles.attireText}>{DISCO_DETAILS.attire}</p>
          </section>

          <dl className={`${styles.facts} ${styles.rise}`} style={riseDelay(FACTS_DELAY_MS)}>
            <div className={styles.fact}>
              <dt className={styles.script}>Date:</dt>
              <dd>{DISCO_DETAILS.date}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.script}>Time:</dt>
              <dd>{DISCO_DETAILS.time}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.script}>Place:</dt>
              <dd>
                <a
                  className={styles.address}
                  href={mapsUrl}
                  target={opensInNewTab ? "_blank" : undefined}
                  rel={opensInNewTab ? "noopener noreferrer" : undefined}
                >
                  {DISCO_DETAILS.addressStreet}
                  <br />
                  {DISCO_DETAILS.addressCity}
                </a>
                <span className={styles.addressHint}>tap for directions</span>
              </dd>
            </div>
          </dl>

          <p className={`${styles.noPhones} ${styles.rise}`} style={riseDelay(PHONES_DELAY_MS)}>
            <NoPhoneIcon />
            <span>{DISCO_DETAILS.phones}</span>
          </p>

          <div className={styles.diamondSlot}>
            <DiamondRow />
          </div>
        </article>

        <div className={styles.flierActions}>
          <button type="button" className={styles.startButton} onClick={handleSave}>
            Save the info
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onReplay}>
            Watch again
          </button>
        </div>
        <p className={styles.saveStatus} role="status">
          {status}
        </p>
      </div>
    </div>
  );
}
