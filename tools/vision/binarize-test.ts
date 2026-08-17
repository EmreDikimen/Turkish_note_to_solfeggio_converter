/**
 * Node-only parity test for the two statistics the pale-staff-line fallback rests on:
 * `percentileUint8` and `medianUint8AtLeast` in `apps/web/src/omr/slicer/cvOps.ts`.
 *
 * The fallback thresholds a page relative to its PAPER level, computed as
 * `median(gray[gray >= percentile(gray, 60)])`. Python gets that from numpy; the browser gets it
 * from these two hand-written histogram routines. If they disagree by so much as half a step the
 * two sides binarize differently, and the slicer port's whole parity claim quietly stops holding
 * on exactly the degraded pages the fallback exists for.
 *
 * Every expectation below is numpy's own output for the same input (np.percentile's default
 * "linear" interpolation, np.median averaging the two middle values on an even count). Two cases
 * are load-bearing rather than decorative:
 *
 *   - `flat paper` — 253 repeated. Its 60th percentile IS its maximum, so a `>` comparison would
 *     median an EMPTY set and yield NaN. That is a bug this file exists to keep fixed: it shipped
 *     once, produced an all-zero ink mask, and read as working only because deskew's rotation pads
 *     with white and happened to supply brighter pixels.
 *   - `fractional percentile` — the interpolated case, where a naive nearest-rank implementation
 *     lands on a different value than numpy.
 *
 * Run: npx --yes tsx tools/vision/binarize-test.ts
 */

import { medianUint8AtLeast, percentileUint8 } from "../../apps/web/src/omr/slicer/cvOps";

let failures = 0;

function check(name: string, got: number, want: number) {
  // exact, not approximate: both sides are order statistics of the same bytes
  const ok = Object.is(got, want) || Math.abs(got - want) < 1e-9;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `  got ${got}, want ${want}`}`);
  if (!ok) failures++;
}

interface Case {
  name: string;
  data: number[];
  /** np.percentile(data, 60) */
  p60: number;
  /** np.median(data[data >= p60]) */
  paper: number;
}

const repeat = (v: number, n: number) => Array.from({ length: n }, () => v);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const CASES: Case[] = [
  { name: "single pixel", data: [42], p60: 42, paper: 42 },
  { name: "two pixels", data: [10, 200], p60: 124, paper: 200 },
  {
    name: "fractional percentile (0..9)",
    data: range(0, 9),
    p60: 5.3999999999999995,
    paper: 7.5,
  },
  { name: "even count (1..100)", data: range(1, 100), p60: 60.4, paper: 80.5 },
  { name: "odd count (1..101)", data: range(1, 101), p60: 61, paper: 81 },
  { name: "flat paper (253 x997)", data: repeat(253, 997), p60: 253, paper: 253 },
  {
    name: "two peaks (ink + paper)",
    data: [...repeat(4, 300), ...repeat(253, 700)],
    p60: 253,
    paper: 253,
  },
  {
    name: "one bright outlier",
    data: [...repeat(0, 999), 255],
    p60: 0,
    paper: 0,
  },
];

console.log("percentileUint8 / medianUint8AtLeast vs numpy\n");
for (const c of CASES) {
  const data = new Uint8Array(c.data);
  const p = percentileUint8(data, 60);
  check(`${c.name}: percentile 60`, p, c.p60);
  check(`${c.name}: paper level`, medianUint8AtLeast(data, p), c.paper);
}

// The regression this file is named for: the paper level must be a NUMBER on a flat page, because
// `gray < NaN` is false everywhere and silently empties the ink mask.
const flat = new Uint8Array(repeat(253, 5000));
const paper = medianUint8AtLeast(flat, percentileUint8(flat, 60));
check("flat page yields a usable paper level (not NaN)", Number.isFinite(paper) ? 1 : 0, 1);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
