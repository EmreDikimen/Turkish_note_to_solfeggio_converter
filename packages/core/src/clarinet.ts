/**
 * Sol klarnet (G clarinet, ALBERT/German system) fingering + lip bend — feature F3's third
 * instrument.
 *
 * What/why: a clarinet is the opposite of the violin's problem. A violin position is a formula that
 * accepts any frequency, so all 53 commas land exactly (`fingering.ts`). A clarinet fingering is a
 * LOOKUP — which holes are covered — and a lookup can only ever hold the twelve notes a chart is
 * written in. Makam music does not live on twelve.
 *
 * ⭐ **The lip is what closes that gap** (owner, 2026-08-29: *"klarnette koma sesleri vermek için
 * dudağımızı salıyoruz bir miktar"*). Relaxing the embouchure lowers the pitch continuously. So a
 * note is played as TWO things, and the view draws them separately:
 *
 *   1. the nearest standard fingering AT OR ABOVE the note — discrete, from the table below;
 *   2. how far to relax the lip to come down to it — continuous, in commas.
 *
 * ⭐ It is the same answer the violin reached independently: draw a fixed reference, and let the
 * microtone live in the gap. Nothing here ever snaps a koma onto the twelve-tone grid.
 *
 * ⛔ **THE SYSTEM IS ALBERT, NOT BOEHM, AND THAT IS NOT COSMETIC** (owner, 2026-08-29:
 * *"sanırım sen fransız tipi sol klarneti yapıyosun. Alman tipi olmalı."*). The first version of
 * this table was transcribed from Boehm (French) diagrams and was wrong by up to a semitone on the
 * SAME fingering — `T lh123|rh1--` is Si♭ on a Boehm and **Si** on an Albert. Never mix a source
 * from the other system in, however convenient the diagram. docs/features/clarinet-view.md.
 *
 * ⚠ **Pitches here are WRITTEN commas, not concert.** The owner plays what is on the page with the
 * fingering of that name — the G instrument's transposition and Turkish notation's fourth cancel
 * out in practice — so this module is fed `koma53` from the document (plus the makam's deltas),
 * exactly like `kanun.ts` and deliberately unlike `fingering.ts`.
 *
 * Pure data + maths, so it lives in core and ports to mobile unchanged. Nothing about pixels or the
 * DOM belongs here; the drawing is `apps/web/src/ui/clarinetArt.ts`.
 */

import { komaToName } from "./notation";

/**
 * A hole or key on an Albert-system clarinet.
 *
 * ⚠ **These ids are OUR OWN and name the mechanism, not a drawing.** The first version borrowed the
 * ids from a third-party SVG whose layer names were the *notes the keys produce* — which read as
 * documentation and was in one case a whole tone wrong. Naming by function instead means the id
 * cannot disagree with anything.
 *
 * The set is the Albert key list, taken from the Oehler/Albert chart cited on `BASE_FINGERINGS`:
 * six finger holes and a thumb hole, the register key, five left-hand and two right-hand keys, the
 * two throat keys, two right side keys, and the two "sliver" keys that sit between holes.
 */
export type ClarinetKeyId =
  // the seven holes and the thumb's second job. `lh1` is nearest the barrel; `rh3` nearest the bell.
  | "thumb"
  | "register"
  | "lh1"
  | "lh2"
  | "lh3"
  | "rh1"
  | "rh2"
  | "rh3"
  // ⚠ THE KEYS ARE NAMED FOR THE NOTE THEY ARE PRESSED ON, because that is the one thing about them
  // that is verified. The owner placed each of these himself; what a key is *called* on an Albert
  // instrument is not something this project ever established, and the earlier names claimed to
  // know (`lh_gb`, `throat_ab`, `side3` …) — five of six were wrong.
  | "key_a4"
  | "key_gis4"
  | "key_cis"
  | "key_dis"
  | "key_bes"
  | "key_e"
  | "key_fis"
  | "key_f4"
  | "key_gis3"
  /** Down for all three of the lowest notes — the only key shared by more than one fingering. */
  | "key_low";

/** Everything closed — the fingering that sounds Sol, and the anchor the rest is read against. */
const ALL: readonly ClarinetKeyId[] = ["thumb", "lh1", "lh2", "lh3", "rh1", "rh2", "rh3"];
/** The upper joint fully down, right hand off. */
const LH: readonly ClarinetKeyId[] = ["thumb", "lh1", "lh2", "lh3"];

/** One standard fingering. */
export interface ClarinetFingering {
  /**
   * The note this fingering sounds, as an absolute comma in this project's 53-TET grid — the same
   * space as `NoteEvent.koma53`.
   */
  koma: number;
  /**
   * The note this fingering SOUNDS, spelled the way the app spells every other pitch
   * (`komaToName`, solfège) — so it can be read straight against the note on the page.
   *
   * ⚠ It is deliberately NOT the fingering's identity. A clarion note is fingered as something else
   * entirely — written Sol5 is played with the Do4 fingering plus the register key — and the first
   * version of this table put *that* in the label. It made the view read as if it were showing the
   * wrong note. What a player checks against the page is this; what they need to know beyond it is
   * `fingeredAs`.
   */
  label: string;
  /**
   * The note whose fingering this one borrows — *what you finger*, when that is not what sounds.
   *
   * Two cases, and both are facts about a clarinet rather than bookkeeping: a **clarion** note is
   * the chalumeau fingering a twelfth below plus the register key, and an **altissimo** note can
   * share a fingering with a lower one and be separated only by the embouchure. `null` when the
   * fingering is the note's own.
   */
  fingeredAs: string | null;
  /** Every hole and key that must be shown pressed to draw it. */
  keys: readonly ClarinetKeyId[];
  /** True once the register key is down: the clarion, a twelfth above the same fingering. */
  clarion: boolean;
}

/**
 * A twelfth, in commas of this project's grid: an octave (53) plus a fifth (31).
 *
 * ⚠ This is the one piece of real clarinet physics the table depends on, and it is why the table is
 * short. A clarinet is a stopped pipe, so it overblows to the TWELFTH rather than the octave — the
 * register key takes every chalumeau fingering up by exactly this and gives the whole clarion
 * register for free.
 *
 * ⭐ **Confirmed against the source rather than assumed.** The chart's clarion page is, symbol for
 * symbol, its chalumeau page with the register key added: its B4 is the E3 fingering, its D5 the
 * G3, its C6 the F4. On this grid E3 + 84 = 314 = B4 and F4 + 84 = 371 = C6, exactly.
 */
export const REGISTER_TWELFTH = 84;

/**
 * How far the lip can lower a note, in commas (owner, 2026-08-29).
 *
 * ⚠ **DATA, not a constant to reason from.** It is one player's reach on one instrument, it varies
 * with register and reed, and it is held here so changing it is one line and touches no drawing
 * code — the same treatment `VIOLIN_TUNINGS` and `MANDAL_LAYOUTS` get.
 *
 * ⭐ Five commas is what makes the whole design work, and the owner said why before it was checked:
 * *"nothing needs to have more than 4-5 koma, and we can have up to 5 koma"*. Every step in the
 * table below is **4 or 5 commas** — verified, not asserted, by `clarinet-test.ts` — so every pitch
 * between two fingerings is inside one lip. There is no note this instrument can be asked for and
 * not reach.
 */
export const LIP_REACH_KOMA = 5;

/** How every pitch in this module is named: the app's own spelling, so it matches the page. */
const NOTE = (koma: number): string => komaToName(koma, "solfege");

/**
 * THE LADDER OF SPELLED NOTES on this 53-TET grid, as pitch classes: the seven naturals, the five
 * flats (natural − 4) and the five sharps (natural + 4).
 *
 * ⚠ It exists for one job — see `clarionKoma` — and it is why the two spellings of a black note are
 * a comma apart here and identical in twelve-tone.
 */
const SPELLED: readonly number[] = [0, 4, 5, 9, 13, 14, 18, 22, 26, 27, 31, 35, 36, 40, 44, 45, 49];

/**
 * Where a chalumeau fingering lands when the register key is added.
 *
 * ⛔ **NOT simply `koma + 84`, and the difference is a real bug this replaced.** The instrument
 * overblows a true twelfth, but a true twelfth above a FLAT-spelled note is not itself a spelled
 * note on this grid: the chain of fifths breaks at Si♭ → Fa, which is 30 commas here and not 31.
 * So `Si♭3 + 84` came out at 341, one comma above Fa5, and the table advertised a note nobody
 * writes — the only row of the thirty-three that did.
 *
 * ✅ The instrument adds a twelfth; the notation writes the **nearest spelled note**. Snapping does
 * nothing at all to the other twelve clarion rows, which already land on the ladder, and moves this
 * one by exactly the one comma it was out. `clarinet-test.ts` pins both halves of that claim.
 */
function clarionKoma(baseKoma: number): number {
  const raw = baseKoma + REGISTER_TWELFTH;
  for (let d = 0; d <= 2; d++) {
    for (const k of d === 0 ? [raw] : [raw - d, raw + d]) {
      if (SPELLED.includes(((k % 53) + 53) % 53)) return k;
    }
  }
  return raw;
}

/**
 * THE STANDARD FINGERINGS, chalumeau and throat — the table everything else is derived from.
 *
 * ⭐ **THE OWNER'S OWN TABLE, placed by him note by note on 2026-08-30**, using the editor at
 * `tools/core/clarinet-editor.ts`. It started from the Woodwind Fingering Guide's Oehler/Albert
 * chart (https://www.wfg.woodwind.org/clarinet/ocl_bas_1.html, extracted from that page's own
 * markup rather than from a description of it), and he then corrected it against the instrument he
 * plays.
 *
 * ⭐ **Six of the nineteen changed, and every one was a KEY — no hole moved and no note moved.**
 * That is the useful result: the chart's *notes* survived contact with a real sol klarnet, and my
 * guesses about *which piece of metal* did not. Five of the six keys I had placed by eye were on
 * the wrong key entirely (`lh_gb`, `lh_db`, `sliver_rh`, `side3`, `throat_ab`); the sixth, Mi3's
 * `lh_e`, was a key that turned out to belong to Fa4.
 *
 * ⚠ **So a `keys` entry is now evidence and a key NAME is not.** The ids say which note a key is
 * pressed on, because that is what was verified; nothing here claims to know the Albert name for
 * any of them.
 *
 * ⚠ **Spellings follow the chart's own**, which names the black notes as FLATS (G♭, A♭, B♭, D♭,
 * E♭). That suits this repertoire — the shipped scores are flat-dominated — and it matters on this
 * grid, where AEU separates a raised note from a lowered one by a comma: D♭4 is 270 where C♯4 would
 * be 269. A score that spells the sharp lands one comma under the fingering and takes one comma of
 * lip, which is correct rather than an error.
 *
 * ⚠ Alternates are deliberately NOT carried. The chart gives two or three for several notes; the
 * view has to show one thing, and a "which alternate" rule is a real design question rather than
 * something to guess. The primary is what a player is taught first.
 */
export const BASE_FINGERINGS: readonly ClarinetFingering[] = [
  // --- the low notes ---------------------------------------------------------------------
  { koma: 230, label: NOTE(230), fingeredAs: null, keys: [...ALL, "key_low", "key_e"], clarion: false },
  { koma: 234, label: NOTE(234), fingeredAs: null, keys: [...ALL, "key_low"], clarion: false },
  { koma: 239, label: NOTE(239), fingeredAs: null, keys: [...ALL, "key_low", "key_fis"], clarion: false },
  // --- the chalumeau scale: lift one finger at a time ---------------------------------------
  { koma: 243, label: NOTE(243), fingeredAs: null, keys: ALL, clarion: false },
  { koma: 248, label: NOTE(248), fingeredAs: null, keys: [...ALL, "key_gis3"], clarion: false },
  { koma: 252, label: NOTE(252), fingeredAs: null, keys: ["thumb", "lh1", "lh2", "lh3", "rh1", "rh2"], clarion: false },
  { koma: 257, label: NOTE(257), fingeredAs: null, keys: ["thumb", "lh1", "lh2", "lh3", "rh1", "rh2", "key_bes"], clarion: false },
  // ⚠ Si is ONE hole open past Si♭. On a Boehm this same shape is Si♭ and Si is a fork — the
  // difference that made the first table wrong, so it is spelled out rather than left to a pattern.
  { koma: 261, label: NOTE(261), fingeredAs: null, keys: ["thumb", "lh1", "lh2", "lh3", "rh1"], clarion: false },
  { koma: 265, label: NOTE(265), fingeredAs: null, keys: LH, clarion: false },
  { koma: 270, label: NOTE(270), fingeredAs: null, keys: [...LH, "key_cis"], clarion: false },
  { koma: 274, label: NOTE(274), fingeredAs: null, keys: ["thumb", "lh1", "lh2"], clarion: false },
  { koma: 279, label: NOTE(279), fingeredAs: null, keys: ["thumb", "lh1", "lh2", "key_dis"], clarion: false },
  { koma: 283, label: NOTE(283), fingeredAs: null, keys: ["thumb", "lh1"], clarion: false },
  { koma: 287, label: NOTE(287), fingeredAs: null, keys: ["thumb", "lh1", "key_f4"], clarion: false },
  // ⚠ Sol♭4 closes the THUMB with every hole open, and Sol4 opens the thumb too. On a Boehm the
  // pair runs the other way round.
  { koma: 292, label: NOTE(292), fingeredAs: null, keys: ["thumb"], clarion: false },
  // --- the throat: nothing down but the top keys ---------------------------------------------
  { koma: 296, label: NOTE(296), fingeredAs: null, keys: [], clarion: false },
  { koma: 301, label: NOTE(301), fingeredAs: null, keys: ["key_gis4"], clarion: false },
  { koma: 305, label: NOTE(305), fingeredAs: null, keys: ["key_a4"], clarion: false },
  // ⚠ The throat Si♭ vents with the REGISTER key — the one fingering outside the clarion that uses it.
  { koma: 310, label: NOTE(310), fingeredAs: null, keys: ["register", "key_a4"], clarion: false },
];

/**
 * THE ALTISSIMO — the notes above Do6, placed by the owner on 2026-08-30.
 *
 * ⭐ **Its own table, and structurally so: `CLARION` is derived from `BASE_FINGERINGS` alone, which
 * is what makes it impossible to overblow one of these a second time.** The earlier version relied
 * on a koma cutoff to exclude them, which would have worked and would have been an accident.
 *
 * ⚠ **A third register is NOT a further overblowing**, so no arithmetic produces these — each is
 * its own fingering and they had to be collected from a player. The owner filled them in through
 * `tools/core/clarinet-editor.ts`; every point snapped to a position his earlier pass had already
 * established, so this range needed no new calibration at all.
 *
 * ⭐ **Sol6 and Re6 are the SAME FINGERING**, and that is the owner's own account of it: *"sol6 re6
 * ile aynı oldu ama aradaki fark dudağını daha sert sıkmak oluyor zaten."* They sit **22 commas —
 * a perfect fourth — apart**, which is the next partial of the same tube, reached by tightening
 * rather than by moving a finger. ⚠ So two rows here carry identical `keys` on purpose. Anything
 * that assumes a fingering identifies a note is wrong on this instrument, which is exactly why the
 * view labels by the note that SOUNDS.
 *
 * ⚠ **Only Re♭6 uses the register key or the thumb** in what the owner gave. That is unusual enough
 * to be worth a second look with the instrument in hand, and it is recorded as his data rather than
 * quietly "corrected" — every time this table has been argued with from theory, the theory lost.
 */
export const ALTISSIMO_FINGERINGS: readonly ClarinetFingering[] = [
  { koma: 376, label: NOTE(376), fingeredAs: null, keys: ["thumb", "register"], clarion: false },
  { koma: 380, label: NOTE(380), fingeredAs: null, keys: ["lh2", "lh3", "rh1", "rh3", "key_gis3"], clarion: false },
  { koma: 385, label: NOTE(385), fingeredAs: null, keys: ["lh2", "lh3", "rh1", "key_gis3"], clarion: false },
  { koma: 389, label: NOTE(389), fingeredAs: null, keys: ["lh2", "lh3"], clarion: false },
  { koma: 393, label: NOTE(393), fingeredAs: null, keys: ["lh2", "lh3", "key_cis"], clarion: false },
  { koma: 398, label: NOTE(398), fingeredAs: null, keys: ["lh2"], clarion: false },
  // ⭐ Re6's fingering, a fourth higher, played with a tighter lip — not a key change at all.
  { koma: 402, label: NOTE(402), fingeredAs: NOTE(380), keys: ["lh2", "lh3", "rh1", "rh3", "key_gis3"], clarion: false },
];

/**
 * The clarion register: the same fingerings with the register key, a twelfth up.
 *
 * ⚠ Only the fingerings up to Fa4 overblow this way, which is where the source chart's clarion page
 * stops (its top is C6, the Fa4 fingering). Above that the altissimo begins — a different table
 * with its own alternates, deliberately not modelled, so those notes come back as out of range
 * rather than as a fingering that would not work.
 */
const CLARION_TOP_BASE = 287;

const CLARION: readonly ClarinetFingering[] = BASE_FINGERINGS.filter(
  (f) => f.koma <= CLARION_TOP_BASE,
).map((f) => {
  const koma = clarionKoma(f.koma);
  return {
    koma,
    label: NOTE(koma),
    fingeredAs: f.label,
    keys: [...f.keys.filter((k) => k !== "register"), "register" as ClarinetKeyId],
    clarion: true,
  };
});

/** Every fingering this module knows, lowest first. */
export const CLARINET_FINGERINGS: readonly ClarinetFingering[] = [
  ...BASE_FINGERINGS,
  ...CLARION,
  ...ALTISSIMO_FINGERINGS,
]
  .slice()
  .sort((a, b) => a.koma - b.koma);

/** The lowest and highest notes the table can reach at all, before the lip is considered. */
export const CLARINET_LOWEST_KOMA = CLARINET_FINGERINGS[0]!.koma;
export const CLARINET_HIGHEST_KOMA = CLARINET_FINGERINGS[CLARINET_FINGERINGS.length - 1]!.koma;

/** Where one note is played: the fingering, and how far the lip has to come down from it. */
export interface ClarinetPos {
  /** Index into `CLARINET_FINGERINGS`. */
  fingeringIndex: number;
  /**
   * How far to relax the lip, in commas — **never negative**, because relaxing only ever lowers.
   * 0 for an ordinary note that the fingering plays as it stands.
   */
  bendKoma: number;
}

/**
 * The fingering for one written comma, and the bend that gets it there.
 *
 * The rule is *take the nearest fingering AT OR ABOVE and relax down to the note*, which is the
 * direction the technique actually runs. `null` means the note is outside what this table can play:
 * below the lowest fingering minus a lip, above the highest, or more than `LIP_REACH_KOMA` below
 * the nearest fingering above it.
 *
 * ⚠ That last case must stay a `null` rather than a clamp. Drawing a bend the lip cannot make would
 * teach the player something false, which is the one thing an instrument view may not do.
 */
export function fingerClarinet(
  koma: number,
  reach: number = LIP_REACH_KOMA,
  table: readonly ClarinetFingering[] = CLARINET_FINGERINGS,
): ClarinetPos | null {
  if (!Number.isFinite(koma)) return null;

  let index = -1;
  for (let i = 0; i < table.length; i++) {
    if (table[i]!.koma >= koma - 1e-9) {
      index = i;
      break;
    }
  }
  if (index < 0) return null; // above everything the table holds

  const bend = table[index]!.koma - koma;
  if (bend > reach + 1e-9) return null; // the lip cannot reach down that far
  return { fingeringIndex: index, bendKoma: Math.max(0, bend) };
}

/**
 * The fingering for every note of a piece, in one pass.
 *
 * `komas` is one WRITTEN comma per note in order, with `NaN` for rests — which is what
 * `NoteEvent.koma53` plus the makam's deltas gives. The result is aligned 1:1 with it; an entry is
 * `null` for a rest and for any note the instrument cannot reach.
 *
 * ⚠ There is deliberately **no state carried between notes**, and that is the whole difference from
 * `kanun.ts`. A mandal stays where it is put, so a kanun is a state machine over the piece; a
 * clarinet fingering is released the moment the note ends, so every note is an independent lookup —
 * the same shape as the violin. The three F3 instruments are three different problems, and this is
 * the second time that has decided a design.
 */
export function assignClarinet(
  komas: readonly number[],
  reach: number = LIP_REACH_KOMA,
  table: readonly ClarinetFingering[] = CLARINET_FINGERINGS,
): (ClarinetPos | null)[] {
  return komas.map((k) => (Number.isFinite(k) ? fingerClarinet(k, reach, table) : null));
}
