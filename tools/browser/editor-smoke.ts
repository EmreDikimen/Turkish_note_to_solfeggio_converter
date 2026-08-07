/**
 * Does the sheet editor actually edit? — select a note, drag its pitch, delete it, undo, redo.
 *
 * Drives the REAL app on the bundled sample. Like the other smokes it asserts on `data-*` and on
 * the saved document, never on the Turkish copy: `#edit-toggle[data-edit-mode]`,
 * `[data-omr-note]` / `[data-selected]`, `[data-selected-note]` on the sheet container, and
 * `#note-delete` / `#undo` / `#redo`.
 *
 * The checks that matter most, because each one is a bug this slice fixed or nearly shipped:
 *  - a pitch edit moves `noteName`, not just `koma53` — the sheet reads noteName for its notehead,
 *    so an edit that moves only the koma moves the sound and leaves the notehead behind;
 *  - dragging moves the note EXACTLY as far as the pointer, and the page does not scroll with it;
 *  - one drag is one undo entry, not one per step.
 *
 *   npx tsx tools/browser/editor-smoke.ts
 */
import { chromium } from "playwright";
import { createServer } from "vite";
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

  check("no uncaught page errors", pageErrors.length ? pageErrors.join("; ") : "none", "none");

  await browser.close();
  await server.close();
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
