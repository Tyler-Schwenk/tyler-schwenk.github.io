// FNV-1a + murmur3 fmix32 constants. plain FNV barely moves the high bits
// when only the last char differs, so the finalizer spreads salts out properly
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const FMIX_MULTIPLIER_A = 0x85ebca6b;
const FMIX_MULTIPLIER_B = 0xc2b2ae35;
const UINT32_MAX = 0xffffffff;
const ROUNDING_FACTOR = 100;

/**
 * Hashes a string to an unsigned 32-bit int. same input always gives the same
 * output, which is what keeps each note's look stable across builds.
 *
 * @param {string} value - String to hash.
 * @returns {number} Unsigned 32-bit hash.
 */
function hashString(value: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, FMIX_MULTIPLIER_A);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, FMIX_MULTIPLIER_B);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Deterministic "random" number in [0, 1] for a seed. use a different salt for
 * each property so tilt, color, etc. don't all move together.
 *
 * @param {string} seed - Stable id of the thing being styled.
 * @param {string} salt - Name of the property being picked.
 * @returns {number} Value between 0 and 1 inclusive.
 */
export function seededUnit(seed: string, salt: string): number {
  return hashString(`${seed}:${salt}`) / UINT32_MAX;
}

/**
 * Deterministic number in [min, max], rounded to 2 decimals so inline styles stay tidy.
 *
 * @param {string} seed - Stable id of the thing being styled.
 * @param {string} salt - Name of the property being picked.
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 * @returns {number} Value between min and max.
 */
export function seededRange(seed: string, salt: string, min: number, max: number): number {
  const value = min + seededUnit(seed, salt) * (max - min);
  return Math.round(value * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

/**
 * Deterministically picks one option for a seed.
 *
 * @param {string} seed - Stable id of the thing being styled.
 * @param {string} salt - Name of the property being picked.
 * @param {readonly T[]} options - Non-empty list to pick from.
 * @returns {T} The picked option.
 */
export function seededPick<T>(seed: string, salt: string, options: readonly T[]): T {
  const index = hashString(`${seed}:${salt}`) % options.length;
  return options[index];
}
