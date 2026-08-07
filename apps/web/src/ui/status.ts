/**
 * The status of a read, as structured state rather than a sentence.
 *
 * Why this exists: five Playwright tools (tools/browser/{app,page,build,live}-smoke.ts) need to
 * know what a read did — did it finish, did it run on the server, how many strips came back. They
 * used to learn it by regex-matching the status SENTENCE, which made the user-facing copy
 * load-bearing: rewording "read a page:" broke the deploy checks, and translating the UI broke all
 * of them at once.
 *
 * So the sentence and the facts are separated here. `text` is for the person reading the page and
 * may be reworded or translated freely; the other fields are the contract, rendered onto
 * `#omr-status` as data attributes by StatusLine and asserted on by the tools. This module is the
 * ONLY place that produces them — one definition, so the two cannot drift.
 *
 * The DOM contract, in full:
 *   #omr-status  data-state="busy|done"  data-kind="page|strips"
 *                data-phase="model|slice|decode|stitch"     (busy only)
 *                data-where="server|local|local-fallback"   (done only)
 *                data-staves data-strips data-notes data-measures data-warnings  (done only)
 */

import { makamDisplay, type MakamDetection } from "@turkish-omr/core";
import { decodeUrl, type RoutedResult } from "../omr/remote";

/** Which of the two read paths produced this — a whole page, or hand-picked strips. */
export type OmrKind = "page" | "strips";

/** Where a read had got to. `slice` covers every phase the slicer reports from omr/page.ts. */
export type OmrPhase = "model" | "slice" | "decode" | "stitch";

/**
 * Where the model actually ran. `local-fallback` is deliberately distinct from `local`: it means
 * a server was configured and did not answer, which is a different fact from having no server at
 * all, and the deploy checks assert on the difference.
 */
export type OmrWhere = "server" | "local" | "local-fallback";

export type OmrCounts = {
  staves?: number;
  strips?: number;
  notes?: number;
  measures?: number;
};

export type OmrStatus = {
  /** The sentence shown to the user. Free to reword or translate — nothing asserts on it. */
  text: string;
  state: "busy" | "done";
  kind: OmrKind;
  phase?: OmrPhase;
  where?: OmrWhere;
  counts?: OmrCounts;
  warnings?: number;
};

/** A read that is still going. */
export function busy(kind: OmrKind, phase: OmrPhase, text: string): OmrStatus {
  return { text, state: "busy", kind, phase };
}

/**
 * Progress text for a decode, which happens in one of two places (MVP W9). On the server a page is
 * ONE batched request, so there is no per-strip progress to report and pretending otherwise would
 * be a fake progress bar; in the browser the count is real.
 */
export function readingStatus(
  kind: OmrKind,
  done: number,
  total: number,
  current?: string
): OmrStatus {
  if (current === "server")
    return busy(kind, "decode", `reading ${total} strip${total > 1 ? "s" : ""} on the server…`);
  return done < total
    ? busy(kind, "decode", `reading strip ${done + 1} of ${total}…`)
    : busy(kind, "stitch", "stitching…");
}

/** Where the decode ran, as a fact. */
export function whereOf(routed: RoutedResult): OmrWhere {
  if (routed.where === "server") return "server";
  return routed.fellBackBecause ? "local-fallback" : "local";
}

/**
 * Say where the decode ran, and say it plainly when the server was meant to and did not. A friend
 * who cannot debug anything should still be able to tell us "it said it used my machine".
 */
export function whereSuffix(where: OmrWhere): string {
  if (where === "server") return " · read on the server";
  if (where === "local-fallback") return " · read on your machine (the server did not answer)";
  return decodeUrl() ? "" : " · read on your machine";
}

/**
 * What the makam guess adds to a decode's one-line summary. It belongs there because the makam
 * changes what the piece SOUNDS like, so "which one did it pick" is part of the result, not a
 * filing detail.
 */
export function makamSuffix(detected: MakamDetection): string {
  return detected.slug ? ` · makam: ${makamDisplay(detected.slug)}` : " · makam: not recognised";
}

function warnSuffix(warnings: number): string {
  return warnings ? ` — ${warnings} warning(s)` : "";
}

/** The one-line summary of a finished "read strips". */
export function stripsSummary(args: {
  strips: number;
  notes: number;
  measures: number;
  totalMs: number;
  detected: MakamDetection;
  where: OmrWhere;
  warnings: number;
}): OmrStatus {
  const { strips, notes, measures, totalMs, detected, where, warnings } = args;
  const perStrip = totalMs / strips;
  return {
    text:
      `read ${strips} strips → ${notes} notes, ${measures} measures ` +
      `in ${(totalMs / 1000).toFixed(1)} s (${perStrip.toFixed(0)} ms/strip)` +
      makamSuffix(detected) +
      whereSuffix(where) +
      warnSuffix(warnings),
    state: "done",
    kind: "strips",
    where,
    counts: { strips, notes, measures },
    warnings,
  };
}

/** The one-line summary of a finished "read a page". */
export function pageSummary(args: {
  staves: number;
  strips: number;
  notes: number;
  measures: number;
  sliceMs: number;
  skewDeg: number | null;
  decodeMs: number;
  detected: MakamDetection;
  where: OmrWhere;
  warnings: number;
}): OmrStatus {
  const { staves, strips, notes, measures, sliceMs, skewDeg, decodeMs, detected, where, warnings } =
    args;
  return {
    text:
      `read a page: ${staves} staves → ${strips} strips → ${notes} notes, ` +
      `${measures} measures — sliced in ${(sliceMs / 1000).toFixed(1)} s` +
      (skewDeg ? ` (deskewed ${skewDeg.toFixed(1)}°)` : "") +
      `, read in ${(decodeMs / 1000).toFixed(1)} s` +
      makamSuffix(detected) +
      whereSuffix(where) +
      warnSuffix(warnings),
    state: "done",
    kind: "page",
    where,
    counts: { staves, strips, notes, measures },
    warnings,
  };
}
