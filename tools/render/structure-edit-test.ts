/**
 * Sign editing verification (Node-only) for `tools/render/structure-edit.ts`.
 *
 * The editor lets a person put `‖:` `:‖` 1./2. 𝄋 ⊕ "D.C." "Son" on a page and take them off again.
 * Two things have to hold or the staff and the sound come apart:
 *
 *  1. a placement that would DRAW one thing and SOUND another is REFUSED — and the refusal comes
 *     from re-resolving the page, not from a second copy of the decoder's rules;
 *  2. what survives an edit is the PLAYING ORDER: `playBars` after adding a `:‖` is the order the
 *     stitcher would have produced from the same signs read off a photograph.
 *
 * ⚠ Every expectation here is a `playBars` list, never a flag dump. A flag that is set and does
 * nothing is exactly the bug this file exists to catch.
 *
 * Run: npx --yes tsx tools/render/structure-edit-test.ts
 */

import { resolveStructure, type ScoreStructure } from "./stitch";
import { emptyStructure, markTargets, openRepeatBar, placeMark, placeRepeat, removeMark } from "./structure-edit";

let failures = 0;

function check(name: string, got: string, want: string) {
  if (got === want) {
    console.log(`  ok    ${name}  ${got}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}\n    want: ${want}\n    got : ${got}`);
  }
}

const play = (s: ScoreStructure) => s.playBars.join(" ");

/** Place a whole repeat, asserting it lands. */
function rep(s: ScoreStructure | null, n: number, from: number, to: number): ScoreStructure {
  const r = placeRepeat(s, n, from, to);
  if (!r.ok) throw new Error(`repeat ${from}→${to} was refused: ${r.reason}`);
  return r.structure;
}

/** Place a chain of marks, asserting each one lands. Returns the structure after all of them. */
function place(s: ScoreStructure | null, n: number, ...steps: [number, Parameters<typeof placeMark>[3]][]): ScoreStructure {
  let cur = s;
  for (const [bar, mark] of steps) {
    const r = placeMark(cur, n, bar, mark);
    if (!r.ok) throw new Error(`placing ${mark} on bar ${bar} was refused: ${r.reason}`);
    cur = r.structure;
  }
  return cur!;
}

console.log("an empty page");
{
  const s = emptyStructure(8);
  check("plays straight through", play(s), "1 2 3 4 5 6 7 8");
  check("and offers nothing to delete", String(markTargets(s, 8).length), "0");
}

console.log("\nthe repeat — placed as ONE object, two clicks on the barlines");
{
  // ⭐ Both signs land together (owner, 2026-09-03), so the document never holds half a repeat.
  const s = rep(emptyStructure(6), 6, 2, 4);
  check("‖: at 2 and :‖ at 4 play the span twice", play(s), "1 2 3 4 2 3 4 5 6");
  check("…and both ends offer a delete target", markTargets(s, 6).map((t) => `${t.mark}@${t.bar}`).sort().join(" "), "repEnd@4 repStart@2");
  check("nothing is left unfinished", String(openRepeatBar(s, 6)), "null");

  // A one-bar repeat is legal: that bar simply plays twice. The two clicks are on DIFFERENT lines
  // (a bar's opening line and its closing line), so this is not the "clicked twice" ambiguity.
  check("a one-bar repeat plays its bar twice", play(rep(emptyStructure(6), 6, 3, 3)), "1 2 3 3 4 5 6");

  // Backwards cannot be expressed. The sheet dims those barlines, so this is a mis-click.
  const back = placeRepeat(emptyStructure(6), 6, 5, 2);
  check("closing before the opening is refused", back.ok ? "accepted" : back.reason, "backwards");

  const nested = placeRepeat(s, 6, 3, 5);
  check("a repeat that opens inside an open one is refused", nested.ok ? "accepted" : nested.reason, "conflict");

  // ⚠ An unmatched `‖:` can still arrive — from a DECODE, never from the editor now. It draws
  // nothing on the staff, so edit mode has to find it and offer it for deletion.
  const stray = resolveStructure([{ bar: 3, repStart: true }], 6).structure;
  check("a decoded stray ‖: leaves the music alone", play(stray), "1 2 3 4 5 6");
  check("…and is found so the sheet can draw it dashed", String(openRepeatBar(stray, 6)), "3");
  check("…and is NOT offered as a delete chip", String(markTargets(stray, 6).length), "0");
}

console.log("\nthe volta pair");
{
  const s = rep(emptyStructure(8), 8, 2, 5);
  check("before the brackets", play(s), "1 2 3 4 5 2 3 4 5 6 7 8");

  // One click sets BOTH brackets: "1." where it landed, "2." on the bar after the `:‖`.
  const v = place(s, 8, [5, "volta"]);
  check("the second pass skips the first ending", play(v), "1 2 3 4 5 2 3 4 6 7 8");
  const flags = v.bars.filter((b) => b.volta1 || b.volta2).map((b) => `${b.bar}${b.volta1 ? "①" : "②"}`);
  check("…and one click drew both brackets", flags.join(" "), "5① 6②");

  // A first ending is a RUN: opening it a bar earlier skips both bars, not just the `:‖`.
  const two = place(s, 8, [4, "volta"]);
  check("a two-bar first ending skips both bars", play(two), "1 2 3 4 5 2 3 6 7 8");
  check("…and only ONE 1. bracket is left", two.bars.filter((b) => b.volta1).map((b) => b.bar).join(","), "4");

  // Past MAX_FIRST_ENDING the decoder ignores a "1.", so the editor must not offer to place one.
  const far = rep(emptyStructure(12), 12, 1, 10);
  check("a 1. too far from its :‖ is refused", (() => { const r = placeMark(far, 12, 2, "volta"); return r.ok ? "accepted" : r.reason; })(), "voltaFar");

  const outside = placeMark(s, 8, 7, "volta");
  check("a volta outside any repeat is refused", outside.ok ? "accepted" : outside.reason, "voltaOutside");

  const noRoom = rep(emptyStructure(4), 4, 1, 4);
  check("a volta with no bar left for the 2. is refused", (() => { const r = placeMark(noRoom, 4, 4, "volta"); return r.ok ? "accepted" : r.reason; })(), "voltaLast");
}

console.log("\ndeleting takes the whole object");
{
  const s = place(rep(emptyStructure(8), 8, 2, 5), 8, [5, "volta"]);
  const gone = removeMark(s, 8, 5, "repEnd");
  check("deleting the :‖ plays the page straight", play(gone), "1 2 3 4 5 6 7 8");
  check("…and leaves no orphan ‖: or bracket behind", String(gone.bars.length), "0");

  // Either bracket clears the pair — the "2." sits a bar PAST the `:‖`, so it has to look back.
  const noVolta = removeMark(s, 8, 6, "volta");
  check("deleting the 2. clears the pair", play(noVolta), "1 2 3 4 5 2 3 4 5 6 7 8");
  check("…and the repeat itself survives it", noVolta.bars.filter((b) => b.repEnd).map((b) => b.bar).join(","), "5");

  // ⭐ EITHER end deletes the whole repeat, now that it is placed as one object.
  const fromStart = removeMark(s, 8, 2, "repStart");
  check("deleting the ‖: takes the repeat too", play(fromStart), "1 2 3 4 5 6 7 8");
  check("…leaving nothing behind either", String(fromStart.bars.length), "0");
}

console.log("\nthe navigation signs");
{
  // The FIRST 𝄋 marks a section; a later one plays it again and comes back. The section needs an
  // end the page states — here the "Son".
  const s = place(emptyStructure(8), 8, [3, "segno"], [5, "fine"], [7, "segno"]);
  check("a second 𝄋 replays the section and returns", play(s), "1 2 3 4 5 6 7 3 4 5 8");
  const edges = s.bars.filter((b) => b.segno).map((b) => `${b.bar}:${b.segnoAt}`).join(" ");
  check("…the first 𝄋 opens a bar, the later one closes one", edges, "3:start 7:end");

  // With nothing saying where the section ends, the jump is ignored — so the placement is refused
  // rather than drawing a sign that does nothing.
  const open = place(emptyStructure(8), 8, [3, "segno"]);
  const second = placeMark(open, 8, 6, "segno");
  check("a 𝄋 with no end to its section is refused", second.ok ? "accepted" : second.reason, "conflict");

  // Deleting the first 𝄋 promotes the next one, which must move to its bar's head.
  const promoted = removeMark(s, 8, 3, "segno");
  check("deleting the first 𝄋 promotes the next", promoted.bars.filter((b) => b.segno).map((b) => `${b.bar}:${b.segnoAt}`).join(" "), "7:start");

  // ⊕ is a pair and only a pair.
  const coda = place(emptyStructure(8), 8, [4, "coda"], [7, "coda"]);
  check("two ⊕ take their reading order", coda.bars.filter((b) => b.codaOrder != null).map((b) => `${b.bar}=${b.codaOrder}`).join(" "), "4=0 7=1");
  const third = placeMark(coda, 8, 6, "coda");
  check("a third ⊕ is refused", third.ok ? "accepted" : third.reason, "codaFull");

  // A "D.C." only means anything at the end of the written score.
  const dcMid = placeMark(emptyStructure(8), 8, 3, "dc");
  check("a D.C. mid-piece is refused", dcMid.ok ? "accepted" : dcMid.reason, "conflict");
  const dcEnd = place(emptyStructure(8), 8, [8, "dc"]);
  check("a D.C. at the end replays the score", play(dcEnd), "1 2 3 4 5 6 7 8 1 2 3 4 5 6 7 8");
}

console.log("\nsigns can never outlive their bars");
{
  const s = rep(emptyStructure(8), 8, 2, 6);
  // The document shrinks under the signs (the user deleted the last bars). A `:‖` that named bar 6
  // must be DROPPED, never re-pointed at whatever bar 6 is now.
  const shrunk = resolveStructure(s.bars, 4).structure;
  check("a sign past the end of the score is dropped", play(shrunk), "1 2 3 4");
  check("…and does not come back as a flag", shrunk.bars.filter((b) => b.repEnd).length.toString(), "0");
}

console.log("\nan edit is resolved by the DECODER's own code");
{
  // The whole design claim in one line: hand-placed signs and decoded signs go through the same
  // three expanders, so the same marks must give the same playing order either way.
  const edited = place(rep(emptyStructure(8), 8, 2, 5), 8, [5, "volta"]);
  const asDecoded = resolveStructure(edited.bars, 8).structure;
  check("editing and decoding agree", play(edited), play(asDecoded));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
