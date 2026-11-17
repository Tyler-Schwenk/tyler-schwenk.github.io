import type { KeyboardEvent } from "react";
import { MIC_FLOWS, MIC_GROUPS, MIC_NODES, type MicFlow, type MicFlowKind, type MicLayout } from "@/app/mic/micData";
import { flowGeometry, groupBox, MIC_NODE_RADIUS, type FlowGeometry } from "@/app/mic/micGeometry";
import MicIcon from "./MicIcon";
import styles from "./mic.module.css";

/** what's been clicked: a node or a flow, by id */
export interface MicSelection {
  type: "node" | "flow";
  id: string;
}

const ICON_SIZE = 56;
const NODE_LABEL_OFFSET = 30;
const GROUP_LABEL_INSET = 34;
const GROUP_CORNER_RADIUS = 24;

/** particles riding each flow, and how fast they go */
const PARTICLES_PER_FLOW = 4;
const PARTICLE_SPEED_PER_S = 80;

/**
 * makes an svg element act like a button: clickable, focusable, and enter/space
 * to activate.
 * @param {string} label - what screen readers call it.
 * @param {() => void} onActivate - runs on click or key press.
 * @returns {object} props to spread onto the element.
 */
function buttonProps(label: string, onActivate: () => void) {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onActivate();
    },
  };
}

/**
 * the shape that rides along a flow: coins for money, little bombs for weapons,
 * dots for influence. drawn pointing along +x so rotate="auto" lines it up.
 * @param {MicFlowKind} kind - the flow's kind.
 * @returns {JSX.Element} the particle shape.
 */
function ParticleShape({ kind }: { kind: MicFlowKind }) {
  if (kind === "weapons") {
    return (
      <g className={styles.bomb}>
        <ellipse cx="0" cy="0" rx="8" ry="3.5" />
        <path d="M-7 0l-5-5M-7 0l-5 5" />
      </g>
    );
  }
  return <circle r={kind === "money" ? 5.5 : 4} className={kind === "money" ? styles.coin : styles.dot} />;
}

/**
 * the moving particles on one flow, spread out evenly so it looks like a steady stream.
 * @param {object} props - component props.
 * @param {MicFlowKind} props.kind - the flow's kind.
 * @param {FlowGeometry} props.geometry - the flow's path.
 * @returns {JSX.Element} the particles.
 */
function FlowParticles({ kind, geometry }: { kind: MicFlowKind; geometry: FlowGeometry }) {
  const duration_s = geometry.length / PARTICLE_SPEED_PER_S;
  const particles = Array.from({ length: PARTICLES_PER_FLOW }, (_, index) => index);
  return (
    <g className={styles.particles} aria-hidden="true">
      {particles.map((index) => (
        <g key={index}>
          <ParticleShape kind={kind} />
          {/* negative begin starts each one partway along, so they don't bunch up on load */}
          <animateMotion
            dur={`${duration_s}s`}
            begin={`${(-index * duration_s) / PARTICLES_PER_FLOW}s`}
            repeatCount="indefinite"
            rotate="auto"
            path={geometry.path}
          />
        </g>
      ))}
    </g>
  );
}

/**
 * one flow: the line, its arrowhead, its particles, its label, and a fat
 * invisible line on top so it's easy to tap.
 * @param {object} props - component props.
 * @param {MicFlow} props.flow - the flow.
 * @param {MicLayout} props.layout - where the nodes sit.
 * @param {boolean} props.active - whether it's the selected thing.
 * @param {() => void} props.onSelect - runs when it's clicked.
 * @returns {JSX.Element} the flow.
 */
function FlowLine({ flow, layout, active, onSelect }: { flow: MicFlow; layout: MicLayout; active: boolean; onSelect: () => void }) {
  const geometry = flowGeometry(layout.positions[flow.from], layout.positions[flow.to], layout.flowBends[flow.id] ?? 0);
  const className = `${styles.flow} ${styles[flow.kind]} ${active ? styles.active : ""}`;
  return (
    <g className={className} {...buttonProps(`${flow.label}: more info`, onSelect)}>
      <path d={geometry.path} className={styles.flowLine} />
      <polygon points={geometry.arrow} className={styles.flowArrow} />
      <FlowParticles kind={flow.kind} geometry={geometry} />
      <text x={geometry.labelAt.x} y={geometry.labelAt.y} className={styles.flowLabel}>
        {flow.label}
      </text>
      <path d={geometry.path} className={styles.hitArea} />
    </g>
  );
}

/**
 * the money-and-weapons diagram for one layout. the page renders one per screen
 * shape and css shows the right one.
 * @param {object} props - component props.
 * @param {MicLayout} props.layout - node positions and canvas size.
 * @param {MicSelection | null} props.selected - what's selected, if anything.
 * @param {(selection: MicSelection) => void} props.onSelect - runs when a node or flow is clicked.
 * @param {string} props.className - extra class, used to show/hide per screen size.
 * @returns {JSX.Element} the svg.
 */
export default function MicFlowDiagram({
  layout,
  selected,
  onSelect,
  className,
}: {
  layout: MicLayout;
  selected: MicSelection | null;
  onSelect: (selection: MicSelection) => void;
  className: string;
}) {
  const isActive = (type: MicSelection["type"], id: string) => selected?.type === type && selected.id === id;
  const svgClass = `${styles.diagram} ${selected ? styles.hasSelection : ""} ${className}`;

  return (
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className={svgClass} role="group" aria-label="How money and weapons flow">
      {MIC_GROUPS.map((group) => {
        const box = groupBox(layout, group.nodeIds);
        return (
          <g key={group.id} className={styles.group}>
            <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={GROUP_CORNER_RADIUS} />
            <text x={box.x + box.width / 2} y={box.y + GROUP_LABEL_INSET}>{group.label}</text>
          </g>
        );
      })}

      {MIC_FLOWS.map((flow) => (
        <FlowLine
          key={flow.id}
          flow={flow}
          layout={layout}
          active={isActive("flow", flow.id)}
          onSelect={() => onSelect({ type: "flow", id: flow.id })}
        />
      ))}

      {MIC_NODES.map((node) => {
        const { x, y } = layout.positions[node.id];
        const className = `${styles.node} ${isActive("node", node.id) ? styles.active : ""}`;
        return (
          <g key={node.id} className={className} {...buttonProps(`${node.label}: more info`, () => onSelect({ type: "node", id: node.id }))}>
            <circle cx={x} cy={y} r={MIC_NODE_RADIUS} className={styles.nodeCircle} />
            <MicIcon name={node.icon} x={x} y={y} size={ICON_SIZE} />
            <text x={x} y={y + MIC_NODE_RADIUS + NODE_LABEL_OFFSET} className={styles.nodeLabel}>
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
