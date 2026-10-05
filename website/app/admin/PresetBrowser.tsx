"use client";

import { useMemo, useState } from "react";
import { presetKey } from "@/app/display/kioskControl";
import { loadPresetLibrary, sortedPresetNames } from "@/app/display/milkdropPresets";
import { errorMessage } from "./adminApi";
import { plural } from "./format";
import { Button, INPUT_CLASS, Muted } from "./ui";

/**
 * Every milkdrop preset, searchable, to jump the kiosk straight to one. The
 * names come from the same preset packs the kiosk loads, sorted the same way,
 * so a preset's place in the list is what its preset-<n> key means. The packs
 * are big (~450 KB gzipped), so they're only fetched once "Browse" is tapped.
 * @param props.playing - The preset on screen now, to highlight it.
 * @param props.disabled - Grey the buttons out (kiosk offline, or a press in flight).
 * @param props.press - Sends keys to the kiosk.
 */
export default function PresetBrowser({
  playing,
  disabled,
  press,
}: {
  playing: string | null;
  disabled: boolean;
  press: (keys: string[]) => void;
}) {
  const [names, setNames] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setNames(sortedPresetNames(await loadPresetLibrary()));
    } catch (err) {
      setError(`couldn't load the preset list: ${errorMessage(err)}`);
    }
    setLoading(false);
  };

  // each match keeps its index in the full sorted list, which is what the key needs
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (names ?? []).map((name, index) => ({ name, index })).filter(({ name }) => name.toLowerCase().includes(needle));
  }, [names, query]);

  if (!names) {
    return (
      <div className="flex flex-col gap-2">
        <Button onClick={load} disabled={loading}>
          {loading ? "Loading presets..." : "Browse all presets"}
        </Button>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    );
  }

  const pickRandom = () => press([presetKey(Math.floor(Math.random() * names.length))]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="search"
          className={INPUT_CLASS}
          placeholder={`Search ${names.length} presets`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <Button onClick={pickRandom} disabled={disabled}>
          Random
        </Button>
      </div>
      <div className="text-xs text-slate-500">{plural(matches.length, "preset")}</div>
      {matches.length === 0 ? (
        <Muted>No presets match.</Muted>
      ) : (
        <ul className="max-h-96 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900">
          {matches.map(({ name, index }) => (
            <li key={name} className="border-b border-slate-800 last:border-b-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => press([presetKey(index)])}
                className={`w-full px-3 py-2.5 text-left text-sm break-words transition disabled:opacity-40 ${
                  name === playing ? "bg-orange-500/15 text-orange-300" : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
