/**
 * Node-only test for `whitenFrame` (`apps/web/src/omr/slicer/prepPage.ts`) — the step that paints
 * a screenshot's flat dark viewer frame white before the slicer binarizes the page.
 *
 * Two things are pinned at once:
 *
 *   - BEHAVIOUR. A page with no frame must come back as the SAME object (that is the guarantee
 *     that no scan and no photo can move), a photo-like slanted edge must be refused, and music
 *     the picture's edge cut through must not be painted.
 *   - PARITY. Every expected sha256 below is the Python `whiten_frame`'s output for the same
 *     bytes, printed by `ml/prep/frame_whiten_ref.py`, which builds these six pages the same way.
 *     If the two sides drift, the app cuts a framed screenshot differently from the Python slicer.
 *
 * Synthetic pages on purpose: the screenshot the rule was built for is someone else's engraving,
 * and this repo is public.
 *
 * Run: npx --yes tsx tools/tests/frame-test.ts
 */

import { createHash } from "node:crypto";

import { initCv, type Gray } from "../../apps/web/src/omr/slicer/cvOps";
import { whitenFrame } from "../../apps/web/src/omr/slicer/prepPage";

const W = 600;
const H = 800;

/** A white page with five 5-line staves, black lines from `x0` to `x1`. */
function page(x0 = 40, x1 = 560): Uint8Array {
  const g = new Uint8Array(W * H).fill(255);
  for (let k = 0; k < 5; k++)
    for (let i = 0; i < 5; i++)
      g.fill(
        0,
        (100 + k * 130 + 10 * i) * W + x0,
        (100 + k * 130 + 10 * i) * W + x1,
      );
  return g;
}

function rect(
  g: Uint8Array,
  y0: number,
  y1: number,
  x0: number,
  x1: number,
  v: number,
): void {
  for (let y = y0; y < y1; y++) g.fill(v, y * W + x0, y * W + x1);
}

interface Case {
  name: string;
  build: () => Uint8Array;
  /** must `whitenFrame` return the input object itself? */
  same: boolean;
  /** sha256 of Python's output — ml/prep/frame_whiten_ref.py */
  sha: string;
  /** [y, x, expected value] spot checks, so a failure says WHAT moved and not only that a hash did */
  probes: Array<[number, number, number]>;
}

const CASES: Case[] = [
  {
    name: "clean page — untouched",
    build: () => page(),
    same: true,
    sha: "ff76e137e4206e729ab192f7eba356d1c30f3f99170fc714fad838b4459a9065",
    probes: [[100, 300, 0]],
  },
  {
    name: "gray viewer frame left+right, and the gap between two pages",
    build: () => {
      const g = page();
      rect(g, 0, H, 0, 20, 53);
      rect(g, 0, H, W - 20, W, 53);
      rect(g, 380, 410, 0, W, 53);
      return g;
    },
    same: false,
    sha: "db0fd1b23165d37e2e3497923d484a0bd6fef6890c0c72a2e245c7b40eee5e40",
    probes: [
      [5, 5, 255],
      [395, 300, 255],
      [100, 300, 0],
    ],
  },
  {
    // the staff lines reach BOTH edges and are the frame's own colour: painted bars, intact lines
    name: "black bars above and below a full-bleed page — staff lines survive",
    build: () => {
      const g = page(0, W);
      rect(g, 0, 60, 0, W, 0);
      rect(g, H - 60, H, 0, W, 0);
      return g;
    },
    same: false,
    sha: "ba1bf2e0a9a4393ba79d4bf455da49e3568f83889b69f76fa9b4ca8bd8293491",
    probes: [
      [5, 5, 255],
      [100, 0, 0],
      [100, 300, 0],
    ],
  },
  {
    name: "slanted dark edge (a photo on a desk) — refused",
    build: () => {
      const g = page();
      for (let y = 0; y < H; y++)
        g.fill(40, y * W, y * W + 20 + Math.floor(y / 10));
      return g;
    },
    same: true,
    sha: "c371f5df89811b37f191dd163c350a1b27810372705ab2cf3618a079c46aa817",
    probes: [[5, 5, 40]],
  },
  {
    name: "1 px window-edge line down one side (a desktop screenshot)",
    build: () => {
      const g = page();
      rect(g, 0, H, W - 1, W, 14);
      return g;
    },
    same: false,
    sha: "ff76e137e4206e729ab192f7eba356d1c30f3f99170fc714fad838b4459a9065",
    probes: [[400, W - 1, 255]],
  },
  {
    name: "ink the top edge cut through — not a frame, not painted",
    build: () => {
      const g = page();
      rect(g, 0, 30, 200, 230, 0);
      return g;
    },
    same: true,
    sha: "d4f1ee1055d8061bd0d5a31d67e554ace9cf5d9afe968d05f9dca93e62217162",
    probes: [[10, 210, 0]],
  },
];

async function main() {
  await initCv();
  let failures = 0;
  for (const c of CASES) {
    const gray: Gray = { data: c.build(), width: W, height: H };
    const out = whitenFrame(gray);
    const problems: string[] = [];
    if ((out === gray) !== c.same)
      problems.push(c.same ? "page was touched" : "page was NOT touched");
    const sha = createHash("sha256").update(out.data).digest("hex");
    if (sha !== c.sha) problems.push("bytes differ from Python's whiten_frame");
    for (const [y, x, want] of c.probes) {
      const got = out.data[y * W + x];
      if (got !== want)
        problems.push(`pixel (y ${y}, x ${x}) is ${got}, want ${want}`);
    }
    console.log(
      `  ${problems.length ? "FAIL" : "ok  "}  ${c.name}${problems.map((p) => `\n          ${p}`).join("")}`,
    );
    if (problems.length) failures++;
  }
  if (failures) {
    console.error(`\n${failures} frame case(s) failed`);
    process.exit(1);
  }
  console.log("\nframe: all cases match Python");
  process.exit(0);
}

main();
