/**
 * Does the sheet editor actually edit? — select a note, drag its pitch, delete it, undo, redo, arm
 * a palette tool and apply it, and play from the bar you just fixed.
 *
 * Drives the REAL app on the bundled sample. Like the other smokes it asserts on `data-*` and on
 * the saved document, never on the Turkish copy: `#edit-toggle[data-edit-mode]`,
 * `[data-omr-note]` / `[data-selected]`, `[data-selected-note]` on the sheet container,
 * `#note-delete` / `#undo` / `#redo`, and `#edit-palette[data-armed]` / `[data-play-from]`.
 *
 * The checks that matter most, because each one is a bug this slice fixed or nearly shipped:
 *  - a pitch edit moves `noteName`, not just `koma53` — the sheet reads noteName for its notehead,
 *    so an edit that moves only the koma moves the sound and leaves the notehead behind;
 *  - dragging moves the note EXACTLY as far as the pointer, and the page does not scroll with it;
 *  - one drag is one undo entry, not one per step;
 *  - every palette tool arms ITSELF, and its glyph stays inside its own button;
 *  - the palette's Çal starts where the last edit was — measured off the PLAYHEAD's position down
 *    the sheet, because an attribute naming a bar cannot prove the audio began there.
 *
 *   npx tsx tools/browser/editor-smoke.ts
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { groupMeasures, measureOfEvent, type NoteModelDocument } from "@turkish-omr/core";
import { tupletRunFrom } from "../render/rhythm";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB_ROOT = path.join(ROOT, "apps/web");

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want);
  if (g === w) console.log(`  ok    ${name}  ${g}`);
  else { failures++; console.log(`  FAIL  ${name}\n    want: ${w}\n    got : ${g}`); }
}

interface Ev {
  index: number;
  kind: string;
  noteName: string;
  koma53: number;
  durationMs: number;
  durationBeats: { num: number; den: number };
}
interface Doc { events: Ev[] }

async function main() {
  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  const save = async (): Promise<Doc> => {
    const dl = page.waitForEvent("download", { timeout: 30000 });
    await page.locator("#save-json").click();
    return JSON.parse(readFileSync((await (await dl).path())!, "utf8")) as Doc;
  };

  /** Park the pointer over a note and return its box.
   *  ⚠ Scroll it into view AND re-read the box every time. `save()` clicks a button in the card
   *  header, and Playwright scrolls that into view — which pushes the sheet off-screen. A box
   *  captured before then is stale, and worse, the note may be outside the viewport entirely, so
   *  `mouse.move` puts the cursor off-page and no pointer event reaches it at all. That failure
   *  looks exactly like "dragging doesn't work", which already cost one debugging round. */
  const hoverNote = async (index: number) => {
    const el = page.locator(`[data-omr-note="${index}"]`).first();
    await el.scrollIntoViewIfNeeded();
    const b = (await el.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-omr-note") ?? "none",
      { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    );
    if (hit !== String(index)) throw new Error(`pointer is over "${hit}", not note ${index}`);
    return b;
  };

  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });

  const before = await save();
  const notesBefore = before.events.filter((e) => e.kind === "note").length;
  console.log(`sample loaded: ${before.events.length} events, ${notesBefore} notes\n`);

  // --- enter edit mode
  await page.locator("#edit-toggle").click();
  check("edit-toggle reports on", await page.locator("#edit-toggle").getAttribute("data-edit-mode"), "on");
  const boxes = page.locator("[data-omr-note]");
  const nBoxes = await boxes.count();
  check("note boxes exist", nBoxes > 100, "true");
  // The one point in this run where nothing has been edited yet, so the only place the palette's
  // "no bar to play from" state can honestly be checked (it survives undo on purpose — see the
  // transport section at the bottom).
  check(
    "a freshly loaded score names no bar to play from",
    await page.locator("#edit-palette").getAttribute("data-play-from"),
    null,
  );

  // --- select a note that CARRIES AN ACCIDENTAL, so "the accidental is carried" below is a real
  // assertion rather than an empty-suffix tautology.
  const suffix = (n: string) => n.match(/([#b]\d+)$/)?.[1] ?? "";
  const altered = new Set(before.events.filter((e) => suffix(e.noteName) !== "").map((e) => e.index));
  check("the sample has altered notes to test with", altered.size > 0, true);
  let target = boxes.nth(0);
  let evIndex = 0;
  for (let i = 0; i < nBoxes; i++) {
    const idx = Number(await boxes.nth(i).getAttribute("data-omr-note"));
    if (altered.has(idx)) { target = boxes.nth(i); evIndex = idx; break; }
  }
  check("found an altered note on the sheet", evIndex > 0, true);
  await target.click({ force: true });
  const sel = await page.locator("#sheet-surface").getAttribute("data-selected-note");
  check("selection recorded on the container", sel, String(evIndex));
  check("selected box is marked", await page.locator(`[data-omr-note="${evIndex}"][data-selected]`).count() >= 1, "true");
  check("the ✕ appeared", await page.locator("#note-delete").count(), 1);
  check("undo is still disabled (nothing edited yet)", await page.locator("#undo").isDisabled(), true);

  const orig = before.events.find((e) => e.index === evIndex)!;
  console.log(`\nselected event ${evIndex}: ${orig.noteName} (koma ${orig.koma53})\n`);

  // --- a plain click selects and must NOT move the pitch
  check("clicking a note leaves its pitch alone", (await save()).events.find((e) => e.index === evIndex)!.koma53, orig.koma53);

  // --- drag it UP three diatonic steps. One step is half a staff space (5 px).
  const dragSteps = async (steps: number) => {
    const b = await hoverNote(evIndex);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - steps * 5, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    // Read scroll NOW: `save()` clicks a header button and Playwright scrolls it into view, which
    // would swamp the thing being measured.
    return { scrollBefore, scrollAfter: await page.evaluate(() => window.scrollY) };
  };

  const { scrollBefore, scrollAfter } = await dragSteps(3);
  const afterDrag = await save();
  const moved = afterDrag.events.find((e) => e.index === evIndex)!;
  console.log(`after dragging up 3 steps: ${moved.noteName} (koma ${moved.koma53})`);
  check("the note's NAME moved (the sheet reads this)", moved.noteName !== orig.noteName, true);
  check("the note's koma moved up", moved.koma53 > orig.koma53, true);
  check("the page did not scroll during the drag", scrollAfter, scrollBefore);
  check("undo is not disabled", await page.locator("#undo").isDisabled(), false);

  // The staff position moved; the alteration rode along with it.
  check("the accidental was carried", suffix(moved.noteName), suffix(orig.noteName));

  // Three diatonic steps up from the original spelling — exactly, not "somewhere higher". The
  // letters wrap C..B, so compare the letter that is 3 places along.
  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const letterOf = (n: string) =>
    ({ Do: "C", Re: "D", Mi: "E", Fa: "F", Sol: "G", La: "A", Si: "B" })[n.match(/^(Do|Re|Mi|Fa|Sol|La|Si)/)?.[1] ?? ""] ?? "?";
  check(
    "it moved exactly three staff steps",
    letterOf(moved.noteName),
    LETTERS[(LETTERS.indexOf(letterOf(orig.noteName)) + 3) % 7],
  );

  // --- one DRAG is one undo entry, not one per step (the coalescing in useDocHistory)
  await page.locator("#undo").click();
  await page.waitForTimeout(300);
  check(
    "one undo reverses the whole drag",
    (await save()).events.find((e) => e.index === evIndex)!.koma53,
    orig.koma53,
  );
  await page.locator("#redo").click();
  await page.waitForTimeout(300);

  // Put it back so the delete/undo assertions below still compare against `before`.
  const rewind = page.locator("#undo");
  while (!(await rewind.isDisabled())) { await rewind.click(); await page.waitForTimeout(120); }
  check("rewound to the original before the delete checks", JSON.stringify(await save()) === JSON.stringify(before), true);
  await page.locator(`[data-omr-note="${evIndex}"]`).first().click({ force: true });
  await dragSteps(3);

  // --- delete it
  await page.locator(`[data-omr-note="${evIndex}"]`).first().click({ force: true });
  await page.locator("#note-delete").click();
  await page.waitForTimeout(300);
  const afterDelete = await save();
  check("one event fewer", afterDelete.events.length, before.events.length - 1);
  check("indices stay contiguous", afterDelete.events.every((e, i) => e.index === i + 1), true);
  check("selection cleared after delete", await page.locator("#note-delete").count(), 0);

  // --- undo twice → back to the original
  await page.locator("#undo").click();
  await page.waitForTimeout(200);
  await page.locator("#undo").click();
  await page.waitForTimeout(300);
  const undone = await save();
  check("undo restores the exact original doc", JSON.stringify(undone) === JSON.stringify(before), true);
  check("undo is disabled again at the bottom of the stack", await page.locator("#undo").isDisabled(), true);
  check("redo is not disabled", await page.locator("#redo").isDisabled(), false);

  // --- redo once → the wheel edit is back
  await page.locator("#redo").click();
  await page.waitForTimeout(300);
  const redone = await save();
  check("redo reapplies the pitch edit", redone.events.find((e) => e.index === evIndex)!.noteName, moved.noteName);

  // --- the palette (step 4): arm a tool, click a note, the note changes ------------------------
  //
  // Every assertion here is on `data-tool` / `data-armed` and on the saved document — never on the
  // Turkish labels, so the copy stays free to change.
  console.log("\npalette");

  const rewindAll = async () => {
    const u = page.locator("#undo");
    while (!(await u.isDisabled())) { await u.click(); await page.waitForTimeout(120); }
  };
  await rewindAll();

  const palette = page.locator("#edit-palette");
  check("the palette is present in edit mode", await palette.count(), 1);
  check("nothing is armed to begin with", await palette.getAttribute("data-armed"), null);

  const arm = async (id: string) => {
    await page.locator(`#edit-palette [data-tool="${id}"]`).click();
    check(`armed ${id}`, await palette.getAttribute("data-armed"), id);
  };

  // EVERY tool must arm ITSELF. This is not paranoia: a Bravura glyph paints outside its em box, so
  // one tool's ink covered its neighbour and clicking 1/8 armed 1/32 — and it hit only some of the
  // buttons, so checking one would have missed it.
  {
    const ids = await page
      .locator("#edit-palette [data-tool]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-tool")!));
    const wrong: string[] = [];
    for (const id of ids) {
      await page.locator(`#edit-palette [data-tool="${id}"]`).click();
      const got = (await palette.getAttribute("data-armed")) ?? "none";
      if (got !== id) wrong.push(`${id}→${got}`);
      if (id !== "none") await page.keyboard.press("Escape");
    }
    check(`all ${ids.length} tools arm themselves`, wrong.length ? wrong.join(" ") : "none", "none");
  }

  // Every glyph must sit INSIDE its button. A music glyph's ink is nowhere near its baseline — a
  // stemmed note draws ~88 units up and 14 down — so ordinary centring pushed the stems out through
  // the top of the button. `EditPalette`'s INK table shifts each glyph onto its own ink; this
  // measures the result the way an eye does, against the real font.
  {
    const over = await page.evaluate(async () => {
      await (document as { fonts?: { ready: Promise<unknown> } }).fonts!.ready;
      const c = document.createElement("canvas").getContext("2d")!;
      return Array.from(document.querySelectorAll<HTMLElement>("#edit-palette .kv-tool .kv-glyph"))
        .map((g) => {
          const btn = g.closest(".kv-tool") as HTMLElement;
          const b = btn.getBoundingClientRect();
          const s = g.getBoundingClientRect(); // line-height 0 → the span's top IS the baseline
          const cs = getComputedStyle(g);
          c.font = `${cs.fontSize} ${cs.fontFamily}`;
          const m = c.measureText(g.textContent!);
          const top = b.top - (s.top - m.actualBoundingBoxAscent);
          const bottom = s.top + m.actualBoundingBoxDescent - b.bottom;
          return { tool: btn.getAttribute("data-tool"), top, bottom };
        })
        .filter((r) => r.top > 0 || r.bottom > 0)
        .map((r) => `${r.tool}(${r.top.toFixed(1)}/${r.bottom.toFixed(1)})`);
    });
    check("every glyph fits inside its button", over.length ? over.join(" ") : "none", "none");
  }
  const clickNote = async (index: number) => {
    await page.locator(`[data-omr-note="${index}"]`).first().click({ force: true });
    await page.waitForTimeout(250);
  };

  // A note whose value is NOT already 1/8, so the duration assertion cannot pass by accident.
  const onSheet = new Set(
    await page.locator("[data-omr-note]").evaluateAll((els) =>
      els.map((el) => Number(el.getAttribute("data-omr-note"))),
    ),
  );
  const durTarget = before.events.find(
    (e) => e.kind === "note" && onSheet.has(e.index) && e.durationBeats.den !== 8,
  )!;
  check("found a note that is not already 1/8", durTarget != null, true);

  await arm("dur:1/8");
  await clickNote(durTarget.index);
  {
    const ev = (await save()).events.find((e) => e.index === durTarget.index)!;
    console.log(
      `  note ${durTarget.index}: ${durTarget.durationBeats.num}/${durTarget.durationBeats.den}` +
        ` (${durTarget.durationMs} ms) → ${ev.durationBeats.num}/${ev.durationBeats.den} (${ev.durationMs} ms)`,
    );
    check("the note value is now 1/8", `${ev.durationBeats.num}/${ev.durationBeats.den}`, "1/8");
    // durationMs must follow durationBeats — the sheet engraves the beats and playback reads the
    // ms, and an edit that moves one without the other is the bug edits.ts exists to prevent.
    const wantRatio = 1 / 8 / (durTarget.durationBeats.num / durTarget.durationBeats.den);
    const gotRatio = ev.durationMs / durTarget.durationMs;
    check("durationMs followed the beats", Math.abs(gotRatio - wantRatio) < 0.05 * wantRatio, true);
    check("the armed click did NOT move the pitch", ev.noteName, durTarget.noteName);
  }

  // One armed click is one undo entry.
  await page.locator("#undo").click();
  await page.waitForTimeout(250);
  check(
    "one undo reverses the whole tool click",
    JSON.stringify((await save()).events.find((e) => e.index === durTarget.index)),
    JSON.stringify(durTarget),
  );

  // Esc disarms — the way back to plain selection without hunting for a button.
  await page.keyboard.press("Escape");
  check("Esc disarms", await palette.getAttribute("data-armed"), null);

  // The accidental tool, on a note that carries NO alteration, so the change is unambiguous.
  const accTarget = before.events.find(
    (e) => e.kind === "note" && onSheet.has(e.index) && suffix(e.noteName) === "",
  )!;
  check("found an unaltered note", accTarget != null, true);
  await arm("acc:-1");
  await clickNote(accTarget.index);
  {
    const ev = (await save()).events.find((e) => e.index === accTarget.index)!;
    console.log(`  note ${accTarget.index}: ${accTarget.noteName} → ${ev.noteName} (koma ${accTarget.koma53} → ${ev.koma53})`);
    check("a koma-flat was applied", suffix(ev.noteName), "b1");
    check("the sounding koma dropped by one", accTarget.koma53 - ev.koma53, 1);
    check("the staff position did not move", ev.noteName.replace(/[#b]\d+$/, ""), accTarget.noteName);
    check("the duration was left alone", ev.durationMs, accTarget.durationMs);
  }

  // Applying the same accidental again changes nothing, and must not become an undo entry.
  await clickNote(accTarget.index);
  check("re-applying the same accidental is not a new undo entry", JSON.stringify((await save()).events.find((e) => e.index === accTarget.index)!.noteName), JSON.stringify(`${accTarget.noteName}b1`));
  await page.locator("#undo").click();
  await page.waitForTimeout(250);
  check(
    "one undo takes the accidental back off",
    (await save()).events.find((e) => e.index === accTarget.index)!.noteName,
    accTarget.noteName,
  );

  // --- the palette's transport (step 5): Çal plays from the LAST EDITED BAR --------------------
  //
  // The attribute (`data-play-from`) says which bar Çal aims at; it cannot say that the audio
  // actually began there. So the real assertion is on the PLAYHEAD's position down the sheet —
  // that reads `startMs`, which is the seek this whole step exists to get right.
  console.log("\npalette transport");

  await rewindAll();
  await page.keyboard.press("Escape"); // leave nothing armed from the section above

  check("Çal is in the palette", await page.locator("#palette-play").count(), 1);
  check("Dur is in the palette", await page.locator("#palette-stop").count(), 1);
  check("Dur is disabled while stopped", await page.locator("#palette-stop").isDisabled(), true);
  // The sections above edited bar 1, and `rewindAll` undoes the DOCUMENT without moving the
  // remembered bar (deliberate — pinned at the end of this section). So this is the control arm:
  // Çal aimed at bar 1 must start at the top of the sheet.
  check("the remembered bar is bar 1 here", await palette.getAttribute("data-play-from"), "1");

  /** How far down `#sheet-surface` the playhead is sitting, 0 = top of the score, 1 = bottom.
   *  Null while it is hidden (i.e. not playing). */
  const playheadFraction = async (): Promise<number | null> =>
    page.evaluate(() => {
      const ph = document.querySelector<HTMLElement>('[data-omr="playhead"]');
      const surface = document.querySelector<HTMLElement>("#sheet-surface");
      if (!ph || !surface || ph.style.display === "none") return null;
      const p = ph.getBoundingClientRect();
      const s = surface.getBoundingClientRect();
      return (p.top - s.top) / s.height;
    });

  /** Wait for the playhead to actually appear, and answer where it is.
   *  ⚠ Not a fixed sleep: the FIRST Çal of a run also starts the WebAudio context, which in headless
   *  Chromium can take over a second — the playhead is hidden until the clock returns a position, so
   *  a 300 ms wait read "hidden" and looked exactly like "the seek is broken". Later Çals are warm
   *  and return on the first poll. */
  const waitForPlayhead = async (): Promise<number | null> => {
    for (let i = 0; i < 40; i++) {
      const f = await playheadFraction();
      if (f != null) return f;
      await page.waitForTimeout(100);
    }
    return null;
  };

  // With nothing edited, Çal is just "play from the top".
  await page.locator("#palette-play").click();
  await page.waitForTimeout(300);
  check("Çal starts playback", await page.locator("#palette-play").getAttribute("data-play-state"), "playing");
  // One state, two buttons — the transport above is still on screen in edit mode.
  check("the transport button agrees", await page.locator("#play").getAttribute("data-play-state"), "playing");
  const topFrac = await waitForPlayhead();
  console.log(`  playhead aimed at bar 1: ${topFrac?.toFixed(3) ?? "hidden"} down the sheet`);
  check("a bar-1 target plays from the top of the sheet", topFrac != null && topFrac < 0.2, true);

  await page.locator("#palette-stop").click();
  await page.waitForTimeout(200);
  check("Dur stops it", await page.locator("#palette-play").getAttribute("data-play-state"), "stopped");
  check("the transport agrees again", await page.locator("#play").getAttribute("data-play-state"), "stopped");
  check("the playhead is gone", await playheadFraction(), null);

  // Now edit a note in the LAST system, so "it started at the edited bar" and "it started at the
  // top" cannot look the same. Skip notes already valued 1/8 — those apply as a no-op, which would
  // leave nothing on the undo stack for the last check.
  const notAlreadyEighth = before.events
    .filter((e) => e.kind === "note" && e.durationBeats.den !== 8)
    .map((e) => e.index);
  const lateIndex = await page.locator("[data-omr-note]").evaluateAll((els, ok: number[]) => {
    const allowed = new Set(ok);
    let best = -1;
    let bestY = -Infinity;
    for (const el of els) {
      const idx = Number(el.getAttribute("data-omr-note"));
      if (!allowed.has(idx)) continue;
      const y = el.getBoundingClientRect().top; // one instant, one scroll frame → comparable
      if (y > bestY) { bestY = y; best = idx; }
    }
    return best;
  }, notAlreadyEighth);
  check("found an editable note in the last system", lateIndex > 0, true);

  const wantMeasure = measureOfEvent(before as unknown as NoteModelDocument, lateIndex);
  console.log(`  editing event ${lateIndex}, which is in bar ${wantMeasure}`);
  check("that note is well past bar 1", wantMeasure != null && wantMeasure > 1, true);

  await arm("dur:1/8");
  await clickNote(lateIndex);
  check("the edit named its bar", await palette.getAttribute("data-play-from"), String(wantMeasure));
  await page.keyboard.press("Escape");

  await page.locator("#palette-play").click();
  await page.waitForTimeout(300);
  const lateFrac = await waitForPlayhead();
  console.log(`  playhead after editing bar ${wantMeasure}: ${lateFrac?.toFixed(3) ?? "hidden"} down the sheet`);
  check("Çal starts at the edited bar, not the top", lateFrac != null && lateFrac > 0.5, true);
  check("...which is further down than the top-of-score start", (lateFrac ?? 0) > (topFrac ?? 1), true);

  // Pressing Çal again mid-playback replays the same bar — that is the fix-and-listen loop.
  await page.locator("#palette-play").click();
  await page.waitForTimeout(300);
  const replayFrac = await waitForPlayhead();
  check("pressing Çal again replays the same bar", replayFrac != null && replayFrac > 0.5, true);
  check("it is still playing", await page.locator("#palette-play").getAttribute("data-play-state"), "playing");

  // Undo does NOT move the remembered bar: the bar you were working in is still the bar you want
  // to hear. Deliberate (editor.md), so it is pinned rather than left to drift.
  await page.locator("#palette-stop").click();
  await page.locator("#undo").click();
  await page.waitForTimeout(250);
  check("undo leaves the remembered bar alone", await palette.getAttribute("data-play-from"), String(wantMeasure));
  check("...and the edit itself was undone", (await save()).events.find((e) => e.index === lateIndex)!.durationBeats.den, before.events.find((e) => e.index === lateIndex)!.durationBeats.den);

  // --- insert on empty space (step 6) ----------------------------------------------------------
  //
  // Arm a note value, click blank staff, get a note there. The pitch comes from the click's HEIGHT,
  // which is the part that could be silently wrong — so the check is against the ghost's own
  // `data-insert-pitch` rather than against a pixel expectation computed here: the preview and the
  // insert must come out of one mapping, and if they ever stop agreeing this fails.
  console.log("\ninsert on empty space");

  await rewindAll();
  await page.keyboard.press("Escape");

  const beforeInsert = await save();
  const barsOf = (d: Doc) => groupMeasures(d as unknown as NoteModelDocument).length;
  const barsBefore = barsOf(beforeInsert);

  /** A point on blank staff: the middle of the horizontal gap between two side-by-side notes, at
   *  the vertical middle of the staff. Rejects any point that is actually over a note box — that
   *  would arm the wrong path entirely and the failure would read as "insert does nothing".
   *
   *  ⚠ Re-run before EVERY click, never cached. `save()` and the undo/redo buttons live in the card
   *  header, and Playwright scrolls whatever it clicks into view — which moves the sheet under a
   *  coordinate captured earlier. That is the same trap `hoverNote` documents above.
   *  ⚠ And it scrolls the sheet in FIRST: a point above the viewport is not clickable at all, and
   *  `elementFromPoint` answers null there — which reads exactly like "the ghost is broken". */
  const findGap = async () => await page.evaluate(() => {
    document.querySelector("#sheet-surface")!.scrollIntoView({ block: "start" });
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-omr-note]"));
    const seen = new Set<string>();
    const rects = els
      .map((el) => ({ idx: Number(el.getAttribute("data-omr-note")), r: el.getBoundingClientRect() }))
      .filter((b) => (seen.has(`${b.idx}`) ? false : (seen.add(`${b.idx}`), true))) // tie split: first box
      .sort((a, b) => (Math.abs(a.r.top - b.r.top) > 30 ? a.r.top - b.r.top : a.r.left - b.r.left));
    for (let i = 0; i < rects.length - 1; i++) {
      const a = rects[i]!, b = rects[i + 1]!;
      if (Math.abs(a.r.top - b.r.top) > 30) continue; // different rows
      const x = (a.r.right + b.r.left) / 2;
      const y = a.r.top + a.r.height / 2;
      if (b.r.left - a.r.right < 12) continue;
      const hit = document.elementFromPoint(x, y);
      // No element means the point is off-screen, not that it is blank staff.
      if (!hit || hit.hasAttribute("data-omr-note")) continue;
      return { x, y, left: a.idx, right: b.idx };
    }
    return null;
  });

  const ghost = page.locator('[data-omr="insert-ghost"]');
  check("the ghost is hidden with nothing armed", await ghost.isVisible(), false);

  await arm("dur:1/4");
  {
    const gap = await findGap();
    check("found blank staff between two notes", gap != null, true);
    await page.mouse.move(gap!.x, gap!.y);
    await page.waitForTimeout(120);
    check("the ghost appears once a note value is armed", await ghost.isVisible(), true);
    check("the ghost names a pitch", /^[A-G]\d$/.test((await ghost.getAttribute("data-insert-pitch")) ?? ""), true);
  }

  // The check below proves the preview and the insert agree; it cannot prove the mapping's ORIGIN
  // is right, because both come out of it. This one can, without hardcoding any geometry: the
  // playhead spans the staff symmetrically (line 0 minus a margin, to line 4 plus the same margin),
  // so its vertical CENTRE is the middle staff line — which in treble is B4, full stop. If the
  // origin ever drifts by a line, every inserted note is a third out and this is what says so.
  {
    await page.locator("#palette-play").click();
    await waitForPlayhead(); // the B4 read below scrolls to the playhead, so it must be showing
    const aim = await page.evaluate(() => {
      const ph = document.querySelector<HTMLElement>('[data-omr="playhead"]');
      if (!ph || ph.style.display === "none") return "no playhead" as const;
      // Scroll to the PLAYHEAD, not to the top of the sheet: Çal starts at the last edited bar,
      // which the section above left at bar 31 — the last system, well below the fold.
      ph.scrollIntoView({ block: "center" });
      const r = ph.getBoundingClientRect();
      const diag: string[] = [`ph ${r.top.toFixed(0)}..${r.bottom.toFixed(0)}`];
      const mid = r.top + r.height / 2;
      // A blank-staff x on the playhead's OWN row, so the bar under the pointer is a real one.
      const rects = Array.from(document.querySelectorAll<HTMLElement>("[data-omr-note]"))
        .map((el) => el.getBoundingClientRect())
        .filter((b) => Math.abs(b.top + b.height / 2 - mid) < b.height)
        .sort((a, b) => a.left - b.left);
      diag.push(`${rects.length} notes on the row`);
      for (let i = 0; i < rects.length - 1; i++) {
        const x = (rects[i]!.right + rects[i + 1]!.left) / 2;
        if (rects[i + 1]!.left - rects[i]!.right < 12) continue;
        const hit = document.elementFromPoint(x, mid);
        if (!hit || hit.hasAttribute("data-omr-note")) { diag.push(`${x.toFixed(0)}→${hit?.tagName ?? "off-screen"}`); continue; }
        return { x, mid };
      }
      return diag.join(" ");
    });
    // On failure `aim` carries WHY (where the playhead was, what was under each candidate point) —
    // "no target" on its own sent this check down a false trail once already.
    check("found blank staff on the playhead's row", typeof aim === "object", true);
    if (typeof aim !== "object") throw new Error(`no insert target on the playhead's row: ${aim}`);
    await page.mouse.move(aim.x, aim.mid);
    await page.waitForTimeout(120);
    check("the middle staff line reads B4", await ghost.getAttribute("data-insert-pitch"), "B4");
    await page.locator("#palette-stop").click();
    await page.waitForTimeout(150);
  }

  const spot = (await findGap())!;
  const leftName = beforeInsert.events.find((e) => e.index === spot.left)!.noteName;
  const rightName = beforeInsert.events.find((e) => e.index === spot.right)!.noteName;
  console.log(`  gap between events ${spot.left} (${leftName}) and ${spot.right} (${rightName})`);
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(120);
  const ghostPitch = await ghost.getAttribute("data-insert-pitch");
  console.log(`  the ghost says the click would insert ${ghostPitch}`);
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(300);
  const afterInsert = await save();
  const newIndex = Number(await page.locator("#sheet-surface").getAttribute("data-selected-note"));
  const inserted = afterInsert.events.find((e) => e.index === newIndex)!;
  console.log(`  inserted event ${newIndex}: ${inserted?.noteName} ${inserted?.durationBeats.num}/${inserted?.durationBeats.den}`);

  check("one event more", afterInsert.events.length, beforeInsert.events.length + 1);
  check("the new note is selected", Number.isFinite(newIndex) && newIndex > 0, true);
  check("indices stay contiguous", afterInsert.events.every((e, i) => e.index === i + 1), true);
  check("it took the armed note value", `${inserted.durationBeats.num}/${inserted.durationBeats.den}`, "1/4");
  check("it has a real sounding time", inserted.durationMs > 0, true);
  // The whole point of the ghost: what it promised is what landed.
  check(
    "the pitch is the one the ghost showed",
    letterOf(inserted.noteName) + inserted.noteName.match(/(\d)/)![1],
    ghostPitch,
  );

  // Bar lines never move: the bar ABSORBS the note, so the score still has the same number of bars
  // and the target bar is now one event longer than it was.
  check("BAR LINES NEVER MOVE — the bar count is unchanged", barsOf(afterInsert), barsBefore);
  const insertedBar = measureOfEvent(afterInsert as unknown as NoteModelDocument, newIndex);
  check("the edit named the bar it landed in", await palette.getAttribute("data-play-from"), String(insertedBar));

  // It went in FRONT of the note to the right of the click, and behind the one to its left.
  {
    const at = afterInsert.events.findIndex((e) => e.index === newIndex);
    const prev = [...afterInsert.events.slice(0, at)].reverse().find((e) => e.kind !== "grace");
    const next = afterInsert.events.slice(at + 1).find((e) => e.kind !== "grace");
    check("it sits after the note left of the click", prev?.noteName, leftName);
    // A grace run leading into the right-hand note stays with ITS host, so the new note goes in
    // front of the graces too — hence "next non-grace", not "next".
    check("it sits before the note right of the click", next?.noteName, rightName);
  }

  // One insert is one undo entry.
  await page.locator("#undo").click();
  await page.waitForTimeout(300);
  check("undo removes the inserted note", JSON.stringify(await save()) === JSON.stringify(beforeInsert), true);
  await page.locator("#redo").click();
  await page.waitForTimeout(300);
  check("redo puts it back", (await save()).events.length, beforeInsert.events.length + 1);
  await page.locator("#undo").click();
  await page.waitForTimeout(300);

  // An ACCIDENTAL has nothing to attach to on blank staff: it must do nothing at all.
  await arm("acc:-1");
  check("the ghost stays away for an accidental", await ghost.isVisible(), false);
  const accSpot = (await findGap())!;
  await page.mouse.click(accSpot.x, accSpot.y);
  await page.waitForTimeout(250);
  check("an armed accidental on blank staff changes nothing", (await save()).events.length, beforeInsert.events.length);

  // With NOTHING armed, blank staff clears the selection and does nothing else. ⚠ It used to open
  // the per-measure modal; that modal was DELETED on 2026-08-08 (editor step 10), so the check that
  // matters now is the opposite one — **no window may appear over the score**, from either path.
  await page.keyboard.press("Escape");
  const bareSpot = (await findGap())!;
  await page.mouse.click(bareSpot.x, bareSpot.y);
  await page.waitForTimeout(250);
  check("an unarmed click on blank staff opens no window", await page.locator('[role="dialog"]').count(), 0);
  check("...and clears the selection", await page.locator("#sheet-surface").getAttribute("data-selected-note"), null);
  check("...and changes nothing", (await save()).events.length, beforeInsert.events.length);

  // --- rests, and the numbered koma signs (2026-08-08) -----------------------------------------
  //
  // Both arrived when the measure modal was deleted: it had been the only way to make a rest and
  // the only place the numbered ±2/±3 alterations lived. A rest is the SAME tool as a note value
  // with `rest: true`, so these checks also prove the shared insert/apply paths did not fork.
  console.log("\nrests and the numbered komas");

  await rewindAll();
  await page.keyboard.press("Escape");
  const beforeRest = await save();

  // Insert a rest on blank staff: same gesture as inserting a note, different event shape.
  await arm("rest:1/4");
  {
    const gap = (await findGap())!;
    await page.mouse.move(gap.x, gap.y);
    await page.waitForTimeout(120);
    // The preview must not promise a pitch it will not use — a rest goes mid-staff whatever the
    // pointer's height.
    check("the ghost says REST, not a pitch", await ghost.getAttribute("data-insert-pitch"), "es");
    await page.mouse.click(gap.x, gap.y);
    await page.waitForTimeout(300);
    const after = await save();
    const newIndex = Number(await page.locator("#sheet-surface").getAttribute("data-selected-note"));
    const ev = after.events.find((e) => e.index === newIndex)!;
    check("one event more", after.events.length, beforeRest.events.length + 1);
    check("...and it is a REST", ev.kind, "rest");
    check("...with the armed value", `${ev.durationBeats.num}/${ev.durationBeats.den}`, "1/4");
    check("...that takes real time", ev.durationMs > 0, true);
    check("...and carries no pitch", `${ev.noteName}/${ev.koma53}`, "Es/-1");
    check("bar lines still never move", barsOf(after), barsOf(beforeRest));
  }
  await page.locator("#undo").click();
  await page.waitForTimeout(300);
  check("one undo removes the rest", JSON.stringify(await save()) === JSON.stringify(beforeRest), true);

  // A rest tool on an existing NOTE turns it into a rest — the other half of what the modal did.
  const noteTarget = beforeRest.events.find((e) => e.kind === "note" && e.noteName !== "Es")!;
  await clickNote(noteTarget.index);
  {
    const ev = (await save()).events.find((e) => e.index === noteTarget.index)!;
    check("a note clicked with a rest armed becomes a rest", ev.kind, "rest");
    check("...and its pitch is cleared, not left claiming a note", ev.noteName, "Es");
    check("...taking the tool's value", `${ev.durationBeats.num}/${ev.durationBeats.den}`, "1/4");
  }

  // And back: a NOTE value on that rest restores a note, pitched by the click's height. The height
  // is the only source there is — a rest carries no pitch to keep.
  await arm("dur:1/4");
  await clickNote(noteTarget.index);
  {
    const ev = (await save()).events.find((e) => e.index === noteTarget.index)!;
    check("a rest clicked with a note value armed becomes a note", ev.kind, "note");
    check("...with a real sounding pitch", ev.koma53 > 0 && /^[A-Za-zİ]/.test(ev.noteName), true);
    check("...and a frequency to play it at", (ev as unknown as { freqHz: number | null }).freqHz != null, true);
  }
  await rewindAll();
  await page.keyboard.press("Escape");

  // The numbered koma signs. ±2 has its own Bravura glyph (`accidental2CommaSharp`), so it is a
  // real sign in the row, not a text button — but the STAFF snaps what it draws to the nearest AEU
  // sign, so the only honest assertion is on the stored comma.
  {
    const plain = (await save()).events.find(
      (e) => e.kind === "note" && suffix(e.noteName) === "" && onSheet.has(e.index),
    )!;
    check("found an unaltered note for the numbered check", plain != null, true);
    await arm("acc:2");
    await clickNote(plain.index);
    const ev = (await save()).events.find((e) => e.index === plain.index)!;
    check("a 2-comma sharp is applied exactly", ev.koma53 - plain.koma53, 2);
    check("...and it is spelled as 2 commas, not snapped to koma or bakiye", suffix(ev.noteName), "#2");
    check("...on the same staff position", ev.noteName.replace(/[#b]\d+$/, ""), plain.noteName);
    await page.locator("#undo").click();
    await page.waitForTimeout(250);
  }
  await page.keyboard.press("Escape");

  // --- the tuplet tool (step 7) ----------------------------------------------------------------
  //
  // One tool, both directions: click a note and the note two on to make a triplet, click any
  // member of one to take it apart. The rules live in tools/render/rhythm.ts — the module that
  // DRAWS the bracket — so this check finds its target with the same function the app uses, and
  // then asserts only on what the app produced: the `data-tuplet` states, the saved durations, and
  // the "3" the engraver actually drew.
  console.log("\nthe tuplet tool");

  await rewindAll();
  await page.keyboard.press("Escape");
  const beforeTup = await save();

  /** The first INTERIOR bar holding three consecutive equal plain notes, as event indices.
   *  Interior on purpose: the off-meter mark below exempts the first and last bar from the "short"
   *  warning (a pickup and a closing bar are legitimately short), and a triplet always shortens the
   *  bar it lands in — so a run in bar 1 could not be used to check the mark at all. */
  const runTarget = (() => {
    const ms = groupMeasures(beforeTup as unknown as NoteModelDocument);
    for (const m of ms.slice(1, -1)) {
      for (let pos = 0; pos < m.events.length; pos++) {
        const run = tupletRunFrom(m.events, pos);
        if (run) return { bar: m.index, idx: run.map((p) => m.events[p]!.index) };
      }
    }
    return null;
  })();
  check("the sample has a legal triplet run", runTarget != null, true);
  if (!runTarget) throw new Error("no three equal plain notes anywhere in the sample");
  console.log(`  bar ${runTarget.bar}, events ${runTarget.idx.join(",")}`);

  const tupletOf = (i: number) => page.locator(`[data-omr-note="${i}"]`).first().getAttribute("data-tuplet");
  /** Distinct events in a given tuplet target state (a tie-split event owns two boxes). */
  const inState = async (state: string) =>
    new Set(
      await page
        .locator(`[data-tuplet="${state}"]`)
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-omr-note")!)),
    ).size;
  /** How many triplet MARKS the engraver drew. Nothing about a tuplet is stored — the bracket and
   *  the 3 exist because `tupletGroupsIn` finds the arithmetic — so this is the only proof the edit
   *  is real to a reader. Both styles are counted: the per-piece coin picks either VexFlow's
   *  bracket (a `.vf-tuplet` group) or the curved arc most printed Turkish scores use (raw SVG with
   *  an italic "3"), and which one this sample gets must not decide whether the check works. */
  const drawnMarks = async () =>
    await page.evaluate(() => {
      const svg = document.querySelector('[data-omr="sheet-svg"]')!;
      const arcs = Array.from(svg.querySelectorAll("text")).filter((t) => t.textContent?.trim() === "3");
      return svg.querySelectorAll(".vf-tuplet").length + arcs.length;
    });
  const marksBefore = await drawnMarks();

  await arm("tuplet");
  check("notes that cannot start a run are refused", (await inState("blocked")) > 0, true);
  check("...and the ones that can are offered", (await inState("start")) > 0, true);
  check("the run's first note is offered", await tupletOf(runTarget.idx[0]!), "start");

  // A blocked note is not a target at all: the click falls through to the measure box below, which
  // does nothing with a tool armed. Nothing may change, and no modal may open.
  {
    const blocked = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-tuplet="blocked"]');
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    check("found a blocked note to click at", blocked != null, true);
    await page.mouse.click(blocked!.x, blocked!.y);
    await page.waitForTimeout(200);
    check("a blocked note cannot be picked", await page.locator("#sheet-surface").getAttribute("data-tuplet-anchor"), null);
    check("...and opens no modal", await page.locator('[role="dialog"]').count(), 0);
  }

  // Pick the first note: exactly one end note stays live in the whole score.
  await clickNote(runTarget.idx[0]!);
  check("the anchor is recorded", await page.locator("#sheet-surface").getAttribute("data-tuplet-anchor"), String(runTarget.idx[0]));
  check("exactly one note can close the run", await inState("end"), 1);
  check("...and it is the third note, not the second", await tupletOf(runTarget.idx[2]!), "end");
  check("the second note of the run is not a target", await tupletOf(runTarget.idx[1]!), "blocked");

  // Close it.
  const wasBeats = beforeTup.events.find((e) => e.index === runTarget.idx[0]!)!.durationBeats;
  await clickNote(runTarget.idx[2]!);
  const afterTup = await save();
  check("the anchor is released", await page.locator("#sheet-surface").getAttribute("data-tuplet-anchor"), null);
  {
    const got = runTarget.idx.map((i) => {
      const d = afterTup.events.find((e) => e.index === i)!.durationBeats;
      return `${d.num}/${d.den}`;
    });
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    const n = wasBeats.num * 2, d = wasBeats.den * 3, k = g(n, d);
    check("all three members are now ⅔ of what they were", got.join(" "), `${n / k}/${d / k} `.repeat(3).trim());
    const ms = afterTup.events.find((e) => e.index === runTarget.idx[0]!)!.durationMs;
    const wasMs = beforeTup.events.find((e) => e.index === runTarget.idx[0]!)!.durationMs;
    check("durationMs followed the beats", Math.abs(ms - (wasMs * 2) / 3) < 1, true);
  }
  check("nothing else in the score moved",
    JSON.stringify(afterTup.events.filter((e) => !runTarget.idx.includes(e.index))),
    JSON.stringify(beforeTup.events.filter((e) => !runTarget.idx.includes(e.index))));
  check("the event count is unchanged", afterTup.events.length, beforeTup.events.length);
  // Nothing is STORED for a tuplet — the bracket is drawn because the arithmetic says so. So the
  // only proof the edit is real to the reader is that the engraver drew one more "3".
  check("the engraver drew one more triplet mark", await drawnMarks(), marksBefore + 1);

  // One apply is one undo entry.
  await page.locator("#undo").click();
  await page.waitForTimeout(300);
  check("one undo restores all three notes", JSON.stringify(await save()) === JSON.stringify(beforeTup), true);
  await page.locator("#redo").click();
  await page.waitForTimeout(300);
  check("redo puts the triplet back", await drawnMarks(), marksBefore + 1);

  // Remove it: with the tool still armed, any member takes the whole group apart.
  check("a member is offered for removal", await tupletOf(runTarget.idx[1]!), "member");
  await clickNote(runTarget.idx[1]!);
  check("clicking a member un-tuplets the group", JSON.stringify(await save()) === JSON.stringify(beforeTup), true);
  check("...and the mark is gone with it", await drawnMarks(), marksBefore);

  // --- the invalid-bar indicator (step 8) --------------------------------------------------------
  //
  // The reference is the DERIVED METER, never `Measure.lengthBeats` — that is computed from the
  // bar's own contents, so it is true by construction and can only mean "you changed this bar".
  console.log("\nthe invalid-bar indicator");

  await page.keyboard.press("Escape"); // the tuplet is still armed above, and arming twice disarms
  await rewindAll();
  await page.waitForTimeout(200);
  const warn = page.locator('[data-omr="bar-warning"]');
  check("a clean score shows no off-meter bars", await warn.count(), 0);

  // A triplet takes 3/8 down to 1/4, so its bar is now short — the tool's own side effect is what
  // this indicator is for.
  await arm("tuplet");
  await clickNote(runTarget.idx[0]!);
  await clickNote(runTarget.idx[2]!);
  const marks = async () =>
    await warn.evaluateAll((els) =>
      els.map((e) => `${e.getAttribute("data-bar")}:${e.getAttribute("data-bar-fill")}`),
    );
  check("the triplet's bar, and only it, is marked", (await marks()).join(" "), `${runTarget.bar}:under`);

  // The other direction: insert a note into that same bar and it goes over.
  await page.keyboard.press("Escape");
  await page.locator("#undo").click();
  await page.waitForTimeout(300);
  check("undo clears the mark", await warn.count(), 0);
  await arm("dur:1/4");
  {
    const gap = await findGap();
    check("found blank staff for the over-full check", gap != null, true);
    await page.mouse.click(gap!.x, gap!.y);
    await page.waitForTimeout(300);
    check("an inserted note makes its bar over-full", (await marks()).length, 1);
    check("...and it says OVER, the other direction", (await marks())[0]!.split(":")[1], "over");
  }
  await page.keyboard.press("Escape");
  await rewindAll();
  await page.waitForTimeout(200);
  check("rewinding leaves a clean score again", await warn.count(), 0);

  // --- every note box belongs to its own note (the grace-note geometry bug, 2026-08-08) ---------
  //
  // `StaveNote.getBoundingBox()` merges each MODIFIER's box in, and `GraceNoteGroup` never positions
  // itself, so it reports its box at the SVG origin — which stretched a graced note's box from the
  // top-left of the score down to the note. Owner-visible as "one giant note" covering a third of the
  // page and swallowing every click in it, and the escape people found was to DELETE a real note.
  //
  // The default sample has no grace notes, which is exactly why this section loads one that does.
  // Two assertions, neither with a tunable threshold in it:
  //   - no box may sit at the sheet's own origin (a drawn note has a clef to its left and a title
  //     above it, so only an unpositioned modifier can put a box there);
  //   - clicking the centre of a box must land on that box — the user-visible property, and what
  //     actually broke.
  console.log("\nnote-box geometry, on a score WITH grace notes");
  const graced = "/beyati-delisin.json";
  await page.goto(`${base}/?score=${graced}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });
  await page.locator("#edit-toggle").click();
  await page.waitForTimeout(600);

  const geometry = await page.evaluate(() => {
    const surface = document.querySelector("#sheet-surface")!;
    surface.scrollIntoView({ block: "start" });
    const s = surface.getBoundingClientRect();
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-omr-note]"));
    const atOrigin: string[] = [];
    const stolen: string[] = [];
    let onScreen = 0;
    for (const el of els) {
      const idx = el.getAttribute("data-omr-note")!;
      const r = el.getBoundingClientRect();
      // "At the origin" with a few px of slack for the hit padding the overlay adds.
      if (r.left - s.left <= 4 && r.top - s.top <= 4) atOrigin.push(idx);
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) continue; // not clickable, not testable
      onScreen++;
      if (document.elementFromPoint(x, y)?.getAttribute("data-omr-note") !== idx)
        stolen.push(`${idx}→${document.elementFromPoint(x, y)?.getAttribute("data-omr-note") ?? "none"}`);
    }
    return { total: els.length, onScreen, atOrigin, stolen };
  });
  console.log(`  ${graced}: ${geometry.total} boxes, ${geometry.onScreen} on screen`);
  check("no note box is anchored at the sheet's origin", geometry.atOrigin.join(" ") || "none", "none");
  check("every box's centre hits its own note", geometry.stolen.join(" ") || "none", "none");

  check("no uncaught page errors", pageErrors.length ? pageErrors.join("; ") : "none", "none");

  await browser.close();
  await server.close();
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
