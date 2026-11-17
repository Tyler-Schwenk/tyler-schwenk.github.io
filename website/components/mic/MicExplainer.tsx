"use client";

import { useCallback, useState } from "react";
import { MIC_LAYOUT_TALL, MIC_LAYOUT_WIDE, MIC_PAGE_COPY, type MicFlowKind } from "@/app/mic/micData";
import MicDetailPanel from "./MicDetailPanel";
import MicFlowDiagram, { type MicSelection } from "./MicFlowDiagram";
import styles from "./mic.module.css";

const LEGEND: { kind: MicFlowKind; label: string }[] = [
  { kind: "money", label: "Money" },
  { kind: "weapons", label: "Weapons" },
  { kind: "influence", label: "Influence" },
];

/**
 * the whole /mic page: header, legend, the diagram, and the detail panel for
 * whatever's been clicked. both layouts render and css picks one, so the static
 * export never flashes the wrong one.
 * @returns {JSX.Element} the page body.
 */
export default function MicExplainer() {
  const [selected, setSelected] = useState<MicSelection | null>(null);
  const close = useCallback(() => setSelected(null), []);

  // clicking the selected thing again closes it
  const toggle = (selection: MicSelection) => {
    const same = selected?.type === selection.type && selected.id === selection.id;
    setSelected(same ? null : selection);
  };

  return (
    <main className={`${styles.page} ${selected ? styles.panelOpen : ""}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>{MIC_PAGE_COPY.title}</h1>
        {MIC_PAGE_COPY.intro && <p className={styles.intro}>{MIC_PAGE_COPY.intro}</p>}
        <ul className={styles.legend}>
          {LEGEND.map((entry) => (
            <li key={entry.kind} className={`${styles.legendItem} ${styles[entry.kind]}`}>
              <span className={styles.legendSwatch} aria-hidden="true" />
              {entry.label}
            </li>
          ))}
        </ul>
        <p className={styles.hint}>{MIC_PAGE_COPY.hint}</p>
      </header>

      <div className={styles.stage}>
        <MicFlowDiagram layout={MIC_LAYOUT_WIDE} selected={selected} onSelect={toggle} className={styles.wideOnly} />
        <MicFlowDiagram layout={MIC_LAYOUT_TALL} selected={selected} onSelect={toggle} className={styles.tallOnly} />
      </div>

      <MicDetailPanel selection={selected} onClose={close} />
    </main>
  );
}
