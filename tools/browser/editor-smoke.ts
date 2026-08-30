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

/**
 * Where the instrument voices are served from, for the OPT-IN real-sample arm (F1).
 *
 * Off by default on purpose: the samples are 20–35 MB an instrument, and a check that every run
 * downloads that much is a check people stop running. Without it this file still exercises the more
 * important half — the FALLBACK — because an unset base makes every voice load fail, which is
 * exactly the condition a friend hits when the Hub is unreachable.
 *
 *   npm run smoke:editor -- --voices-url https://huggingface.co/datasets/…/resolve/main
 */
const VOICES_URL = (() => {
  const i = process.argv.indexOf("--voices-url");
  return i >= 0 ? (process.argv[i + 1] ?? "") : "";
})();

/**
 * Open the instrument page and pick one — the F3 views live behind ONE tab since 2026-08-29.
 *
 * ⚠ Picking here also starts a 20–35 MB voice download, which is the point of the merge (the sound
 * follows the picture) and is why this waits on the instrument's own element rather than on the
 * voice: the drawing must be usable long before the samples land.
 */
async function openInstrument(page: import("playwright").Page, id: "violin" | "kanun") {
  await page.locator("#view-instrument").click();
  await page.waitForSelector("#instrument-view", { timeout: 10000 });
  await page.locator("#instrument-pick").selectOption(id);
  await page.waitForSelector(id === "kanun" ? "#kanun" : "#fingerboard", { timeout: 10000 });
}

async function main() {
  // Vite reads VITE_* from the environment at config time, so this has to be set before the server
  // is created — not after, and not per-page.
  if (VOICES_URL) process.env.VITE_VOICES_URL = VOICES_URL;
  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  /** The live note model. Was a JSON download; the app's export button is gone (owner,
   *  2026-08-30), so it is read straight off the page through the same automation hook the strip
   *  exporter uses. Reading state beats driving a button: nothing scrolls, so no box goes stale. */
  const save = async (): Promise<Doc> =>
    (await page.evaluate(() => (window as unknown as { __omrDoc?: unknown }).__omrDoc)) as Doc;

  /** Park the pointer over a note and return its box.
   *  ⚠ Scroll it into view AND re-read the box every time — a note can sit outside the viewport,
   *  and then `mouse.move` puts the cursor off-page and no pointer event reaches it at all. That
   *  failure looks exactly like "dragging doesn't work", which already cost one debugging round. */
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

  // ⚠ The score comes from `?score=` now, not from an auto-loading bundled sample. The app ships
  // no scores since 2026-08-08 (all of them were SymbTr-derived, CC BY-NC-SA — see App.tsx's
  // SAMPLES comment), so a bare visit has nothing to edit and never gets `data-ready`. The file is
  // still on disk, gitignored, and a dev server serves it.
  await page.goto(`${base}/?score=/gamzedeyim-deva.json`, { waitUntil: "domcontentloaded" });
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

  // --- the look-ahead scheduler keeps feeding (feature track F0) --------------------------------
  //
  // ⚠ The playhead cannot prove this. It is derived from the AUDIO CLOCK, so it glides down the
  // sheet at the right speed even if the scheduler died on its first tick and the page has gone
  // completely silent — every check above would still pass. `window.__omrAudio()` reports how many
  // events the backend has actually handed to Web Audio, which is the only thing that can tell
  // "playing" from "the clock is running".
  const audioProgress = async (): Promise<{ scheduled: number; total: number }> =>
    page.evaluate(() =>
      (window as unknown as { __omrAudio: () => { scheduled: number; total: number } }).__omrAudio(),
    );

  const early = await audioProgress();
  // The whole point of the refactor: a piece is scheduled a second at a time, not all at once.
  check("playback does not schedule the whole piece up front", early.scheduled < early.total, true);
  await page.waitForTimeout(2000);
  const later = await audioProgress();
  console.log(`  scheduler fed ${early.scheduled} → ${later.scheduled} of ${later.total} events`);
  check("the scheduler kept feeding over 2 s", later.scheduled > early.scheduled, true);

  await page.locator("#palette-stop").click();
  await page.waitForTimeout(200);
  check("Dur stops it", await page.locator("#palette-play").getAttribute("data-play-state"), "stopped");
  check("the transport agrees again", await page.locator("#play").getAttribute("data-play-state"), "stopped");
  check("the playhead is gone", await playheadFraction(), null);

  // --- the usul's strokes reach the scheduler (feature track F2) --------------------------------
  //
  // `total` is the whole event list this playback holds. Replaying the SAME bar with percussion on
  // must make it bigger by exactly the strokes the usul contributes — which is the only way from
  // here to prove `buildPercussionTrack` ran and its hits were handed to the backend. (Whether they
  // SOUND like a düm is an ears question: docs/MANUAL_CHECKS.md.)
  const perc = page.locator("#percussion");
  const strokesInUsul = Number(await perc.getAttribute("data-usul-strokes"));
  check("the selected usul has a drafted stroke pattern", strokesInUsul > 0, true);
  check("...so the percussion toggle is offered", await perc.isDisabled(), false);

  const silentTotal = later.total;
  await perc.check();
  await page.locator("#palette-play").click();
  await page.waitForTimeout(400);
  const withPercussion = await audioProgress();
  console.log(`  ${silentTotal} events without the usul, ${withPercussion.total} with it`);
  check("turning on the usul adds events to the same playback", withPercussion.total > silentTotal, true);

  // The volume slider must ride a gain node, NOT re-schedule. A re-schedule would restart the
  // playback from the current position, which resets the backend's cursor to 0 — so "scheduled did
  // not go backwards, and the transport never left `playing`" is exactly the assertion that
  // separates the two implementations. (Whether it got LOUDER is an ears question.)
  const vol = page.locator("#percussion-volume");
  check("the volume slider is offered", await vol.isDisabled(), false);
  const beforeVol = await audioProgress();
  await vol.fill("180");
  await page.waitForTimeout(500);
  const afterVol = await audioProgress();
  check("changing the volume does not restart playback",
    afterVol.scheduled >= beforeVol.scheduled && afterVol.total === beforeVol.total, true);
  check("...and it is still playing", await page.locator("#palette-play").getAttribute("data-play-state"), "playing");
  check("the slider reports its value as state", await vol.getAttribute("data-percussion-volume"), "1.8");

  // --- the strokes are the REAL recordings, not the synthesised fallback (F2, 2026-08-11) --------
  //
  // ⚠ Nothing on the page can show this. A sampled düm and a synthesised one produce identical DOM,
  // identical `data-*` and identical event counts — the difference is entirely in what comes out of
  // the speaker. So the backend reports which kit decoded, the same way `__omrAudio` reports the
  // scheduler: without it, the swap could silently fall back to synthesis on every playback and
  // every other check here would still pass.
  const percussionInfo = async (): Promise<{ kit: string | null; loaded: number }> =>
    page.evaluate(() =>
      (
        window as unknown as { __omrPercussion: () => { kit: string | null; loaded: number } }
      ).__omrPercussion(),
    );
  const loadedKit = await percussionInfo();
  console.log(`  percussion kit "${loadedKit.kit}", ${loadedKit.loaded} strokes decoded`);
  check("a drum kit decoded rather than falling back to synthesis", loadedKit.loaded, 3);
  check("...and it is the one the picker shows",
    loadedKit.kit, await page.locator("#percussion-kit").getAttribute("data-percussion-kit"));

  // Switching kits must re-schedule (unlike the volume), because the buffer is chosen as each
  // stroke is scheduled — a change that did not re-schedule would not be heard until the next Play.
  await page.locator("#percussion-kit").selectOption("bendir");
  await page.waitForTimeout(600);
  const swapped = await percussionInfo();
  check("switching the kit loads the other drum", swapped.kit, "bendir");
  check("...with all three of its strokes", swapped.loaded, 3);

  // --- the instrument voice (feature track F1) ---------------------------------------------------
  //
  // ⚠ Same blind spot as the drums, one step worse: a note sounded by a recording and a note sounded
  // by an oscillator are the same DOM, the same event counts and the same playhead. `__omrVoice()`
  // reports which path each note actually took, and `sampled`/`synth` is the only evidence the
  // feature does anything at all.
  const voiceInfo = async (): Promise<{
    voice: string; state: string; loaded: number; total: number;
    sampled: number; synth: number; truncated: number;
  }> =>
    page.evaluate(() =>
      (window as unknown as { __omrVoice: () => never }).__omrVoice(),
    );

  const picker = page.locator("#instrument");
  check("an instrument picker is offered", await picker.isDisabled(), false);
  check("...defaulting to the built-in tone", await picker.getAttribute("data-instrument"), "sine");
  // ⚠ Not gated on the usul, unlike the drum controls: an instrument has nothing to do with the
  // rhythm, and gating it would hide the feature on any piece whose usul has no stroke pattern.
  await page.locator("#percussion-kit").selectOption("darbuka");
  await perc.uncheck();
  await page.waitForTimeout(100);
  check("...and still offered with the usul's strokes off", await picker.isDisabled(), false);

  await picker.selectOption("clarinet");
  await page.waitForTimeout(300);
  check("choosing an instrument is mirrored as state", await picker.getAttribute("data-instrument"), "clarinet");
  check("...and the backend agrees", (await voiceInfo()).voice, "clarinet");

  // The transport must not wait for a 20–35 MB download. This is the regression guard on
  // `play()` deliberately NOT awaiting `ensureVoice` — if it ever starts awaiting it, this hangs
  // rather than failing quietly.
  const beforePlay = Date.now();
  await page.locator("#palette-play").click();
  await page.waitForFunction(
    () => document.querySelector("#play")?.getAttribute("data-play-state") === "playing",
    undefined,
    { timeout: 5000 },
  );
  console.log(`  Play responded in ${Date.now() - beforePlay} ms with a voice selected`);
  await page.waitForTimeout(600);

  const heard = await voiceInfo();
  console.log(
    `  voice "${heard.voice}" ${heard.state}, ${heard.loaded}/${heard.total} decoded, ` +
      `${heard.sampled} sampled / ${heard.synth} synthesised notes`,
  );

  if (VOICES_URL) {
    // The opt-in arm: real files, from the real host.
    await page.waitForFunction(
      () => (window as unknown as { __omrVoice: () => { state: string } }).__omrVoice().state === "ready",
      undefined,
      { timeout: 120000 },
    );
    await page.locator("#palette-play").click();
    await page.waitForTimeout(800);
    const real = await voiceInfo();
    check("every sample of the voice decoded", real.loaded, real.total);
    check("...and the notes were sounded by recordings", real.sampled > 0 && real.synth === 0, true);
    check("...with none outlasting its recording", real.truncated, 0);
  } else {
    // ⚠ The default arm, and the property that matters most: with no host configured every voice
    // load FAILS, and the app must keep playing anyway. A voice that will not download is a reason
    // to hear the built-in tone, never a reason for silence — the same rule as the drums' fallback
    // and the in-browser decode fallback. Nothing else here would notice the difference.
    await page.waitForFunction(
      () => (window as unknown as { __omrVoice: () => { state: string } }).__omrVoice().state === "failed",
      undefined,
      { timeout: 15000 },
    );
    check("an unreachable voice host is reported, not hidden",
      await picker.getAttribute("data-voice-state"), "failed");
    check("...but the piece is still playing",
      await page.locator("#play").getAttribute("data-play-state"), "playing");
    const fell = await voiceInfo();
    check("...every note sounded by the built-in tone", fell.sampled === 0 && fell.synth > 0, true);
    const fedOn = await audioProgress();
    check("...and the scheduler is still feeding", fedOn.scheduled > 0, true);
  }

  // ⚠ The drums must be untouched by all of this. They resolve from the app's own origin
  // (`VITE_AUDIO_URL`, deliberately unset) while the voices resolve from `VITE_VOICES_URL` — this is
  // the check that the two bases stayed separate. Merging them would 404 the percussion in
  // production and silently regress it to the synthesis the owner rejected by ear.
  await page.locator("#palette-stop").click();
  await perc.check();
  await page.locator("#palette-play").click();
  await page.waitForTimeout(600);
  const stillDrums = await percussionInfo();
  check("the drums still come from the app, whatever the voices do", stillDrums.loaded, 3);

  await page.locator("#palette-stop").click();
  await picker.selectOption("sine");
  await page.waitForTimeout(200);
  check("switching back to the built-in tone", (await voiceInfo()).voice, "sine");

  await vol.fill("100");
  await page.locator("#percussion-kit").selectOption("darbuka");
  await perc.uncheck(); // leave the transport as the rest of this run expects it
  await page.waitForTimeout(200);

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

  // --- holding a triplet: click the SIGN, slide its ends, take the bracket off (step 7b) ---------
  //
  // ⚠ The click target is the drawn "3", not the notes (owner, 2026-08-30). So this clicks
  // `[data-omr="tuplet-mark-hit"]` and separately proves the notes are NOT targets. Everything else
  // is read from the DOM, never from copy: `#sheet-surface[data-tuplet-selected]` names the held
  // group, `[data-tuplet-held]` marks its three notes, `[data-tuplet-landing]` marks every note a
  // handle may be dragged onto, and `[data-omr="tuplet-handle"][data-edge]` is the handle itself.
  const surface = page.locator("#sheet-surface");
  const heldNotes = async () =>
    new Set(
      await page
        .locator("[data-tuplet-held]")
        .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-omr-note")))),
    );
  /** The click target sitting over the drawn "3" of the group whose first member is `i`. */
  const markHit = (i: number) => page.locator(`[data-omr="tuplet-mark-hit"][data-tuplet-group="${i}"]`);

  check("the note inside a triplet still says so", await tupletOf(runTarget.idx[1]!), "member");
  // …and is NOT a target: pointer-events are off, so a click passes straight through it to the
  // measure box below, which does nothing with a tool armed. This is the owner's ask, and reading
  // the computed style is the only way to prove a click cannot land rather than merely does not.
  check("...but it is not clickable",
    await page.locator(`[data-omr-note="${runTarget.idx[1]}"]`).first()
      .evaluate((el) => getComputedStyle(el).pointerEvents),
    "none");
  check("the drawn 3 is a target instead", await markHit(runTarget.idx[0]!).count(), 1);

  // ⚠ The mark's target must sit on the MARK. A group's `getBBox()` is the union of its children's,
  // and two children lie about theirs — a `<text>` reports its FONT's em box (a bracket's "3"
  // measured 12 × 160 px) and VexFlow emits a zero-height rect at the SVG ORIGIN. Measuring the
  // group directly produced a slab over the staff that would swallow the clicks meant for notes,
  // which is the `GraceNoteGroup` bug this codebase already paid for once. So: no note's centre may
  // fall inside a mark's target.
  {
    const stolen = await page.evaluate(() => {
      const marks = Array.from(document.querySelectorAll('[data-omr="tuplet-mark-hit"]'))
        .map((e) => e.getBoundingClientRect());
      const bad: string[] = [];
      for (const n of Array.from(document.querySelectorAll("[data-omr-note]"))) {
        const r = n.getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        if (marks.some((m) => cx >= m.x && cx <= m.x + m.width && cy >= m.y && cy <= m.y + m.height))
          bad.push(n.getAttribute("data-omr-note")!);
      }
      return bad;
    });
    check("no mark's target swallows a note", stolen.join(",") || "none", "none");
  }
  await markHit(runTarget.idx[0]!).click();
  await page.waitForTimeout(250);
  check("clicking the sign holds the whole group", await surface.getAttribute("data-tuplet-selected"), String(runTarget.idx[0]));
  check("...without changing a single note", JSON.stringify(await save()) === JSON.stringify(afterTup), true);
  check("...and all three notes are marked", [...(await heldNotes())].sort((a, b) => a - b).join(","), runTarget.idx.join(","));
  check("both handles are drawn", await page.locator('[data-omr="tuplet-handle"]').count(), 2);

  // Drag the right handle onto the next note. The group keeps three members, so this SLIDES it:
  // the first member gets its plain value back and the next note joins. Whether that is legal is
  // `tupletEdgeTo`'s answer, and the sheet marks the notes it accepts, so the check drags onto one
  // of those rather than guessing.
  {
    // `data-tuplet-landing` says WHICH handle can reach the note ("start", "end" or "both"), so
    // this drags the right one — dragging the wrong end onto a legal landing would fail and look
    // like a bug in the slide.
    const landings = await page
      .locator("[data-tuplet-landing]")
      .evaluateAll((els) =>
        els.map((e) => ({
          idx: Number(e.getAttribute("data-omr-note")),
          edge: e.getAttribute("data-tuplet-landing")!,
        })),
      );
    check("the sheet marks where a handle may land", landings.length > 0, true);
    const to = landings.find((l) => l.idx > runTarget.idx[2]! && l.edge !== "start")?.idx;
    if (to == null) {
      console.log("  (no landing to the RIGHT in this bar — the slide check is skipped)");
    } else {
      const handle = page.locator('[data-omr="tuplet-handle"][data-edge="end"]');
      await handle.scrollIntoViewIfNeeded();
      const hb = (await handle.boundingBox())!;
      const target = page.locator(`[data-omr-note="${to}"]`).first();
      const tb = (await target.boundingBox())!;
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(tb.x + tb.width / 2, hb.y + hb.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(300);

      const slid = await save();
      const beatsOf = (d: Doc, i: number) => {
        const b = d.events.find((e) => e.index === i)!.durationBeats;
        return `${b.num}/${b.den}`;
      };
      check("the first member has its plain value back",
        beatsOf(slid, runTarget.idx[0]!), beatsOf(beforeTup, runTarget.idx[0]!));
      check("the note the handle reached is now a member",
        beatsOf(slid, to), beatsOf(afterTup, runTarget.idx[1]!));
      check("the middle members did not move",
        beatsOf(slid, runTarget.idx[1]!), beatsOf(afterTup, runTarget.idx[1]!));
      check("the score still holds exactly one more triplet mark than it started with",
        await drawnMarks(), marksBefore + 1);
      check("the group is still held, now by its new first note",
        await surface.getAttribute("data-tuplet-selected"), String(runTarget.idx[1]));
      check("the event count is untouched by a slide", slid.events.length, beforeTup.events.length);

      // One drag is one gesture: it must undo as one, however many notes it crossed.
      await page.locator("#undo").click();
      await page.waitForTimeout(300);
      check("one undo puts the slide back", JSON.stringify(await save()) === JSON.stringify(afterTup), true);
      check("...and undo lets the group go", await surface.getAttribute("data-tuplet-selected"), null);
      await markHit(runTarget.idx[0]!).click(); // hold it again for the ✕ below
      await page.waitForTimeout(250);
    }
  }

  // The ✕ takes the BRACKET off and keeps the notes (owner, 2026-08-30) — the second half of what a
  // click on a member used to do in one go.
  check("the held group offers a ✕", await page.locator("#tuplet-remove").count(), 1);
  const heldCount = (await save()).events.length;
  await page.locator("#tuplet-remove").click();
  await page.waitForTimeout(300);
  check("the ✕ un-tuplets the group", JSON.stringify(await save()) === JSON.stringify(beforeTup), true);
  check("...and the mark is gone with it", await drawnMarks(), marksBefore);
  check("...but no note was deleted", (await save()).events.length, heldCount);
  check("...and nothing is held any more", await surface.getAttribute("data-tuplet-selected"), null);

  // --- BROKEN marks: a bracket over one or two notes, on a real DECODED page --------------------
  //
  // `tupletGroupsIn` draws a mark over a run that never sums to a plain value. That is the model's
  // misread, drawn on purpose so a person can see it — and the owner asked to be able to clear or
  // complete one (2026-08-30). This runs on `decoded.json`, a real decoded page, because no clean
  // SymbTr sample has any: it carries five, of one, two and three members.
  console.log("\nbroken tuplet marks (a real decoded page)");

  await page.goto(`${base}/?score=/decoded.json`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#app[data-ready]", { timeout: 20000 });
  await page.locator("#edit-toggle").click();
  await arm("tuplet");
  await page.waitForTimeout(300);

  {
    const marksOf = async (kind: string) =>
      await page.locator(`[data-omr="tuplet-mark-hit"][data-tuplet-mark="${kind}"]`).evaluateAll((els) =>
        els.map((e) => Number(e.getAttribute("data-tuplet-group"))),
      );
    const broken = await marksOf("broken");
    const closed = await marksOf("closed");
    check("the decoded page's broken marks are all offered", broken.length, 5);
    check("...and its real triplets too", closed.length, 2);
    check("...and the two kinds are told apart", broken.some((b) => closed.includes(b)), false);

    // Clearing one: the notes stay, their plain values come back, the mark goes.
    const drawnMarksNow = async () =>
      await page.evaluate(() => {
        const svg = document.querySelector('[data-omr="sheet-svg"]')!;
        const arcs = Array.from(svg.querySelectorAll("text")).filter((t) => t.textContent?.trim() === "3");
        return svg.querySelectorAll(".vf-tuplet").length + arcs.length;
      });
    const beforeClear = await save();
    const markCountBefore = await drawnMarksNow();
    const victim = broken[0]!;
    await page.locator(`[data-omr="tuplet-mark-hit"][data-tuplet-group="${victim}"]`).scrollIntoViewIfNeeded();
    await page.locator(`[data-omr="tuplet-mark-hit"][data-tuplet-group="${victim}"]`).click();
    await page.waitForTimeout(250);
    check("a broken mark can be held", await surface.getAttribute("data-tuplet-selected"), String(victim));
    check("...and the frame says it is broken",
      await page.locator('[data-omr="tuplet-frame"]').getAttribute("data-tuplet-mark"), "broken");
    const heldSize = (await heldNotes()).size;
    check("...over fewer than three notes", heldSize < 3, true);

    await page.locator("#tuplet-remove").click();
    await page.waitForTimeout(300);
    const afterClear = await save();
    check("the ✕ clears a broken mark too", await drawnMarksNow(), markCountBefore - 1);
    check("...without deleting a note", afterClear.events.length, beforeClear.events.length);
    {
      // Every member went back to ×3/2 of what it was, and nothing else in the score moved.
      const changed = afterClear.events.filter((e) => {
        const was = beforeClear.events.find((b) => b.index === e.index)!.durationBeats;
        return was.num !== e.durationBeats.num || was.den !== e.durationBeats.den;
      });
      check("...changing exactly the mark's own notes", changed.length, heldSize);
      const ok = changed.every((e) => {
        const was = beforeClear.events.find((b) => b.index === e.index)!.durationBeats;
        return was.num * 3 * e.durationBeats.den === e.durationBeats.num * was.den * 2;
      });
      check("...each by exactly ³⁄₂", ok, true);
    }
    await page.locator("#undo").click();
    await page.waitForTimeout(300);
    check("one undo brings the broken mark back", JSON.stringify(await save()) === JSON.stringify(beforeClear), true);

    // THE REPAIR. Hold a broken mark that can be completed, and drag the handle onto the note the
    // page marks as the fix — `data-tuplet-fix` is on exactly the landings whose move CLOSES the
    // group, so the check drags where the UI points rather than at a hardcoded note.
    let repaired = false;
    for (const b of broken) {
      const hit = page.locator(`[data-omr="tuplet-mark-hit"][data-tuplet-group="${b}"]`);
      if ((await hit.count()) === 0) continue;
      await hit.scrollIntoViewIfNeeded();
      await hit.click();
      await page.waitForTimeout(250);
      const fix = await page.locator("[data-tuplet-fix]").evaluateAll((els) =>
        els.map((e) => ({
          idx: Number(e.getAttribute("data-omr-note")),
          edge: e.getAttribute("data-tuplet-landing")!,
        })),
      );
      if (fix.length === 0) continue;
      const target = fix[0]!;
      const edge = target.edge === "both" ? "end" : target.edge;
      const handle = page.locator(`[data-omr="tuplet-handle"][data-edge="${edge}"]`);
      const hb = (await handle.boundingBox())!;
      const tb = (await page.locator(`[data-omr-note="${target.idx}"]`).first().boundingBox())!;
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(tb.x + tb.width / 2, hb.y + hb.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(350);
      const held = await surface.getAttribute("data-tuplet-selected");
      check("dragging onto the marked note completes a broken triplet",
        await page.locator(`[data-omr="tuplet-mark-hit"][data-tuplet-group="${held}"]`).getAttribute("data-tuplet-mark"),
        "closed");
      check("...and it now covers three notes", (await heldNotes()).size, 3);
      repaired = true;
      break;
    }
    check("a broken mark was repairable on this page", repaired, true);
  }

  // Back to the score the rest of the file works on.
  await page.goto(`${base}/?score=/gamzedeyim-deva.json`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#app[data-ready]", { timeout: 20000 });
  await page.locator("#edit-toggle").click();
  await page.waitForTimeout(300);

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

  // --- the fingerboard tab: a violin position that follows the audio clock (F3, 2026-08-15) -----
  //
  // Three properties, none of which can be asked of the copy on the page:
  //   - the tab draws THIS score's pitches — the position lines are built from the timeline, so a
  //     score with notes must produce some, and they can be hidden and brought back;
  //   - while playing, the marker is on a real string at a position on the string;
  //   - it MOVES. An attribute reading "stopped" cannot prove the clock is driving anything, which
  //     is the same reason the sheet's playhead is asserted by position and not by existence.
  // The string-choice rule itself is NOT checked here: it is a pure function and a browser is the
  // wrong place to check arithmetic — see tools/core/fingering-test.ts.
  console.log("\nfingerboard tab (F3)");
  await page.goto(`${base}/?score=/gamzedeyim-deva.json`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });

  // --- the two instrument views are ONE page now, and the picker drives the sound (2026-08-29) --
  //
  // ⚠ The load-bearing assertion is the last one: picking an instrument here must move the
  // TRANSPORT's voice, because that is the whole reason the merge is worth more than tidiness —
  // you see and hear the same instrument without knowing two controls existed. A check that only
  // read this page's own attribute would pass on a picker wired to nothing but itself.
  await page.locator("#view-instrument").click();
  await page.waitForSelector("#instrument-view", { timeout: 10000 });
  check("the piano roll tab is gone", await page.locator("#view-roll").count(), 0);
  check("…and so are the two separate instrument tabs", await page.locator("#view-fingerboard, #view-kanun").count(), 0);
  check("one instrument page holds both", await page.locator("#instrument-pick").count(), 1);
  check("it opens on the violin", await page.getAttribute("#instrument-view", "data-instrument"), "violin");
  check("…drawing a violin and no kanun", await page.locator("#fingerboard").count() + await page.locator("#kanun").count() * 10, 1);

  await page.locator("#instrument-pick").selectOption("kanun");
  await page.waitForSelector("#kanun", { timeout: 10000 });
  check("picking Kanun swaps the drawing", await page.getAttribute("#instrument-view", "data-instrument"), "kanun");
  check("…and the violin goes away", await page.locator("#fingerboard").count(), 0);
  check("⭐ …and the SOUND follows it", await page.getAttribute("#instrument", "data-instrument"), "kanun");
  await page.locator("#instrument-pick").selectOption("violin");
  check("switching back moves the sound back", await page.getAttribute("#instrument", "data-instrument"), "violin");

  await openInstrument(page, "violin");

  check("four strings", await page.getAttribute("#fingerboard", "data-strings"), "4");
  check("standard tuning", await page.getAttribute("#fingerboard", "data-tuning"), "standard");
  // The chart is FIXED (owner, 2026-08-27, reversing the first version): it shows where a
  // violinist's fingers normally go, not this score's komas. So the assertion is not "some lines
  // exist" — it is that the same seven lines, at the same places, come back on a DIFFERENT piece.
  // A chart that quietly follows the music again would pass any weaker check.
  const chartOf = () =>
    page.locator('[data-omr="fingerboard-tick"]').evaluateAll((els) =>
      els.map((e) => `${e.getAttribute("data-commas")}@${e.getAttribute("data-ratio")}/${e.getAttribute("data-finger")}`),
    );
  const chart = await chartOf();
  console.log(`  chart: ${chart.join(" ")}`);
  check("seven standard note lines", chart.length, 7);
  check(
    "…at the first-position semitone places, each on its finger",
    chart,
    ["4@0.0510/1", "9@0.1110/1", "13@0.1563/2", "18@0.2098/2", "22@0.2500/3", "26@0.2883/3", "31@0.3333/4"],
  );
  // The lines are a reference the player can put away (owner, 2026-08-27). Asserted as DOM state
  // on both sides — the marks leave the SVG, and the container says so — because "the checkbox is
  // unchecked" would pass while the lines were still drawn.
  await page.locator("#fingerboard-lines").uncheck();
  check("the position lines can be hidden", await page.locator('[data-omr="fingerboard-tick"]').count(), 0);
  check("…and the view says so", await page.getAttribute("#fingerboard", "data-lines"), "off");
  await page.locator("#fingerboard-lines").check();
  check(
    "…and brought back",
    (await page.locator('[data-omr="fingerboard-tick"]').count()) > 0,
    true,
  );
  // The neck zoom (owner, 2026-08-27). Read as geometry, not as a class name: the viewBox IS the
  // zoom, so a check that only read `data-zoom` would pass on a control wired to nothing. It must
  // also stay INSIDE the full picture — a window bigger than the crop would be a zoom that showed
  // less, and it must be shorter, which is what makes it closer.
  const fullBox = (await page.getAttribute(".kv-fingerboard__svg", "viewBox"))!;
  await page.locator("#fingerboard-zoom").check();
  check("the zoom says which level it is on", await page.getAttribute("#fingerboard", "data-zoom"), "neck");
  const neckBox = (await page.getAttribute(".kv-fingerboard__svg", "viewBox"))!;
  const [fx, fy, fw, fh] = fullBox.split(/\s+/).map(Number) as [number, number, number, number];
  const [nx, ny, nw, nh] = neckBox.split(/\s+/).map(Number) as [number, number, number, number];
  console.log(`  viewBox: ${fullBox} → ${neckBox} (${(fh / nh).toFixed(2)}x)`);
  check("…and it really is closer", nh < fh && nw < fw, true);
  check("…on a window inside the picture", nx >= fx && ny >= fy && nx + nw <= fx + fw && ny + nh <= fy + fh, true);
  // The zoom may never crop a line away, whatever the piece does — a mark drawn outside the
  // viewBox is invisible, and invisible reads as a bug rather than as a crop.
  const ys = await page.locator('[data-omr="fingerboard-tick"]').evaluateAll((els) =>
    els.map((e) => Number((e as SVGLineElement).getAttribute("y1"))),
  );
  check("every standard note line is inside the zoom", ys.every((y) => y >= ny && y <= ny + nh), true);
  await page.locator("#fingerboard-zoom").uncheck();
  check("…and the whole violin comes back", await page.getAttribute(".kv-fingerboard__svg", "viewBox"), fullBox);

  // A different piece, in a different makam, with a different range: the chart must not move.
  await page.goto(`${base}/?score=/beyati-delisin.json`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });
  await openInstrument(page, "violin");
  check("the chart is the same on another piece", await chartOf(), chart);
  check(
    "the marker starts idle",
    await page.getAttribute('[data-omr="finger-marker"]', "data-finger-state"),
    "idle",
  );

  // Poll rather than sleep: the first Play also boots the AudioContext, which is why
  // `waitForPlayhead` above exists. Collect distinct positions until there are enough to prove
  // movement, or give up — a stuck marker must fail, not hang.
  await page.locator("#play").click();
  const fingerMarks: string[] = [];
  for (let i = 0; i < 40 && fingerMarks.length < 3; i++) {
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => {
      const d = document.querySelector('[data-omr="finger-marker"]');
      const state = d?.getAttribute("data-finger-state");
      return state === "open" || state === "stopped"
        ? `${d!.getAttribute("data-string")}@${d!.getAttribute("data-ratio")}`
        : null;
    });
    if (m && m !== fingerMarks[fingerMarks.length - 1]) fingerMarks.push(m);
  }
  await page.locator("#stop").click();
  console.log(`  marker: ${fingerMarks.join(" → ") || "never landed"}`);

  check("the marker lands on a string while playing", fingerMarks.length > 0, true);
  check("…and it moves with the music", fingerMarks.length >= 2, true);
  check(
    "…always on a string that exists",
    fingerMarks.every((m) => ["g", "d", "a", "e"].includes(m.split("@")[0]!)),
    true,
  );
  // A position is a fraction of the vibrating length, so anything outside [0, 1) is a geometry
  // bug rather than a fingering choice — it would draw the finger past the bridge.
  check(
    "…at a position ON the string",
    fingerMarks.every((m) => {
      const r = Number(m.split("@")[1]);
      return Number.isFinite(r) && r >= 0 && r < 1;
    }),
    true,
  );

  // --- the kanun tab: a course, and mandals that carry state (F3, 2026-08-29) -------------------
  //
  // ⚠ **The properties here are not the violin's, and the difference is the point.** A violin
  // position is a fact about one note; a mandal is a lever that STAYS WHERE IT IS PUT, so what this
  // has to prove is a state machine, not a lookup:
  //   - exactly ONE mandal per course is up, at every moment — the invariant the whole replay rests
  //     on, and the one a leak in the animation frame would break first;
  //   - the opening setting is read off THIS score (the violin's chart is fixed on purpose; this
  //     one must differ between pieces, which is the opposite assertion);
  //   - a course lights while it sounds, and the lit course moves;
  //   - a mandal change actually flashes, on the right course and at the right comma.
  // The planning arithmetic is NOT checked here — it is a pure function, and a browser is the wrong
  // place for arithmetic. See tools/core/kanun-test.ts.
  console.log("\nkanun tab (F3)");
  await page.goto(`${base}/?score=/meltem_notes.json`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });
  await openInstrument(page, "kanun");

  check("twenty-six courses", await page.getAttribute("#kanun", "data-courses"), "26");
  check("twelve mandals a course", await page.getAttribute("#kanun", "data-mandals"), "12");
  check("…so 312 levers are drawn", await page.locator('[data-omr="kanun-mandal"]').count(), 312);
  check("one course each", await page.locator('[data-omr="kanun-course"]').count(), 26);
  // ⚠ A perde is **three strings in unison** (owner, 2026-08-29), sharing one lever. Asserted as a
  // total rather than per course, because the failure worth catching is the view quietly going back
  // to one line each — which 26 would still satisfy.
  check("…drawn as three strings", await page.locator('[data-omr="kanun-course"] line').count(), 78);

  const upCount = () => page.locator('[data-omr="kanun-mandal"][data-mandal-state="up"]').count();
  check("exactly one lever up per course", await upCount(), 26);
  check("nothing is sounding yet", await page.getAttribute("#kanun", "data-note-state"), "idle");

  // The opening setting is the makam's mandals, which a player prepares before the first note. It
  // is read off the score, so it is asserted by VALUE — "some courses are listed" would pass on a
  // list built from nothing.
  const openingOf = () =>
    page.locator('[data-omr="kanun-opening-item"]').evaluateAll((els) =>
      els.map((e) => `${e.getAttribute("data-perde")}${e.getAttribute("data-offset")}`),
    );
  const meltemOpening = await openingOf();
  console.log(`  opening: ${meltemOpening.join(" ")}`);
  check(
    "the makam's opening mandals, off this score",
    meltemOpening,
    ["Dügâh-5", "Segâh-5", "Hüseynî-5", "Muhayyer-5", "Tiz Segâh-5"],
  );

  // The close-up. Read as geometry like the violin's, and with one extra property this view needs:
  // the window must keep the full view's SHAPE, or an <svg> letterboxes it and crops rows away.
  const kFull = (await page.getAttribute(".kv-kanun__svg", "viewBox"))!;
  await page.locator("#kanun-zoom").check();
  check("the close-up says which level it is on", await page.getAttribute("#kanun", "data-zoom"), "mandal");
  const kNeck = (await page.getAttribute(".kv-kanun__svg", "viewBox"))!;
  const [kfx, kfy, kfw, kfh] = kFull.split(/\s+/).map(Number) as [number, number, number, number];
  const [knx, kny, knw, knh] = kNeck.split(/\s+/).map(Number) as [number, number, number, number];
  console.log(`  viewBox: ${kFull} → ${kNeck} (${(kfw / knw).toFixed(2)}x)`);
  check("…and it really is closer", knw < kfw && knh < kfh, true);
  check("…on a window inside the instrument", knx >= kfx && kny >= kfy, true);
  check(
    "…keeping the full view's shape, so no row is cropped away",
    Math.abs(knw / knh - kfw / kfh) < 0.01,
    true,
  );
  await page.locator("#kanun-zoom").uncheck();
  check("…and the whole kanun comes back", await page.getAttribute(".kv-kanun__svg", "viewBox"), kFull);

  // Playing. meltem is eleven seconds long and moves a mandal at 5.3 s (Hüseynî, five komas flat →
  // one), which is why it is the piece used here rather than a long one.
  await page.locator("#play").click();
  const litCourses: string[] = [];
  const noteStates = new Set<string>();
  const upCounts = new Set<number>();
  const flashed: string[] = [];
  for (let i = 0; i < 80 && flashed.length === 0; i++) {
    await page.waitForTimeout(120);
    noteStates.add((await page.getAttribute("#kanun", "data-note-state")) ?? "?");
    upCounts.add(await upCount());
    const c = await page.evaluate(() => {
      const el = document.querySelector('[data-omr="kanun-course"][data-course-state="playing"]');
      return el ? el.getAttribute("data-perde") : null;
    });
    if (c && c !== litCourses[litCourses.length - 1]) litCourses.push(c);
    const f = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-omr="kanun-mandal"][data-changed="to"]')).map(
        (e) => `${e.getAttribute("data-course")}@${e.getAttribute("data-offset")}`,
      ),
    );
    flashed.push(...f);
  }
  await page.locator("#stop").click();
  console.log(`  courses lit: ${litCourses.join(" → ") || "never"}`);
  console.log(`  flashed    : ${flashed.join(" ") || "never"}`);

  check("a course lights while it sounds", litCourses.length > 0, true);
  check("…and the lit course moves with the music", litCourses.length >= 2, true);
  // ⚠ THE INVARIANT. One lever up per course, at every single sample taken across the playback —
  // this is what says the replay moves the mandals rather than accumulating them.
  check("one lever up per course throughout", [...upCounts], [26]);
  check("the view says a note is sounding", noteStates.has("playing"), true);
  // The change flash, asserted by WHICH course and WHICH comma — a count would pass on a flash
  // fired at the wrong lever. Hüseynî is course 15, moving to one koma flat.
  check("a mandal change flashes", flashed.length > 0, true);
  check("…on the course and comma the music asks for", flashed[0], "15@-1");

  // A different piece must produce a DIFFERENT opening setting. ⚠ This is the exact opposite of
  // the violin check above, and deliberately so: the violin's chart is a fixed reference and must
  // not follow the music, while the kanun's mandals ARE the music's own setting and must.
  await page.goto(`${base}/?score=/beyati-delisin.json`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });
  await openInstrument(page, "kanun");
  const beyatiOpening = await openingOf();
  console.log(`  opening: ${beyatiOpening.join(" ")}`);
  check("another piece sets its own mandals", beyatiOpening, ["Segâh-2"]);
  check("one lever up per course here too", await upCount(), 26);

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
