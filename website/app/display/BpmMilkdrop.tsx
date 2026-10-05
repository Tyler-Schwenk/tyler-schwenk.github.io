"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { ButterchurnVisualizer } from "butterchurn";
import { beatPhase, countBeat, WAVEFORM_LENGTH, type BeatCounter, type BpmTempo } from "./bpmAgent";
import type { BpmViewProps } from "./BpmPanel";
import { reportPlayingPreset, wrapIndex, type PresetControl } from "./kioskControl";
import { loadPresetLibrary, sortedPresetNames, unwrapExport, type PresetLibrary } from "./milkdropPresets";

/**
 * The milkdrop bpm view: MilkDrop presets (the Winamp visualizer) running in
 * WebGL through butterchurn, fed the room's raw audio by the bpm agent (the
 * stream's waveform), so the page never needs the mic itself.
 *
 * Every preset from all four butterchurn-presets packs (~395) plays in a
 * shuffled order. They blend from one to the next every BEATS_PER_PRESET
 * beats, on a beat, or every NO_BEAT_PRESET_INTERVAL_MS with no beat. ] and [
 * step through the order by hand and hold the preset (presets.step/held, from
 * the key log); backspace lets it move on again. The admin page's remote can
 * also jump straight to one (presets.jump, an index into sortedPresetNames).
 * Each new preset's name and place in the order shows briefly in the corner,
 * or stays up while held, and is reported to the surfcam agent so the remote
 * can show what's playing.
 *
 * A room mic is far quieter than the line-level audio MilkDrop was made for,
 * so the waveform gets an auto gain first (otherwise its wave shapes are flat
 * lines). Butterchurn and the presets (~600 KB gzipped, ~10 MB parsed) are
 * only loaded when this view opens; only the one or two presets on screen are
 * compiled to shaders. It draws at RENDER_WIDTH_PX wide and the browser scales
 * that up, which keeps the GPU load sane on the kiosk.
 * @param props.stream - The bpm agent stream (from BpmPanel), opened with `waveform`.
 * @param props.presets - Preset stepping from the keyboard.
 */

// drawing resolution; the height follows the screen's shape
const RENDER_WIDTH_PX = 1280;
// how long one preset takes to blend into the next, and a quicker one for a key press
const PRESET_BLEND_S = 2.7;
const MANUAL_PRESET_BLEND_S = 1;
// eight bars of four
const BEATS_PER_PRESET = 32;
const NO_BEAT_PRESET_INTERVAL_MS = 30_000;
const PRESET_NAME_SHOW_MS = 6_000;
// waveform bytes are centred on this
const WAVEFORM_CENTRE = 128;
const WAVEFORM_MAX_BYTE = 255;
// auto gain: the loudest recent sample is scaled to this far from centre, letting go of
// a loud moment over GAIN_RELEASE_S, and never boosting more than MAX_GAIN (so the
// room's hiss doesn't get blown up into a show)
const TARGET_PEAK = 100;
const MAX_GAIN = 24;
const GAIN_RELEASE_S = 3;
const MS_PER_S = 1000;

/** The preset showing, for the corner label. `number` is its place in the order, from 1. */
interface PresetInfo {
  name: string;
  number: number;
  total: number;
}

/** The two libraries, loaded on demand. */
interface MilkdropLibs {
  createVisualizer: (canvas: HTMLCanvasElement, width: number, height: number) => ButterchurnVisualizer;
  presets: PresetLibrary;
}

/** The waveform's auto gain state. */
interface WaveformGain {
  /** Loudest recent distance from centre. */
  peak: number;
  /** The gained copy handed to butterchurn. */
  output: Uint8Array;
}

/** Preset-changing state for one running view. */
interface PresetCycle {
  /** Every preset name, in this run's shuffled order. */
  order: string[];
  /** Every preset name sorted, which is what presets.jump indexes. */
  sorted: string[];
  index: number;
  beats: BeatCounter;
  lastChangeBeat: number;
  lastChangeMs: number;
  /** The keyboard's preset step count last acted on. */
  appliedStep: number;
  /** The remote's jump count last acted on. */
  appliedJumps: number;
}

/**
 * Loads butterchurn and every preset pack, merged into one set (a few presets
 * are in more than one pack; the name keeps them single).
 * @returns The libraries.
 */
async function loadMilkdrop(): Promise<MilkdropLibs> {
  const [butterchurnModule, presets] = await Promise.all([import("butterchurn"), loadPresetLibrary()]);
  const butterchurn = unwrapExport<typeof import("butterchurn").default>(butterchurnModule, "createVisualizer");
  return {
    // no AudioContext: every render passes the agent's waveform instead
    createVisualizer: (canvas, width, height) =>
      butterchurn.createVisualizer(null, canvas, { width, height, pixelRatio: 1, textureRatio: 1 }),
    presets,
  };
}

/**
 * The drawing height that matches the window's shape at RENDER_WIDTH_PX wide.
 * @returns Height, px.
 */
function renderHeight(): number {
  return Math.round((RENDER_WIDTH_PX * window.innerHeight) / window.innerWidth);
}

/**
 * The preset names in a random order (Fisher-Yates).
 * @param names - Preset names.
 * @returns A shuffled copy.
 */
function shuffled(names: string[]): string[] {
  const copy = [...names];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Where a jumped-to preset sits in this run's order.
 * @param cycle - Preset-changing state.
 * @param jump - Index into the sorted names.
 * @returns Its index in cycle.order, or null if there's no such preset.
 */
function jumpIndex(cycle: PresetCycle, jump: number | null): number | null {
  if (jump === null) return null;
  const index = cycle.order.indexOf(cycle.sorted[jump]);
  return index < 0 ? null : index;
}

/**
 * Whether it's time for the next preset: on a new beat once enough beats
 * have passed, or after a while with no beat at all.
 * @param cycle - Preset-changing state.
 * @param isNewBeat - A beat started this frame.
 * @param hasBeat - There's a beat at all.
 * @param nowMs - Now, epoch ms.
 * @returns True to change now.
 */
function presetIsDue(cycle: PresetCycle, isNewBeat: boolean, hasBeat: boolean, nowMs: number): boolean {
  if (!hasBeat) return nowMs - cycle.lastChangeMs >= NO_BEAT_PRESET_INTERVAL_MS;
  return isNewBeat && cycle.beats.count - cycle.lastChangeBeat >= BEATS_PER_PRESET;
}

/**
 * Scales the waveform up so quiet room audio still fills MilkDrop's shapes.
 * @param input - Latest waveform, or null before the first arrives (silence).
 * @param gain - Gain state, updated in place (its output is the result).
 * @param dtS - Seconds since the last frame.
 * @returns The gained waveform (gain.output).
 */
function applyGain(input: Uint8Array | null, gain: WaveformGain, dtS: number): Uint8Array {
  if (!input || input.length !== WAVEFORM_LENGTH) return gain.output.fill(WAVEFORM_CENTRE);
  let loudest = 0;
  for (const byte of input) loudest = Math.max(loudest, Math.abs(byte - WAVEFORM_CENTRE));
  gain.peak = Math.max(loudest, gain.peak * Math.exp(-dtS / GAIN_RELEASE_S));
  const factor = Math.min(MAX_GAIN, TARGET_PEAK / Math.max(gain.peak, 1));
  input.forEach((byte, i) => {
    const scaled = WAVEFORM_CENTRE + (byte - WAVEFORM_CENTRE) * factor;
    gain.output[i] = Math.max(0, Math.min(WAVEFORM_MAX_BYTE, Math.round(scaled)));
  });
  return gain.output;
}

/**
 * Starts the visualizer on a canvas and runs it until stopped.
 * @param libs - Loaded libraries.
 * @param canvas - The canvas to draw on.
 * @param waveformRef - The stream's latest waveform.
 * @param tempoRef - The stream's latest tempo.
 * @param presetsRef - The keyboard's latest preset stepping.
 * @param onPreset - Called with each new preset.
 * @returns A function that stops it.
 */
function runMilkdrop(
  libs: MilkdropLibs,
  canvas: HTMLCanvasElement,
  waveformRef: RefObject<Uint8Array | null>,
  tempoRef: RefObject<BpmTempo | null>,
  presetsRef: RefObject<PresetControl>,
  onPreset: (preset: PresetInfo) => void
): () => void {
  canvas.width = RENDER_WIDTH_PX;
  canvas.height = renderHeight();
  const visualizer = libs.createVisualizer(canvas, canvas.width, canvas.height);
  const sorted = sortedPresetNames(libs.presets);
  const cycle: PresetCycle = {
    order: shuffled(sorted),
    sorted,
    index: 0,
    beats: { count: 0, lastPhase: null },
    lastChangeBeat: 0,
    lastChangeMs: 0,
    // presses from before this view opened aren't replayed onto it (a jump is: it opens on it)
    appliedStep: presetsRef.current.step,
    appliedJumps: presetsRef.current.jumps,
  };
  const gain: WaveformGain = { peak: 0, output: new Uint8Array(WAVEFORM_LENGTH) };

  const showPreset = (index: number, nowMs: number, blendS: number) => {
    cycle.index = wrapIndex(index, cycle.order.length);
    const name = cycle.order[cycle.index];
    visualizer.loadPreset(libs.presets[name], blendS);
    cycle.lastChangeBeat = cycle.beats.count;
    cycle.lastChangeMs = nowMs;
    onPreset({ name, number: cycle.index + 1, total: cycle.order.length });
  };
  showPreset(jumpIndex(cycle, presetsRef.current.jump) ?? 0, Date.now(), 0);

  /** Moves to another preset if a key asked for one, or it's time and the preset isn't held. */
  const changePresetIfDue = (isNewBeat: boolean, hasBeat: boolean, nowMs: number) => {
    const { step, held, jump, jumps } = presetsRef.current;
    if (jumps !== cycle.appliedJumps) {
      const target = jumpIndex(cycle, jump);
      if (target !== null) showPreset(target, nowMs, MANUAL_PRESET_BLEND_S);
      cycle.appliedJumps = jumps;
      cycle.appliedStep = step;
    } else if (step !== cycle.appliedStep) {
      showPreset(cycle.index + step - cycle.appliedStep, nowMs, MANUAL_PRESET_BLEND_S);
      cycle.appliedStep = step;
    } else if (!held && presetIsDue(cycle, isNewBeat, hasBeat, nowMs)) {
      showPreset(cycle.index + 1, nowMs, PRESET_BLEND_S);
    }
  };

  const resize = () => {
    canvas.width = RENDER_WIDTH_PX;
    canvas.height = renderHeight();
    visualizer.setRendererSize(canvas.width, canvas.height);
  };
  window.addEventListener("resize", resize);

  let animationFrameId = 0;
  let lastFrameMs = performance.now();
  const tick = (frameMs: number) => {
    animationFrameId = requestAnimationFrame(tick);
    const dtS = (frameMs - lastFrameMs) / MS_PER_S;
    lastFrameMs = frameMs;
    const nowMs = Date.now();
    const phase = beatPhase(tempoRef.current, nowMs);
    changePresetIfDue(countBeat(cycle.beats, phase), phase !== null, nowMs);
    const wave = applyGain(waveformRef.current, gain, dtS);
    visualizer.render({ audioLevels: { timeByteArray: wave, timeByteArrayL: wave, timeByteArrayR: wave } });
  };
  animationFrameId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener("resize", resize);
  };
}

export default function BpmMilkdrop({ stream, presets }: BpmViewProps) {
  const { waveformRef, tempoRef } = stream;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const presetsRef = useRef(presets);
  const [preset, setPreset] = useState<PresetInfo | null>(null);
  const [showPresetName, setShowPresetName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // the render loop reads the latest key presses through this
  useEffect(() => {
    presetsRef.current = presets;
  }, [presets]);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    loadMilkdrop()
      .then((libs) => {
        if (cancelled || !canvasRef.current) return;
        stop = runMilkdrop(libs, canvasRef.current, waveformRef, tempoRef, presetsRef, (info) => {
          setPreset(info);
          setShowPresetName(true);
          reportPlayingPreset(info.name);
        });
      })
      .catch((err: unknown) => {
        console.error("display: milkdrop failed to start", err);
        setError(`milkdrop couldn't start (${err instanceof Error ? err.message : err}) -- the browser may lack WebGL 2`);
      });
    return () => {
      cancelled = true;
      stop?.();
      reportPlayingPreset(null);
    };
  }, [waveformRef, tempoRef]);

  // the preset name fades out a few seconds after each change
  useEffect(() => {
    if (!preset) return;
    const timer = setTimeout(() => setShowPresetName(false), PRESET_NAME_SHOW_MS);
    return () => clearTimeout(timer);
  }, [preset]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-mono">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {error && <div className="absolute inset-0 flex items-center justify-center text-4xl text-gray-400 px-16 text-center">{error}</div>}
      {preset && (
        <div
          className={`absolute bottom-6 left-8 max-w-[60%] text-2xl text-white/70 drop-shadow transition-opacity duration-1000 ${
            showPresetName || presets.held ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="tabular-nums text-white/50">
            {preset.number}/{preset.total}
            {presets.held && " held"}
          </span>{" "}
          {preset.name}
        </div>
      )}
    </div>
  );
}
