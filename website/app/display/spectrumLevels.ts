/**
 * Animated spectrum levels shared by the bpm visuals: each band jumps straight
 * up to the music and falls back under gravity, with a slower-falling peak
 * cap, and an auto gain makes the loudest recent band full height whatever
 * the room's volume.
 */

// auto gain: the loudest recent band sets full height, letting go of a loud moment over
// this long, and never amplifying quieter than MIN_GAIN_CEILING (so silence stays low)
const GAIN_RELEASE_S = 4;
const MIN_GAIN_CEILING = 90;
// > 1 pushes quiet bands down, so the motion has more drama
const LEVEL_CURVE_EXPONENT = 1.6;

/** Per-band animation state. Heights and caps are 0-1. */
export interface SpectrumLevels {
  heights: number[];
  caps: number[];
  gainCeiling: number;
}

/**
 * Fresh levels, everything at rest.
 * @returns New state.
 */
export function createSpectrumLevels(): SpectrumLevels {
  return { heights: [], caps: [], gainCeiling: MIN_GAIN_CEILING };
}

/**
 * Moves each band toward the latest spectrum: straight up, or down under gravity.
 * @param levels - State, updated in place.
 * @param bands - Latest band levels 0-255.
 * @param dtS - Seconds since the last animation frame.
 * @param fallPerS - How many full heights a band falls per second.
 * @param capFallPerS - How many full heights a cap falls per second.
 */
export function updateSpectrumLevels(
  levels: SpectrumLevels,
  bands: number[],
  dtS: number,
  fallPerS: number,
  capFallPerS: number
): void {
  const loudest = Math.max(...bands);
  const release = Math.exp(-dtS / GAIN_RELEASE_S);
  levels.gainCeiling = Math.max(MIN_GAIN_CEILING, loudest, levels.gainCeiling * release);
  bands.forEach((level, i) => {
    const target = Math.pow(Math.min(1, level / levels.gainCeiling), LEVEL_CURVE_EXPONENT);
    const height = Math.max(target, (levels.heights[i] ?? 0) - fallPerS * dtS);
    levels.heights[i] = height;
    levels.caps[i] = Math.max(height, (levels.caps[i] ?? 0) - capFallPerS * dtS);
  });
}
