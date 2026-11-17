import { useEffect } from "react";
import { MIC_FLOWS, MIC_NODES, type MicDetail, type MicFlowKind } from "@/app/mic/micData";
import type { MicSelection } from "./MicFlowDiagram";
import styles from "./mic.module.css";

const KIND_LABELS: Record<MicFlowKind, string> = {
  money: "Money",
  weapons: "Weapons",
  influence: "Influence",
};

/** what the panel shows for a selection */
interface PanelContent {
  kicker: string;
  title: string;
  detail: MicDetail;
}

/**
 * looks up the title and copy for whatever's selected.
 * @param {MicSelection} selection - the selected node or flow.
 * @returns {PanelContent | null} the panel content, or null if the id isn't in the data.
 */
function panelContent(selection: MicSelection): PanelContent | null {
  if (selection.type === "node") {
    const node = MIC_NODES.find((candidate) => candidate.id === selection.id);
    return node ? { kicker: "Who", title: node.label, detail: node.detail } : null;
  }
  const flow = MIC_FLOWS.find((candidate) => candidate.id === selection.id);
  if (!flow) return null;
  const fromLabel = MIC_NODES.find((node) => node.id === flow.from)?.label ?? flow.from;
  const toLabel = MIC_NODES.find((node) => node.id === flow.to)?.label ?? flow.to;
  return { kicker: `${KIND_LABELS[flow.kind]}: ${fromLabel} to ${toLabel}`, title: flow.label, detail: flow.detail };
}

/**
 * the side panel (bottom sheet on phones) with the summary, numbers, and
 * sources for the selected node or flow. escape closes it.
 * @param {object} props - component props.
 * @param {MicSelection | null} props.selection - what's selected; nothing renders when null.
 * @param {() => void} props.onClose - runs when the panel is closed.
 * @returns {JSX.Element | null} the panel.
 */
export default function MicDetailPanel({ selection, onClose }: { selection: MicSelection | null; onClose: () => void }) {
  useEffect(() => {
    if (!selection) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selection, onClose]);

  if (!selection) return null;
  const content = panelContent(selection);
  if (!content) return null;
  const { kicker, title, detail } = content;

  return (
    <aside className={styles.panel} aria-label={`${title} details`}>
      <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close details">
        &times;
      </button>
      <p className={styles.kicker}>{kicker}</p>
      <h2 className={styles.panelTitle}>{title}</h2>
      <p className={styles.summary}>{detail.summary || "Details coming soon."}</p>

      {detail.stats.length > 0 && (
        <ul className={styles.stats}>
          {detail.stats.map((stat) => (
            <li key={`${stat.value}-${stat.label}`} className={styles.stat}>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
              {stat.sourceUrl && (
                <a href={stat.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.statSource}>
                  source
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {detail.sources.length > 0 && (
        <>
          <h3 className={styles.sourcesHeading}>Sources</h3>
          <ul className={styles.sources}>
            {detail.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
