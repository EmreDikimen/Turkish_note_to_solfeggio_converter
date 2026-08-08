/**
 * The accidentals the EDITOR offers, and how each one is shown.
 *
 * The list is the FULL range: the four AEU signs each way (koma 1, bakiye 4, küçük 5, büyük 8),
 * natural, and the numbered 2- and 3-comma alterations. Every one of them has its own Bravura
 * glyph (`accidental2CommaSharp` and friends), so they can all be shown as signs rather than as
 * text — which is why the palette can carry the whole set without becoming unreadable.
 *
 * ⚠ The numbered ±2/±3 are stored exactly and **drawn snapped**: the engraver prints the nearest
 * standard AEU sign (`toAeuAlter`), because that is what a Turkish edition prints. So a ±2 changes
 * the SOUND exactly and the printed sign only approximately — the tooltip says the comma count for
 * that reason. Until 2026-08-08 these lived in the measure modal's dropdown; the modal is gone and
 * the palette carries them.
 */

import { accidentalGlyph, accidentalLabel } from "@turkish-omr/core";

/** Offered alterations in commas, low pitch → high pitch. 0 is natural. */
export const ACCIDENTAL_VALUES = [-8, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 8];

const NATURAL_CP = 0xe261;

/** The Bravura codepoint drawn for an alteration (natural for 0, and as a fallback). */
export function accidentalCp(commas: number): number {
  if (commas === 0) return NATURAL_CP;
  return accidentalGlyph(commas)?.codepoint ?? NATURAL_CP;
}

/** The glyph itself, ready to drop into a `.kv-glyph` span. */
export const accidentalChar = (commas: number): string => String.fromCodePoint(accidentalCp(commas));

/** Short Turkish name — "doğal" for 0, the AEU name otherwise. */
export const accidentalName = (commas: number): string =>
  commas === 0 ? "doğal" : accidentalLabel(commas);

/** Name plus the signed comma count, for menus and tooltips. */
export const accidentalLongLabel = (commas: number): string =>
  commas === 0 ? "doğal" : `${accidentalLabel(commas)} (${commas > 0 ? `+${commas}` : commas})`;
