import { WAVEFORM_LENGTH, type BpmConfig, type BpmConnector, type BpmHandlers, type BpmTempo } from "../display/bpmAgent";
import type { SimSong } from "./simSong";

/**
 * Stands in for the bpm agent on the console page: plays a song through web
 * audio and streams the same config, frames, waveform and tempo the agent
 * does, worked out the agent's way (pi/services/bpm-agent/beat_tracker.py) so
 * the bpm views look like they do on the kiosk. The tempo isn't tracked, it's
 * the song's own, so the beat is always spot on.
 *
 * Like the agent it starts when the first stream connects and stops a few
 * seconds after the last one closes, so flipping between bpm views (which
 * reopens the stream) doesn't restart the song.
 */

// the agent's analysis settings (beat_tracker.py and bpm_agent.py)
const AGENT_SAMPLE_RATE_HZ = 44100;
const AGENT_HOP_SAMPLES = 512;
const FRAME_RATE_HZ = AGENT_SAMPLE_RATE_HZ / AGENT_HOP_SAMPLES;
const FFT_SIZE = 2048;
const BAND_COUNT = 64;
const BAND_MIN_HZ = 40;
const BAND_MAX_HZ = 12000;
const BAND_FLOOR_DB = -90;
const BAND_CEIL_DB = -10;
const BAND_LEVELS = 255;
const ONSET_MIN_HZ = 40;
const ONSET_MAX_HZ = 200;
const ONSET_LOG_GAIN = 1000;
const SILENCE_DB = -55;
const SILENCE_WINDOW_S = 1.5;
const TEMPO_MIN_WINDOW_S = 4;
const CURVE_MIN_BPM = 60;
const CURVE_MAX_BPM = 200;
const CURVE_STEP_BPM = 1;
const PRIOR_CENTER_BPM = 120;
const PRIOR_STD_OCTAVES = 1;
const TEMPO_UPDATE_INTERVAL_MS = 250;
const IDLE_GRACE_MS = 5_000;
const OFFSET_STEP_MS = 10;

// web audio's analyser scales the fft by 1/N with a blackman window (coherent gain 0.42);
// the agent divides a hann-windowed fft by half the window's sum. for the same signal the
// analyser reads this many dB lower: 20 * log10(1 / (0.42 / 2))
const ANALYSER_TO_AGENT_DB = 13.56;
// the agent hears the room through a mic, well below line level, so the analysis gets
// turned down to land the levels where the kiosk's do
const ROOM_MIC_GAIN_DB = -18;
// how loud the song plays out of the visitor's speakers
const PLAYBACK_GAIN = 0.6;
// a little lead so the song's first beat isn't clipped as playback starts
const START_DELAY_S = 0.05;
// after a stall (tab hidden), skip ahead instead of emitting a burst of stale frames
const MAX_CATCH_UP_FRAMES = 8;

// the tempo curve: a clear peak at the song's tempo, smaller ones at its relatives
// (half, double, 3:2, 2:3), on a low floor, like the agent's autocorrelation gives
const CURVE_PEAK_WIDTH_BPM = 1.2;
const CURVE_RELATIVES = [
  { ratio: 0.5, weight: 0.5 },
  { ratio: 2, weight: 0.5 },
  { ratio: 1.5, weight: 0.3 },
  { ratio: 2 / 3, weight: 0.3 },
];
const CURVE_FLOOR = 0.06;
const CURVE_JITTER = 0.03;
const SIM_CONFIDENCE = 0.85;

const MS_PER_S = 1000;
const SECONDS_PER_MINUTE = 60;
const BYTE_CENTRE = 128;
const BYTE_MAX = 255;

const BAND_EDGES_HZ = Array.from(
  { length: BAND_COUNT + 1 },
  (_, i) => BAND_MIN_HZ * (BAND_MAX_HZ / BAND_MIN_HZ) ** (i / BAND_COUNT)
);
const CURVE_BPMS = Array.from({ length: (CURVE_MAX_BPM - CURVE_MIN_BPM) / CURVE_STEP_BPM + 1 }, (_, i) => CURVE_MIN_BPM + i * CURVE_STEP_BPM);

const CONFIG: BpmConfig = {
  band_edges_hz: BAND_EDGES_HZ,
  band_floor_db: BAND_FLOOR_DB,
  band_ceil_db: BAND_CEIL_DB,
  onset_min_hz: ONSET_MIN_HZ,
  onset_max_hz: ONSET_MAX_HZ,
  frame_rate_hz: FRAME_RATE_HZ,
  silence_db: SILENCE_DB,
  curve_min_bpm: CURVE_MIN_BPM,
  curve_step_bpm: CURVE_STEP_BPM,
};

/** One open stream. */
interface Subscriber {
  handlers: BpmHandlers;
  waveform: boolean;
}

/** The audio graph and analysis state while the song plays. */
interface Playback {
  source: AudioBufferSourceNode;
  analyser: AnalyserNode;
  /** Song time 0, in the AudioContext's clock. */
  startCtxS: number;
  startedAtMs: number;
  framesEmitted: number;
  frameTimer: ReturnType<typeof setInterval>;
  tempoTimer: ReturnType<typeof setInterval>;
  freqDb: Float32Array<ArrayBuffer>;
  samples: Float32Array<ArrayBuffer>;
  previousOnsetLog: Float64Array;
  /** [epoch ms, power] of recent hops, for the tempo's level. */
  powers: [number, number][];
  waveformBytes: Uint8Array;
}

/**
 * Which fft bins each display band averages, the agent's way: a band too
 * narrow to hold a bin takes the bin nearest its centre.
 * @param binHz - Width of one fft bin.
 * @returns Bin indexes per band.
 */
function buildBandBins(binHz: number): number[][] {
  const binCount = FFT_SIZE / 2;
  return BAND_EDGES_HZ.slice(0, -1).map((lowHz, band) => {
    const highHz = BAND_EDGES_HZ[band + 1];
    const bins: number[] = [];
    for (let bin = Math.ceil(lowHz / binHz); bin * binHz < highHz && bin < binCount; bin++) bins.push(bin);
    return bins.length > 0 ? bins : [Math.round(Math.sqrt(lowHz * highHz) / binHz)];
  });
}

/**
 * The agent's tempo prior: a bell over log tempo, centred on 120 bpm.
 * @param bpm - Tempo.
 * @returns 0-1.
 */
function tempoPrior(bpm: number): number {
  return Math.exp(-0.5 * (Math.log2(bpm / PRIOR_CENTER_BPM) / PRIOR_STD_OCTAVES) ** 2);
}

/**
 * A tempo curve like the agent's for a song at a known tempo, scaled to max 1.
 * @param songBpm - The song's tempo.
 * @returns One score per CURVE_BPMS entry.
 */
function simulatedCurve(songBpm: number): number[] {
  const peak = (bpm: number, centre: number) => Math.exp(-0.5 * ((bpm - centre) / CURVE_PEAK_WIDTH_BPM) ** 2);
  const raw = CURVE_BPMS.map((bpm) => {
    const relatives = CURVE_RELATIVES.reduce((sum, { ratio, weight }) => sum + weight * peak(bpm, songBpm * ratio), 0);
    return tempoPrior(bpm) * (peak(bpm, songBpm) + relatives + CURVE_FLOOR + Math.random() * CURVE_JITTER);
  });
  const max = Math.max(...raw);
  return raw.map((score) => score / max);
}

/**
 * Power (amplitude squared) to dBFS, like the agent's to_db.
 * @param power - Power, full scale 1.
 * @returns dB.
 */
function toDb(power: number): number {
  return 10 * Math.log10(power + 1e-12);
}

/** Plays a SimSong and serves bpm streams from it. One per console page. */
export class SimBpmEngine {
  private readonly song: SimSong;
  private readonly subscribers = new Set<Subscriber>();
  private readonly mutedListeners = new Set<() => void>();
  private ctx: AudioContext | null = null;
  private output: GainNode | null = null;
  private buffer: Promise<AudioBuffer> | null = null;
  private playback: Playback | null = null;
  // bumps on every start and stop, so a start still loading when it's stopped gives up
  private generation = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private muted = false;
  private offsetMs = 0;

  /**
   * @param song - What to play.
   */
  constructor(song: SimSong) {
    this.song = song;
  }

  /** Opens a stream (the DisplayEnvironment's connectBpm). Starts the song if it isn't playing. */
  connect: BpmConnector = ({ waveform }, handlers) => {
    const subscriber: Subscriber = { handlers, waveform };
    this.subscribers.add(subscriber);
    handlers.onConfig(CONFIG);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (!this.playback) this.start();
    return () => {
      this.subscribers.delete(subscriber);
      if (this.subscribers.size === 0) this.idleTimer = setTimeout(() => this.stop(), IDLE_GRACE_MS);
    };
  };

  /**
   * Whether the song is silenced (it still plays and drives the views).
   * @returns True when muted.
   */
  isMuted = (): boolean => this.muted;

  /**
   * Silences or unsilences the song.
   * @param muted - True to silence.
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.output) this.output.gain.value = muted ? 0 : PLAYBACK_GAIN;
    this.mutedListeners.forEach((listener) => listener());
  }

  /**
   * Calls `listener` whenever muting changes (for useSyncExternalStore).
   * @param listener - Change callback.
   * @returns Unsubscribes.
   */
  subscribeMuted = (listener: () => void): (() => void) => {
    this.mutedListeners.add(listener);
    return () => this.mutedListeners.delete(listener);
  };

  /**
   * Moves the beat earlier or later on screen, like the kiosk's - and = keys.
   * @param direction - -1 for earlier, +1 for later.
   */
  nudgeOffset(direction: -1 | 1): void {
    this.offsetMs += direction * OFFSET_STEP_MS;
  }

  /** Stops everything and lets go of the audio device (page unmount). */
  dispose(): void {
    this.stop();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.ctx?.close();
    this.ctx = null;
  }

  /** Starts the song and the frame and tempo timers. */
  private async start(): Promise<void> {
    const generation = ++this.generation;
    try {
      const ctx = this.ensureContext();
      await ctx.resume();
      this.buffer ??= this.song.render(ctx.sampleRate);
      const buffer = await this.buffer;
      if (generation !== this.generation || !this.output) return;
      this.playback = this.play(ctx, this.output, buffer);
    } catch (err) {
      console.error("console: the simulated bpm song couldn't start", err);
      const message = `the simulated song couldn't play (${err instanceof Error ? err.message : err}) -- this browser may not support web audio`;
      this.subscribers.forEach(({ handlers }) => handlers.onError(message));
    }
  }

  /**
   * The AudioContext, made on first use (after a click, so the browser lets it play).
   * @returns The context.
   */
  private ensureContext(): AudioContext {
    if (this.ctx && this.output) return this.ctx;
    const ctx = new AudioContext();
    const output = ctx.createGain();
    output.gain.value = this.muted ? 0 : PLAYBACK_GAIN;
    output.connect(ctx.destination);
    this.ctx = ctx;
    this.output = output;
    return ctx;
  }

  /**
   * Starts the song looping and the timers that analyse it.
   * @param ctx - The context.
   * @param output - Speaker gain.
   * @param buffer - The song.
   * @returns The running playback.
   */
  private play(ctx: AudioContext, output: GainNode, buffer: AudioBuffer): Playback {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const mic = ctx.createGain();
    mic.gain.value = 10 ** (ROOM_MIC_GAIN_DB / 20);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    source.connect(output);
    source.connect(mic).connect(analyser);
    const startCtxS = ctx.currentTime + START_DELAY_S;
    source.start(startCtxS);
    const bandBins = buildBandBins(ctx.sampleRate / FFT_SIZE);
    const onsetBins = Array.from({ length: FFT_SIZE / 2 }, (_, bin) => bin).filter((bin) => {
      const hz = (bin * ctx.sampleRate) / FFT_SIZE;
      return hz >= ONSET_MIN_HZ && hz <= ONSET_MAX_HZ;
    });
    const playback: Playback = {
      source,
      analyser,
      startCtxS,
      startedAtMs: Date.now(),
      framesEmitted: 0,
      frameTimer: setInterval(() => this.emitDueFrames(playback, bandBins, onsetBins), MS_PER_S / FRAME_RATE_HZ),
      tempoTimer: setInterval(() => this.emitTempo(playback), TEMPO_UPDATE_INTERVAL_MS),
      freqDb: new Float32Array(FFT_SIZE / 2),
      samples: new Float32Array(FFT_SIZE),
      previousOnsetLog: new Float64Array(onsetBins.length),
      powers: [],
      waveformBytes: new Uint8Array(WAVEFORM_LENGTH),
    };
    return playback;
  }

  /** Stops the song and its timers. */
  private stop(): void {
    this.generation++;
    const playback = this.playback;
    this.playback = null;
    if (!playback) return;
    clearInterval(playback.frameTimer);
    clearInterval(playback.tempoTimer);
    playback.source.stop();
    playback.source.disconnect();
    this.ctx?.suspend();
  }

  /**
   * Emits the frames due since the last tick, one analysis shared between them.
   * @param playback - The running playback.
   * @param bandBins - Fft bins per display band.
   * @param onsetBins - Fft bins the onset listens to.
   */
  private emitDueFrames(playback: Playback, bandBins: number[][], onsetBins: number[]): void {
    const nowMs = Date.now();
    const due = Math.floor(((nowMs - playback.startedAtMs) / MS_PER_S) * FRAME_RATE_HZ) - playback.framesEmitted;
    if (due <= 0) return;
    if (due > MAX_CATCH_UP_FRAMES) playback.framesEmitted += due - 1;
    const { analyser, freqDb, samples } = playback;
    analyser.getFloatFrequencyData(freqDb);
    analyser.getFloatTimeDomainData(samples);
    const bands = bandBins.map((bins) => {
      const power = bins.reduce((sum, bin) => sum + 10 ** ((freqDb[bin] + ANALYSER_TO_AGENT_DB) / 10), 0) / bins.length;
      const scaled = (toDb(power) - BAND_FLOOR_DB) / (BAND_CEIL_DB - BAND_FLOOR_DB);
      return Math.round(Math.min(Math.max(scaled, 0), 1) * BAND_LEVELS);
    });
    let onset = 0;
    onsetBins.forEach((bin, i) => {
      const log = Math.log1p(ONSET_LOG_GAIN * 10 ** ((freqDb[bin] + ANALYSER_TO_AGENT_DB) / 20));
      onset += Math.max(log - playback.previousOnsetLog[i], 0);
      playback.previousOnsetLog[i] = log;
    });
    const hop = samples.subarray(samples.length - AGENT_HOP_SAMPLES);
    const power = hop.reduce((sum, sample) => sum + sample * sample, 0) / hop.length;
    playback.powers.push([nowMs, power]);
    while (playback.powers.length > 0 && playback.powers[0][0] < nowMs - SILENCE_WINDOW_S * MS_PER_S) playback.powers.shift();
    this.emitWaveform(playback);

    for (let i = 0; i < Math.min(due, MAX_CATCH_UP_FRAMES); i++) {
      // only the first of a catch-up batch is new audio; the rest would read as no new hit
      const frame = { t_ms: nowMs, bands, onset: i === 0 ? onset : 0, level_db: toDb(power) };
      this.subscribers.forEach(({ handlers }) => handlers.onFrame(frame));
      playback.framesEmitted++;
    }
  }

  /**
   * Sends the latest WAVEFORM_LENGTH samples, as bytes centred on 128, to streams that want them.
   * @param playback - The running playback (its samples are this tick's).
   */
  private emitWaveform(playback: Playback): void {
    const { samples, waveformBytes } = playback;
    const start = samples.length - WAVEFORM_LENGTH;
    for (let i = 0; i < WAVEFORM_LENGTH; i++) {
      waveformBytes[i] = Math.min(Math.max(Math.round(BYTE_CENTRE + samples[start + i] * BYTE_CENTRE), 0), BYTE_MAX);
    }
    this.subscribers.forEach(({ handlers, waveform }) => {
      if (waveform) handlers.onWaveform(waveformBytes);
    });
  }

  /**
   * Sends the tempo: nothing for the first few seconds (the agent needs that much audio
   * before it calls a tempo), then the song's own beat.
   * @param playback - The running playback.
   */
  private emitTempo(playback: Playback): void {
    const nowMs = Date.now();
    const levelDb = playback.powers.length === 0 ? toDb(0) : toDb(playback.powers.reduce((sum, [, power]) => sum + power, 0) / playback.powers.length);
    const settled = nowMs - playback.startedAtMs >= TEMPO_MIN_WINDOW_S * MS_PER_S && levelDb >= SILENCE_DB;
    const periodMs = (SECONDS_PER_MINUTE / this.song.bpm) * MS_PER_S;
    const tempo: BpmTempo = settled
      ? {
          bpm: this.song.bpm,
          confidence: SIM_CONFIDENCE,
          beat_ms: this.contextTimeToEpochMs(playback.startCtxS + this.song.firstBeatS) + this.offsetMs,
          period_ms: periodMs,
          offset_ms: this.offsetMs,
          level_db: levelDb,
          curve: simulatedCurve(this.song.bpm),
        }
      : { bpm: null, confidence: 0, beat_ms: null, period_ms: null, offset_ms: this.offsetMs, level_db: levelDb, curve: CURVE_BPMS.map(() => 0) };
    this.subscribers.forEach(({ handlers }) => handlers.onTempo(tempo));
  }

  /**
   * When a moment on the audio clock comes out of the speakers, on Date.now()'s clock.
   * @param ctxS - AudioContext time, s.
   * @returns Epoch ms.
   */
  private contextTimeToEpochMs(ctxS: number): number {
    const ctx = this.ctx;
    if (!ctx) return Date.now();
    const stamp = ctx.getOutputTimestamp?.();
    if (stamp?.contextTime !== undefined && stamp.performanceTime !== undefined && stamp.performanceTime > 0) {
      return performance.timeOrigin + stamp.performanceTime + (ctxS - stamp.contextTime) * MS_PER_S;
    }
    return Date.now() + (ctxS - ctx.currentTime + (ctx.outputLatency || 0)) * MS_PER_S;
  }
}
