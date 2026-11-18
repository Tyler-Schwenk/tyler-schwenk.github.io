"use client";

import { useEffect, useState } from "react";

import { DISCO_HIGHLIGHTS } from "./constants";
import DiscoText from "./DiscoText";
import { BoxRow, DiamondRow, DiscoBall, StarField } from "./Ornaments";
import { deliverFlierCard, renderFlierCard, type FlierCardInfo, type SaveResult } from "./saveFlierCard";
import styles from "./disco.module.css";

// lines pop in one after another as the clouds clear
const TITLE_DELAY_MS = 600;
const DETAILS_DELAY_MS = 1400;
const HIGHLIGHT_DELAY_MS = 1900;
const HIGHLIGHT_STAGGER_MS = 350;

const SAVE_MESSAGES: Record<SaveResult, string> = {
  shared: "saved! see you on the dance floor",
  downloaded: "downloaded disco-december.png",
  cancelled: "",
};

interface DiscoFlierProps {
  info: FlierCardInfo;
  /** phones get the share sheet for saving, desktops get a download */
  isMobile: boolean;
  /** play the invite video again from the start */
  onReplay: () => void;
}

/**
 * the flier under the clouds: event details in the video's style, a spinning disco
 * ball, stars, and a button to save it all as an image.
 * @param {DiscoFlierProps} props - event details, device type, and the replay handler.
 * @returns {JSX.Element} the full screen, scrollable flier.
 */
export default function DiscoFlier({ info, isMobile, onReplay }: DiscoFlierProps) {
  const [card, setCard] = useState<Blob | null>(null);
  const [status, setStatus] = useState("");
  const { title, dateText, locationText } = info;

  useEffect(() => {
    let cancelled = false;
    renderFlierCard({ title, dateText, locationText })
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
  }, [title, dateText, locationText]);

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
      <div className={styles.flierContent}>
        <DiscoBall />
        <BoxRow />
        <DiscoText as="h1" text={title} className={styles.title} delayMs={TITLE_DELAY_MS} />
        <DiamondRow />

        <dl className={styles.details}>
          <dt className={styles.detailLabel}>When</dt>
          <dd className={styles.detailValue}>
            <DiscoText text={dateText} delayMs={DETAILS_DELAY_MS} />
          </dd>
          <dt className={styles.detailLabel}>Where</dt>
          <dd className={styles.detailValue}>
            <DiscoText text={locationText} delayMs={DETAILS_DELAY_MS} />
          </dd>
        </dl>

        <ul className={styles.highlights}>
          {DISCO_HIGHLIGHTS.map((line, i) => (
            <li key={line}>
              <DiscoText text={line} delayMs={HIGHLIGHT_DELAY_MS + i * HIGHLIGHT_STAGGER_MS} />
            </li>
          ))}
        </ul>

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
