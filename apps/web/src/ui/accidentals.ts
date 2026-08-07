/**
 * The accidentals the EDITOR offers, and how each one is shown — one list, two consumers.
 *
 * Both the palette's accidental tools and the measure modal's dropdown pick from here, so the two
 * edit paths cannot drift into offering different alterations. (The modal goes at step 10 of
 * docs/mvp/editor.md; until then it stays working off the same source.)
 *
 * The list is the full range INCLUDING the numbered ±2/±3, so the user can set the exact comma
 * they want. The engraved staff snaps what it draws to the standard AEU signs (`toAeuAlter`); the
 * editor does not snap what it stores.
 */

import { accidentalGlyph, accidentalLabel } from "@turkish-omr/core";

/** Offered alterations in commas, low pitch → high pitch. 0 is natural. */
export const ACCIDENTAL_VALUES = [-8, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 8];

/** The four AEU signs plus natural — the palette's row, kept short enough to click without
 *  reading. The numbered alterations stay in the modal's dropdown. */
export const PALETTE_ACCIDENTALS = [-5, -4, -1, 0, 1, 4, 5];

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
