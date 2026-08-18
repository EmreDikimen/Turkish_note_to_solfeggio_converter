/**
 * Reading a LilyPond SVG page: staff lines, glyph outlines, and WHICH accidental each glyph is.
 *
 * WHY IT IS ITS OWN FILE. Two callers need it and they must not share a belief: `render-ly.ts` uses
 * it to place the crop (and to learn the order LilyPond drew the key signature in), and
 * `verify-labels-ly.ts` uses it to count what was actually engraved and compare that with the label.
 * That is the same division as the VexFlow side, where `verify-labels.ts` identifies glyphs from the
 * DOM rather than from the code under test.
 *
 * HOW A GLYPH IS IDENTIFIED. LilyPond's SVG backend draws every musical symbol as a `<path>` whose
 * `d` is the font outline, wrapped in `<g transform="translate(x, y)">`; the scale lives in the path
 * transform, so the SAME glyph at any size — a grace note's small accidental included — has a
 * byte-identical `d`. We therefore identify accidentals by outline, and we do not hard-code the
 * outlines: `calibrate()` renders a reference document containing exactly the nine signs (the eight
 * AEU accidentals plus the natural), one per page, and reads their outlines back. If the font ever
 * changes, the table re-derives instead of silently mismatching.
 *
 * COORDINATES. LilyPond's SVG viewBox is in staff-spaces: consecutive staff lines are exactly 1.0
 * apart. That is what lets the crop reproduce the corpus geometry exactly — see `render-ly.ts`.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AEU_TOKEN, NATURAL_TOKEN } from "./lilypond";
import { MAKAM_SUFFIX, lilyDocument } from "./ly-engrave";

export interface Glyph { x: number; y: number; d: string }
export interface LySvg {
  /** viewBox in staff-spaces. */
  box: { x: number; y: number; w: number; h: number };
  glyphs: Glyph[];
  /** Absolute y of each drawn staff line, top first. */
  staffLines: number[];
  /** Horizontal span of the staff lines — the system's own left and right edge. */
  staffSpan: { x1: number; x2: number } | null;
}

const GROUP_RE = /<g transform="translate\(([-\d.]+),\s*([-\d.]+)\)">([\s\S]*?)<\/g>/g;
const PATH_D_RE = /<path[^>]*\sd="([^"]*)"/;
const LINE_RE = /<line[^>]*x1="([-\d.]+)"[^>]*x2="([-\d.]+)"/;

/** Parse one LilyPond SVG page. */
export function parseLySvg(text: string): LySvg {
  const vb = /viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/.exec(text);
  if (!vb) throw new Error("no viewBox in SVG");
  const box = { x: +vb[1]!, y: +vb[2]!, w: +vb[3]!, h: +vb[4]! };

  const glyphs: Glyph[] = [];
  const lines: { y: number; x1: number; x2: number }[] = [];
  GROUP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GROUP_RE.exec(text)) !== null) {
    const x = +m[1]!;
    const y = +m[2]!;
    const inner = m[3]!;
    const p = PATH_D_RE.exec(inner);
    if (p) { glyphs.push({ x, y, d: p[1]! }); continue; }
    const l = LINE_RE.exec(inner);
    if (l) lines.push({ y, x1: +l[1]!, x2: +l[2]! });
  }

  // The five staff lines are the full-width horizontal rules: same x span, 1.0 apart. Ledger lines
  // are short, so filtering on the widest span keeps them out.
  const widest = lines.reduce((w, l) => Math.max(w, l.x2 - l.x1), 0);
  const staff = lines.filter((l) => l.x2 - l.x1 > widest - 0.5).sort((a, b) => a.y - b.y);
  return {
    box,
    glyphs,
    staffLines: staff.map((l) => l.y),
    staffSpan: staff.length > 0 ? { x1: staff[0]!.x1, x2: staff[0]!.x2 } : null,
  };
}

// -------------------------------------------------------------------------------------------
// The outline → accidental table, derived by rendering the nine signs.

export type GlyphTable = Record<string, string>; // path `d` → label token

/** The nine signs, in the order the reference document draws them (one per page). */
export const CALIBRATION_TOKENS: string[] = [
  ...Object.values(AEU_TOKEN),
  NATURAL_TOKEN,
];

/** The comma alteration a calibration token stands for. */
function alterOf(tok: string): number {
  if (tok === NATURAL_TOKEN) return 0;
  return Number(Object.entries(AEU_TOKEN).find(([, t]) => t === tok)![0]);
}

/**
 * Render the reference document and read the outlines back out of it.
 *
 * ⚠ EVERY SIGN IS CALIBRATED TWICE, full size and on a GRACE NOTE, and that is not belt-and-braces.
 * Emmentaler is an optical-size family: LilyPond picks a different design of the same glyph for the
 * smaller grace context, so the small accidental's outline is a DIFFERENT string. Calibrating only
 * the full-size sign made every grace-note accidental invisible to the reader — caught on the first
 * six-piece run, where a strip drew two naturals on grace notes and the gate reported none.
 *
 * Each page carries one accidental and otherwise only glyphs every page of its set shares, so the
 * accidental is simply the outline that is NOT shared. That keeps identity coming from the font
 * rather than from any table written here.
 */
export function calibrate(lilypond: string, workDir: string): GlyphTable {
  const dir = join(workDir, "_calib");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const score = (music: string) =>
    [
      "\\score {",
      "  \\new Staff \\with { \\omit TimeSignature \\omit Clef } {",
      '    \\accidentalStyle "forget"',
      `    ${music}`,
      "  }",
      "  \\layout { }",
      "}",
    ].join("\n");

  const full = CALIBRATION_TOKENS.map((tok) => score(`\\time 1/4 c${MAKAM_SUFFIX[alterOf(tok)]}''!4`));
  const grace = CALIBRATION_TOKENS.map((tok) =>
    score(`\\time 1/4 \\slashedGrace { c${MAKAM_SUFFIX[alterOf(tok)]}''!8 } d''4`),
  );
  const src = join(dir, "calib.ly");
  writeFileSync(src, lilyDocument([...full, ...grace]));
  execFileSync(lilypond, ["-dbackend=svg", "-dno-point-and-click", "-o", join(dir, "calib"), src], {
    stdio: "pipe",
  });

  const pages = readdirSync(dir)
    .filter((f) => /^calib-\d+\.svg$/.test(f))
    .sort((a, b) => Number(/(\d+)/.exec(a)![1]) - Number(/(\d+)/.exec(b)![1]));
  if (pages.length !== CALIBRATION_TOKENS.length * 2) {
    throw new Error(`calibration: expected ${CALIBRATION_TOKENS.length * 2} pages, got ${pages.length}`);
  }
  const perPage = pages.map((f) => parseLySvg(readFileSync(join(dir, f), "utf8")).glyphs);

  const table: GlyphTable = {};
  const readSet = (setPages: Glyph[][], where: string) => {
    const counts = new Map<string, number>();
    for (const gs of setPages) for (const d of new Set(gs.map((x) => x.d))) counts.set(d, (counts.get(d) ?? 0) + 1);
    const shared = new Set([...counts].filter(([, n]) => n === setPages.length).map(([d]) => d));
    setPages.forEach((gs, i) => {
      const acc = gs.filter((g) => !shared.has(g.d));
      const tok = CALIBRATION_TOKENS[i]!;
      if (acc.length !== 1) {
        throw new Error(`calibration ${where} ${tok}: ${acc.length} candidate glyphs, expected 1`);
      }
      const d = acc[0]!.d;
      if (table[d] && table[d] !== tok) {
        throw new Error(`calibration: ${tok} has the same outline as ${table[d]}`);
      }
      table[d] = tok;
    });
  };
  readSet(perPage.slice(0, CALIBRATION_TOKENS.length), "full-size");
  readSet(perPage.slice(CALIBRATION_TOKENS.length), "grace-size");
  return table;
}

/** Every accidental LilyPond drew on this page, in reading order (left to right). */
export function accidentalsInSvg(svg: LySvg, table: GlyphTable): { token: string; x: number; y: number }[] {
  return svg.glyphs
    .filter((g) => table[g.d] !== undefined)
    .map((g) => ({ token: table[g.d]!, x: g.x, y: g.y }))
    .sort((a, b) => a.x - b.x);
}
