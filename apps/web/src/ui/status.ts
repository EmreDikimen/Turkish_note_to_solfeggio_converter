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
import { num, TR } from "./strings";

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
  // "waking" is the cold-container wait (omr/remote.ts). Still `decode` as a phase — the read is
  // under way from the user's point of view — but a distinct sentence, because a silent 10 s pause
  // before any progress reads as a hang. ⚠ Static text, no ticking clock: `page-smoke` counts
  // DISTINCT status texts to prove progress moved, so a countdown here would forge that signal.
  if (current === "waking") return busy(kind, "decode", TR.status.wakingServer);
  if (current === "server") return busy(kind, "decode", TR.status.readingOnServer(total));
  return done < total
    ? busy(kind, "decode", TR.status.readingStrip(done + 1, total))
    : busy(kind, "stitch", TR.status.stitching);
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
  if (where === "server") return TR.status.onServer;
  if (where === "local-fallback") return TR.status.onDeviceFallback;
  return decodeUrl() ? "" : TR.status.onDevice;
}

/**
 * What the makam guess adds to a decode's one-line summary. It belongs there because the makam
 * changes what the piece SOUNDS like, so "which one did it pick" is part of the result, not a
 * filing detail.
 */
export function makamSuffix(detected: MakamDetection): string {
  return detected.slug ? TR.status.makam(makamDisplay(detected.slug)) : TR.status.makamUnknown;
}

function warnSuffix(warnings: number): string {
  return warnings ? TR.status.warnings(warnings) : "";
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
  return {
    text:
      TR.status.stripsDone(
        strips,
        notes,
        measures,
        num(totalMs / 1000),
        (totalMs / strips).toFixed(0)
      ) +
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
      TR.status.pageDone(
        staves,
        strips,
        notes,
        measures,
        num(sliceMs / 1000),
        num(decodeMs / 1000)
      ) +
      (skewDeg ? TR.status.deskewed(num(skewDeg)) : "") +
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
