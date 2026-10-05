/**
 * The MilkDrop presets: every preset from all four butterchurn-presets packs
 * (base, Extra, Extra2, MD1), merged by name (a few are in more than one).
 *
 * The packs are big (~450 KB gzipped), so they're only fetched when asked for:
 * by the milkdrop view when it opens, and by the admin page's remote when its
 * preset browser opens. Both number presets the same way, by their place in
 * `sortedPresetNames`, which is what the remote's `preset-<n>` key means. That
 * holds as long as both run the same deploy of the site.
 */

/** Something with butterchurn-presets' getPresets, as each pack module exports. */
type PresetPack = typeof import("butterchurn-presets").default;

/** Preset name to preset definition. */
export type PresetLibrary = Record<string, object>;

/**
 * Picks a library's export whichever way the bundler wrapped it (the
 * packages are UMD builds, so it may sit on `default` once or twice).
 * @param mod - What import() gave.
 * @param member - A member the real export has.
 * @returns The export.
 */
export function unwrapExport<T>(mod: unknown, member: string): T {
  let candidate = mod as Record<string, unknown> | undefined;
  while (candidate && !(member in candidate) && "default" in candidate) {
    candidate = candidate.default as Record<string, unknown>;
  }
  if (!candidate || !(member in candidate)) throw new Error(`couldn't find ${member} in the loaded module`);
  return candidate as T;
}

/**
 * Loads every preset pack, merged into one library.
 * @returns The presets by name.
 */
export async function loadPresetLibrary(): Promise<PresetLibrary> {
  const packModules = await Promise.all([
    import("butterchurn-presets"),
    import("butterchurn-presets/lib/butterchurnPresetsExtra.min.js"),
    import("butterchurn-presets/lib/butterchurnPresetsExtra2.min.js"),
    import("butterchurn-presets/lib/butterchurnPresetsMD1.min.js"),
  ]);
  const packs = packModules.map((mod) => unwrapExport<PresetPack>(mod, "getPresets").getPresets());
  return Object.assign({}, ...packs);
}

/**
 * Every preset name in a fixed order: plain code-unit order, so every browser
 * sorts them identically. Indexes into this are what preset-<n> keys mean.
 * @param library - From loadPresetLibrary.
 * @returns The sorted names.
 */
export function sortedPresetNames(library: PresetLibrary): string[] {
  return Object.keys(library).sort();
}
