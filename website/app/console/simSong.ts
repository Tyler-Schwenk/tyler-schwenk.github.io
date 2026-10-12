/**
 * The song the console page's simulated bpm mode plays: a little house loop
 * synthesised in the browser, so there's no audio file to ship and its beat
 * is known exactly. Rendered once with an OfflineAudioContext into a buffer
 * that loops seamlessly (note tails that run past the end wrap round to the
 * start).
 */

/** A song the simulation can play and know the beat of. */
export interface SimSong {
  bpm: number;
  /** Where the first beat falls in the buffer, s. The loop must be a whole number of beats. */
  firstBeatS: number;
  /**
   * Makes the audio.
   * @param sampleRate - The playing AudioContext's rate.
   * @returns The looping buffer.
   */
  render: (sampleRate: number) => Promise<AudioBuffer>;
}

const BPM = 122;
const BARS = 16;
const STEPS_PER_BAR = 16;
const STEPS_PER_BEAT = 4;
const SECONDS_PER_MINUTE = 60;
const STEP_S = SECONDS_PER_MINUTE / BPM / STEPS_PER_BEAT;
const LOOP_S = BARS * STEPS_PER_BAR * STEP_S;
// room past the loop's end for the last notes to ring out before they're wrapped to the start
const TAIL_S = 1;
const NOISE_S = 1;
// fixed seed, so the noise (and the song) is the same every time
const NOISE_SEED = 0x5eed;

// when each part comes in, by bar (0-based)
const STABS_FROM_BAR = 4;
const ARP_FROM_BAR = 8;
const GHOST_HATS_FROM_BAR = 4;

// which 16th steps of a bar each part plays on
const KICK_STEPS = [0, 4, 8, 12];
const CLAP_STEPS = [4, 12];
const HAT_STEPS = [2, 6, 10, 14];
const GHOST_HAT_STEPS = [1, 3, 5, 7, 9, 11, 13, 15];
const OPEN_HAT_STEP = 14;
const BASS_STEPS: { step: number; octave: number }[] = [
  { step: 2, octave: 1 },
  { step: 3, octave: 2 },
  { step: 6, octave: 1 },
  { step: 10, octave: 1 },
  { step: 11, octave: 2 },
  { step: 14, octave: 1 },
];
const STAB_STEPS = [2, 7, 10];
// chord tone order for the 16th-note arp
const ARP_PATTERN = [0, 1, 2, 1];

/** One bar's chord: its bass root (Hz) and the stab voicing (Hz). */
interface Chord {
  rootHz: number;
  notesHz: number[];
}

// am - f - c - g, a bar each
const PROGRESSION: Chord[] = [
  { rootHz: 55, notesHz: [220, 261.63, 329.63] },
  { rootHz: 43.65, notesHz: [174.61, 220, 261.63] },
  { rootHz: 65.41, notesHz: [261.63, 329.63, 392] },
  { rootHz: 49, notesHz: [196, 246.94, 293.66] },
];

// mix levels (linear gain) and the shape of each voice
const KICK = { gain: 0.9, startHz: 150, endHz: 42, sweepS: 0.12, decayS: 0.45 };
const CLAP = { gain: 0.5, bandHz: 1500, q: 0.8, burstGapS: 0.012, bursts: 3, decayS: 0.18 };
const HAT = { gain: 0.18, ghostGain: 0.07, highpassHz: 8000, decayS: 0.04, openDecayS: 0.25 };
const BASS = { gain: 0.32, cutoffStartHz: 900, cutoffEndHz: 260, q: 4, lengthSteps: 1.5 };
const STAB = { gain: 0.05, cutoffHz: 2000, detuneCents: 8, decayS: 0.22 };
const ARP = { gain: 0.035, cutoffHz: 3000, decayS: 0.12, octaveUp: 2 };
const MASTER_GAIN = 0.8;
// an exponential ramp can't reach 0, so envelopes fall to this instead
const SILENT_GAIN = 0.0001;

/**
 * Seeded pseudo-random numbers (mulberry32), so the noise is reproducible.
 * @param seed - Seed.
 * @returns A function giving the next number in [0, 1).
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/**
 * A buffer of white noise for the clap and hats.
 * @param ctx - The rendering context.
 * @returns One second of noise.
 */
function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.round(NOISE_S * ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const random = seededRandom(NOISE_SEED);
  for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
  return buffer;
}

/**
 * A gain node that jumps to `peak` at `atS` and dies away exponentially.
 * @param ctx - The rendering context.
 * @param atS - Start, s.
 * @param peak - Starting gain.
 * @param decayS - Time to silence, s.
 * @returns The envelope, not yet connected onward.
 */
function decayEnvelope(ctx: BaseAudioContext, atS: number, peak: number, decayS: number): GainNode {
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(peak, atS);
  envelope.gain.exponentialRampToValueAtTime(SILENT_GAIN, atS + decayS);
  return envelope;
}

/**
 * Plays a burst of filtered noise.
 * @param ctx - The rendering context.
 * @param noise - Noise buffer.
 * @param filter - Filter to colour it.
 * @param envelope - Its envelope (connected onward already).
 * @param atS - Start, s.
 * @param lengthS - How long to run the noise, s.
 */
function playNoise(ctx: BaseAudioContext, noise: AudioBuffer, filter: BiquadFilterNode, envelope: GainNode, atS: number, lengthS: number) {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.connect(filter).connect(envelope);
  source.start(atS);
  source.stop(atS + lengthS);
}

/** Schedules one kick. */
function kick(ctx: BaseAudioContext, out: AudioNode, atS: number) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(KICK.startHz, atS);
  osc.frequency.exponentialRampToValueAtTime(KICK.endHz, atS + KICK.sweepS);
  osc.connect(decayEnvelope(ctx, atS, KICK.gain, KICK.decayS)).connect(out);
  osc.start(atS);
  osc.stop(atS + KICK.decayS);
}

/** Schedules one clap: a few quick noise bursts, like hands not quite together. */
function clap(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, atS: number) {
  for (let burst = 0; burst < CLAP.bursts; burst++) {
    const startS = atS + burst * CLAP.burstGapS;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = CLAP.bandHz;
    filter.Q.value = CLAP.q;
    const envelope = decayEnvelope(ctx, startS, CLAP.gain, CLAP.decayS);
    envelope.connect(out);
    playNoise(ctx, noise, filter, envelope, startS, CLAP.decayS);
  }
}

/** Schedules one hi-hat. */
function hat(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, atS: number, gain: number, decayS: number) {
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = HAT.highpassHz;
  const envelope = decayEnvelope(ctx, atS, gain, decayS);
  envelope.connect(out);
  playNoise(ctx, noise, filter, envelope, atS, decayS);
}

/** Schedules one bass note: a saw through a closing resonant filter. */
function bass(ctx: BaseAudioContext, out: AudioNode, atS: number, hz: number) {
  const lengthS = BASS.lengthSteps * STEP_S;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = hz;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = BASS.q;
  filter.frequency.setValueAtTime(BASS.cutoffStartHz, atS);
  filter.frequency.exponentialRampToValueAtTime(BASS.cutoffEndHz, atS + lengthS);
  osc.connect(filter).connect(decayEnvelope(ctx, atS, BASS.gain, lengthS)).connect(out);
  osc.start(atS);
  osc.stop(atS + lengthS);
}

/** Schedules one chord stab: two slightly detuned saws per note. */
function stab(ctx: BaseAudioContext, out: AudioNode, atS: number, notesHz: number[]) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = STAB.cutoffHz;
  filter.connect(decayEnvelope(ctx, atS, STAB.gain, STAB.decayS)).connect(out);
  for (const hz of notesHz) {
    for (const detune of [-STAB.detuneCents, STAB.detuneCents]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = hz;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(atS);
      osc.stop(atS + STAB.decayS);
    }
  }
}

/** Schedules one arp note. */
function arp(ctx: BaseAudioContext, out: AudioNode, atS: number, hz: number) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = hz;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = ARP.cutoffHz;
  osc.connect(filter).connect(decayEnvelope(ctx, atS, ARP.gain, ARP.decayS)).connect(out);
  osc.start(atS);
  osc.stop(atS + ARP.decayS);
}

/**
 * Schedules every note of one bar.
 * @param ctx - The rendering context.
 * @param out - Where the parts go.
 * @param noise - Noise buffer for the clap and hats.
 * @param bar - Which bar (0-based).
 */
function scheduleBar(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, bar: number) {
  const barS = bar * STEPS_PER_BAR * STEP_S;
  const at = (step: number) => barS + step * STEP_S;
  const chord = PROGRESSION[bar % PROGRESSION.length];
  KICK_STEPS.forEach((step) => kick(ctx, out, at(step)));
  CLAP_STEPS.forEach((step) => clap(ctx, out, noise, at(step)));
  HAT_STEPS.forEach((step) => {
    const open = step === OPEN_HAT_STEP && bar % 2 === 1;
    hat(ctx, out, noise, at(step), HAT.gain, open ? HAT.openDecayS : HAT.decayS);
  });
  if (bar >= GHOST_HATS_FROM_BAR) GHOST_HAT_STEPS.forEach((step) => hat(ctx, out, noise, at(step), HAT.ghostGain, HAT.decayS));
  BASS_STEPS.forEach(({ step, octave }) => bass(ctx, out, at(step), chord.rootHz * octave));
  if (bar >= STABS_FROM_BAR) STAB_STEPS.forEach((step) => stab(ctx, out, at(step), chord.notesHz));
  if (bar < ARP_FROM_BAR) return;
  for (let step = 0; step < STEPS_PER_BAR; step++) {
    const tone = chord.notesHz[ARP_PATTERN[step % ARP_PATTERN.length]];
    arp(ctx, out, at(step), tone * ARP.octaveUp);
  }
}

/**
 * Renders the loop: every bar, then the tails past the end folded back onto the start.
 * @param sampleRate - The playing AudioContext's rate.
 * @returns The looping buffer.
 */
async function renderHouseLoop(sampleRate: number): Promise<AudioBuffer> {
  const loopLength = Math.round(LOOP_S * sampleRate);
  const ctx = new OfflineAudioContext(1, loopLength + Math.round(TAIL_S * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  const glue = ctx.createDynamicsCompressor();
  master.connect(glue).connect(ctx.destination);
  const noise = makeNoise(ctx);
  for (let bar = 0; bar < BARS; bar++) scheduleBar(ctx, master, noise, bar);

  const rendered = await ctx.startRendering();
  const loop = new AudioBuffer({ length: loopLength, sampleRate, numberOfChannels: 1 });
  const source = rendered.getChannelData(0);
  const target = loop.getChannelData(0);
  target.set(source.subarray(0, loopLength));
  for (let i = loopLength; i < source.length; i++) target[i - loopLength] += source[i];
  return loop;
}

/** The synthesised house loop: 122 bpm, a minor, 16 bars. */
export const HOUSE_LOOP: SimSong = {
  bpm: BPM,
  firstBeatS: 0,
  render: renderHouseLoop,
};
