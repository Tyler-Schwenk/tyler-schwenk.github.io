/**
 * everything the /mic diagram shows: the nodes, the flows between them, where
 * they sit, and the copy for each one's detail panel. the components just draw
 * whatever's in here, so new copy, stats, sources, or even new nodes/flows only
 * need edits in this file.
 *
 * any summary left as "" shows "details coming soon" in its panel, and empty
 * stats/sources lists just don't render.
 */

export type MicNodeId = "taxpayers" | "congress" | "pentagon" | "contractors" | "israel" | "gaza";

/** what moves along a flow. sets its color, particle shape, and line style */
export type MicFlowKind = "money" | "weapons" | "influence";

export type MicIconName = "people" | "capitol" | "pentagon" | "factory" | "jet" | "homes";

/** one source link, shown at the bottom of a panel */
export interface MicSource {
  name: string;
  url: string;
}

/** one big number in a panel, e.g. { value: "$3.8B", label: "per year in military aid" } */
export interface MicStat {
  value: string;
  label: string;
  /** where the number comes from. makes the stat a link */
  sourceUrl?: string;
}

/** the copy behind a click */
export interface MicDetail {
  summary: string;
  stats: MicStat[];
  sources: MicSource[];
}

export interface MicNode {
  id: MicNodeId;
  label: string;
  icon: MicIconName;
  detail: MicDetail;
}

export interface MicFlow {
  id: string;
  from: MicNodeId;
  to: MicNodeId;
  kind: MicFlowKind;
  label: string;
  detail: MicDetail;
}

/** a labeled box drawn around a few nodes */
export interface MicGroup {
  id: string;
  label: string;
  nodeIds: MicNodeId[];
}

export interface MicPoint {
  x: number;
  y: number;
}

/** node positions for one screen shape, in that layout's svg units */
export interface MicLayout {
  width: number;
  height: number;
  /** room on each side of a group's nodes, wide enough for the longest node label */
  groupPadX: number;
  /**
   * how far each flow bows out sideways, by flow id, as a fraction of its length.
   * positive bows to the right of the direction of travel (as drawn on screen), negative to the left.
   * flows not listed are straight
   */
  flowBends: Record<string, number>;
  positions: Record<MicNodeId, MicPoint>;
}

/** top-of-page copy */
export const MIC_PAGE_COPY = {
  title: "The Military-Industrial Complex",
  intro: "",
  hint: "Tap anything to dig in",
};

/** a blank panel, for things that don't have copy yet */
const EMPTY_DETAIL: MicDetail = { summary: "", stats: [], sources: [] };

export const MIC_NODES: MicNode[] = [
  { id: "taxpayers", label: "Taxpayers", icon: "people", detail: EMPTY_DETAIL },
  { id: "congress", label: "Congress", icon: "capitol", detail: EMPTY_DETAIL },
  { id: "pentagon", label: "Pentagon", icon: "pentagon", detail: EMPTY_DETAIL },
  { id: "contractors", label: "Weapons makers", icon: "factory", detail: EMPTY_DETAIL },
  { id: "israel", label: "Israeli military", icon: "jet", detail: EMPTY_DETAIL },
  { id: "gaza", label: "Gaza", icon: "homes", detail: EMPTY_DETAIL },
];

export const MIC_FLOWS: MicFlow[] = [
  { id: "taxes", from: "taxpayers", to: "congress", kind: "money", label: "Taxes", detail: EMPTY_DETAIL },
  { id: "budget", from: "congress", to: "pentagon", kind: "money", label: "Budget", detail: EMPTY_DETAIL },
  { id: "contracts", from: "pentagon", to: "contractors", kind: "money", label: "Contracts", detail: EMPTY_DETAIL },
  { id: "arms", from: "contractors", to: "israel", kind: "weapons", label: "Weapons", detail: EMPTY_DETAIL },
  { id: "strikes", from: "israel", to: "gaza", kind: "weapons", label: "Strikes", detail: EMPTY_DETAIL },
  { id: "lobbying", from: "contractors", to: "congress", kind: "influence", label: "Lobbying", detail: EMPTY_DETAIL },
];

export const MIC_GROUPS: MicGroup[] = [
  { id: "government", label: "U.S. Government", nodeIds: ["congress", "pentagon"] },
  { id: "region", label: "Israel & Palestine", nodeIds: ["israel", "gaza"] },
];

/** wide screens: money climbs the left, crosses the top, and comes down the right as weapons */
export const MIC_LAYOUT_WIDE: MicLayout = {
  width: 1000,
  height: 830,
  groupPadX: 120,
  flowBends: { arms: 0.25, lobbying: -0.15 },
  positions: {
    taxpayers: { x: 200, y: 720 },
    congress: { x: 200, y: 420 },
    pentagon: { x: 200, y: 130 },
    contractors: { x: 500, y: 130 },
    israel: { x: 800, y: 420 },
    gaza: { x: 800, y: 720 },
  },
};

/** phones: same shape squeezed into two columns so the labels stay readable */
export const MIC_LAYOUT_TALL: MicLayout = {
  width: 600,
  height: 1000,
  groupPadX: 125,
  flowBends: { arms: -0.15, lobbying: 0.1 },
  positions: {
    taxpayers: { x: 150, y: 860 },
    congress: { x: 150, y: 540 },
    pentagon: { x: 150, y: 190 },
    contractors: { x: 450, y: 190 },
    israel: { x: 450, y: 540 },
    gaza: { x: 450, y: 860 },
  },
};
