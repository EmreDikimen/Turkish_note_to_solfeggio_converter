/**
 * What breaks on a phone? — opens the real app in a phone-sized browser and MEASURES.
 *
 * Not a checker with a verdict; a probe. It reports the three things a phone bug actually looks
 * like in the DOM: the page scrolls sideways, a control is too small to hit with a thumb, or a
 * fixed box covers the thing under it. Screenshots go beside it so the owner can look.
 *
 *   npx tsx <this file>
 */
import { chromium, devices } from "playwright";
import { createServer } from "vite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const SHOTS = process.env.PHONE_SHOTS ?? path.join(ROOT, "tmp/phone-shots");

/** A phone, a small phone, and a tablet — the three shapes the friends will actually hold. */
const SIZES = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-14", width: 390, height: 844 },
  { name: "pixel-7", width: 412, height: 915 },
  { name: "ipad-mini", width: 744, height: 1133 },
];

/**
 * Wait until the page is actually the page this probe means to measure.
 *
 * Two things can be untrue at the moment `data-ready` appears, and BOTH of them make a fixed bug
 * report as broken — the direction of error that costs a debugging round, because it points at a
 * real file and a real rule and says something false about them. Each cost one here.
 *
 *  1. **The stylesheet is not in yet.** Vite serves CSS in dev as a JS module that injects a
 *     <style> tag, so the app can render before its design tokens exist. `--control-h` is the
 *     sentinel: it comes from tokens.css, the first file in the chain.
 *
 *  2. **The touch emulation has lapsed.** On the FIRST context of a run, Chromium stops reporting
 *     `(pointer: coarse)` somewhere around the third navigation — `matchMedia` flips back to a
 *     mouse and every touch rule in app.css switches off with it. It showed up as one viewport out
 *     of four failing a fix that the other three, running identical code, passed. A reload puts it
 *     back. (Burning a throwaway context first does NOT — that was tried.)
 *
 * If the second reload still reports a mouse the probe says so at the top of the block rather than
 * printing sizes it cannot stand behind.
 */
async function settle(page: import("playwright").Page, ready?: string) {
  const styled = () =>
    page.waitForFunction(
      () => getComputedStyle(document.documentElement).getPropertyValue("--control-h").trim() !== "",
      null,
      { timeout: 20000 },
    );
  if (ready) await page.waitForSelector(ready, { timeout: 60000 });
  await styled();
  if (await page.evaluate(() => matchMedia("(pointer: coarse)").matches)) return;
  await page.reload({ waitUntil: "domcontentloaded" });
  if (ready) await page.waitForSelector(ready, { timeout: 60000 });
  await styled();
}

/** Everything the DOM can say about "this does not fit a phone". */
async function measure(page: import("playwright").Page, label: string, vw: number) {
  const r = await page.evaluate((vw) => {
    const de = document.documentElement;
    // Anything whose ink crosses the right edge of the viewport. `getBoundingClientRect` is in
    // viewport coordinates, so this is literally "off the screen", scroll included.
    const over: { sel: string; right: number; width: number }[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.overflowX === "auto" || cs.overflowX === "scroll" || cs.overflowX === "hidden") continue;
      // Report the OUTERMOST offender only: a parent that overflows drags all its children out too.
      if (b.right > vw + 1 || b.left < -1) {
        const par = el.parentElement;
        if (par) {
          const pb = par.getBoundingClientRect();
          if (pb.right > vw + 1 || pb.left < -1) continue;
          // ⚠ And skip anything sitting INSIDE a sideways scroller. The engraved sheet is wider
          // than any phone on purpose — `.kv-score` scrolls it sideways in its own box, which is
          // the design and is load-bearing (no transform may ever be put on that container; it is
          // what training strips are cut from). Reported as a finding it is noise that never goes
          // away, and noise that never goes away is how a reader learns to skip the list.
          // ⚠ **ANY ancestor, not just the parent** (2026-09-05). `SheetView` wraps its surface in
          // a plain <div>, so the scroller is the GRANDparent — which is why `div#sheet-surface`
          // was reported on every run despite this skip existing, and why the measure card's
          // `#measure-surface` joined it. A box the page cannot scroll to is not off the screen.
          let anc: HTMLElement | null = par;
          let clipped = false;
          while (anc && anc !== de) {
            const as = getComputedStyle(anc);
            if (as.overflowX === "auto" || as.overflowX === "scroll" || as.overflowX === "hidden") {
              clipped = true;
              break;
            }
            anc = anc.parentElement;
          }
          if (clipped) continue;
        }
        over.push({
          sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""),
          right: Math.round(b.right),
          width: Math.round(b.width),
        });
      }
    }
    // Tap targets. Apple asks 44x44, Google 48x48; anything under 32 is a genuine miss on a thumb.
    const small: { sel: string; w: number; h: number }[] = [];
    const hittable = "button, a, input, select, label, summary, [role=button]";
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(hittable))) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (getComputedStyle(el).opacity === "0") continue;
      // ⚠ The clipped file inputs are 1×1 ON PURPOSE and must stay that way — `#page-input` and
      // `#strips-input` are driven by `setInputFiles`, and the clip pattern (not `display: none`)
      // is what keeps them in the accessibility tree. Their visible target is the label wrapping
      // them. Reporting them every run is how a reader learns to skim past the whole list.
      if (el.closest(".kv-visually-hidden")) continue;
      if (b.width < 32 || b.height < 32) {
        small.push({
          sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/)[0] : ""),
          w: Math.round(b.width), h: Math.round(b.height),
        });
      }
    }
    // Any font under 16px inside a focusable text/number field makes iOS Safari ZOOM the page on
    // focus, and it never zooms back. It is the single most common "the site is broken on my
    // phone" report there is.
    const zoomers: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLInputElement>("input, select, textarea"))) {
      const t = (el.getAttribute("type") ?? "text").toLowerCase();
      if (["checkbox", "radio", "range", "file", "hidden", "button", "submit"].includes(t)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) zoomers.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}=${fs}px`);
    }
    return {
      // ⚠ Read at the MOMENT of measurement, not once per context. Half the findings below are
      // answered by rules behind `(pointer: coarse)`, so a stale emulation makes a fixed bug
      // report as broken — and it did, on the first context of the run, for exactly one viewport.
      coarse: matchMedia("(pointer: coarse)").matches,
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      over: over.slice(0, 12),
      small: small.slice(0, 20),
      smallN: small.length,
      zoomers,
    };
  }, vw);

  const sideways = r.scrollW > r.clientW + 1;
  console.log(`\n  [${label}]`);
  if (!r.coarse) console.log(`    ⚠ THIS PAGE THINKS IT HAS A MOUSE — the touch rules are off, ignore the sizes below`);
  console.log(`    sideways scroll : ${sideways ? `YES — ${r.scrollW}px of page in a ${r.clientW}px screen` : "no"}`);
  if (r.over.length) {
    console.log(`    off the screen  :`);
    for (const o of r.over) console.log(`        ${o.sel}  (right edge ${o.right}px, ${o.width}px wide)`);
  }
  if (r.smallN) {
    console.log(`    small targets   : ${r.smallN} under 32px`);
    const seen = new Set<string>();
    for (const s of r.small) { const k = `${s.sel} ${s.w}x${s.h}`; if (!seen.has(k)) { seen.add(k); console.log(`        ${k}`); } }
  }
  if (r.zoomers.length) console.log(`    iOS zoom on tap : ${r.zoomers.join(", ")}`);
  return r;
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();

  for (const size of SIZES) {
    const ctx = await browser.newContext({
      ...devices["iPhone 13"],
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    console.log(`\n═══ ${size.name}  ${size.width}×${size.height} ═══`);

    // 1. The first screen: no score, the upload prompt.
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await settle(page);
    await measure(page, "upload screen", size.width);
    // ⚠ NOT `fullPage: true`, and this is the cause of the emulation lapse documented on `settle`.
    // A full-page shot makes Chromium resize the viewport to the document's height and it does not
    // put the touch emulation back afterwards — so every measurement AFTER this line came back as
    // though the phone had a mouse. It only ever showed on the 667px screen, because that is the
    // only one whose upload page is taller than its viewport and therefore the only one the
    // screenshot actually had to resize. A viewport shot is what a phone shows anyway.
    await page.screenshot({ path: `${SHOTS}/${size.name}-1-upload.png` });

    // 2. A score loaded — the transport, the card, the music.
    await page.goto(`${base}/?score=/gamzedeyim-deva.json`, { waitUntil: "domcontentloaded" });
    await settle(page, '#app[data-ready="1"]');
    await page.waitForTimeout(600);
    await measure(page, "score loaded", size.width);
    await page.screenshot({ path: `${SHOTS}/${size.name}-2-score.png`, fullPage: false });

    // 3. Edit mode — the floating toolbox is the thing most likely to be off the screen.
    await page.locator("#edit-toggle").click();
    await page.waitForTimeout(400);
    const tb = await page.locator("#edit-palette").boundingBox();
    console.log(`    toolbox box     : ${tb ? `x=${Math.round(tb.x)} y=${Math.round(tb.y)} ${Math.round(tb.width)}×${Math.round(tb.height)}${tb.x + tb.width > size.width ? "  ← OFF THE RIGHT EDGE" : ""}${tb.y + tb.height > size.height ? "  ← BELOW THE SCREEN" : ""}` : "not found"}`);
    await measure(page, "edit mode", size.width);
    await page.screenshot({ path: `${SHOTS}/${size.name}-3-edit.png`, fullPage: false });

    // 4. The instrument tab (the kanun is the widest drawing in the app).
    await page.locator("#view-instrument").click();
    await page.waitForSelector("#instrument-view", { timeout: 10000 });
    await page.locator("#instrument-pick").selectOption("kanun");
    await page.waitForSelector("#kanun", { timeout: 10000 });
    await page.waitForTimeout(400);
    await measure(page, "kanun", size.width);
    await page.screenshot({ path: `${SHOTS}/${size.name}-4-kanun.png`, fullPage: false });

    await ctx.close();
  }

  await browser.close();
  await server.close();
  console.log(`\nscreenshots → ${SHOTS}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
