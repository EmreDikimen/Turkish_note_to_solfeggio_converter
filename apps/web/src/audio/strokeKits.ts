/**
 * The drums F2 can play, and where every one of their files came from.
 *
 * ⚠ **This table IS the audio manifest the swap discipline requires** (docs/features/README.md —
 * "a manifest with `source` and `license` on every file, from the first one"). It is deliberately
 * not a fetched `manifest.json`: keeping it as TypeScript means it is type-checked, it costs no
 * second round trip, and the licence sits in the same diff as the file that needs it. These things
 * do not fail as lawsuits, they fail as "I no longer know where four of these came from" — so
 * whatever is added here MUST arrive with its `source` and `license` filled in, and a matching line
 * in `public/THIRD-PARTY.txt`.
 *
 * The files themselves are produced by `scripts/prepare_strokes.py`, which downloads the VCSL
 * originals, picks the düm/tek/ka articulations by measurement, trims and levels them. Never edit a
 * wav under `public/audio/` by hand — re-run the script, so how it was made stays readable.
 */
import type { Stroke } from "@turkish-omr/core";

export type KitId = "darbuka" | "bendir";

export interface StrokeKit {
  id: KitId;
  /** Shown in the picker. Real instrument names, so they are not translated. */
  label: string;
  /** Where the recordings came from — the answer to an audit question. */
  source: string;
  license: string;
  /**
   * Paths relative to the audio base, per stroke. More than one is a round-robin: `scheduleStroke`
   * alternates them so a usul repeating the same stroke every cycle does not sound like a machine.
   */
  files: Record<Stroke, string[]>;
}

const kit = (id: KitId, label: string, source: string): StrokeKit => ({
  id,
  label,
  source,
  license: "CC0 1.0",
  files: {
    dum: [`${id}/dum-rr1.wav`, `${id}/dum-rr2.wav`],
    tek: [`${id}/tek-rr1.wav`, `${id}/tek-rr2.wav`],
    ka: [`${id}/ka-rr1.wav`, `${id}/ka-rr2.wav`],
  },
});

export const KITS: StrokeKit[] = [
  kit(
    "darbuka",
    "Darbuka",
    "https://github.com/sgossner/VCSL — Membranophones/Struck Membranophones/Darbuka",
  ),
  kit(
    "bendir",
    "Bendir",
    "https://github.com/sgossner/VCSL — Membranophones/Struck Membranophones/Frame Drum",
  ),
];

export const DEFAULT_KIT: KitId = "darbuka";

export function findKit(id: string): StrokeKit | undefined {
  return KITS.find((k) => k.id === id);
}
