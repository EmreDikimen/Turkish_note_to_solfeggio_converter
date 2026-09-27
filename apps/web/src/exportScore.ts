/**
 * Save the score that is on screen — as a PNG the app draws, or as a PDF the browser prints.
 *
 * ⚠ **TWO DIFFERENT MECHANISMS, AND THAT IS THE POINT** (owner, 2026-09-27). A PNG is a picture and
 * the app can make one. A PDF of a 60-system page wants to be VECTOR and PAGINATED, and the browser
 * already does both perfectly from the DOM it is showing — so `exportScorePdf` hands the job to
 * `window.print()` behind a print stylesheet rather than rasterising a page into a library. That
 * costs the deployable build **0 bytes**; the alternative was ~350 KB for a blurry one-page PDF.
 * ⚠ The cost, accepted and stated on screen: printing opens the OS sheet, so saving a PDF is two
 * taps, not one.
 *
 * ⛔ **Nothing here reads or writes `doc`.** Export is a picture of what is drawn; the note model has
 * its own seam (`window.__omrDoc`) and the app deliberately publishes no score file
 * (docs/DECISIONS.md, 2026-08-08).
 */

/** Where the music font lives. ⚠ Same path as `base.css`'s `@font-face`; if one moves, both move. */
const FONT_URL = "/fonts/Bravura.woff2";

/**
 * The most pixels one canvas may hold.
 *
 * ⚠ Not a tidiness number: iOS Safari refuses a canvas past roughly this area and returns a BLANK
 * image rather than an error, which would be a save button that silently produces nothing. A long
 * score is the normal case here — 60 systems is 324×7820 CSS px — so the scale is chosen to fit
 * this budget rather than fixed at 2.
 */
const MAX_CANVAS_PX = 16_000_000;

let fontCache: string | null = null;

/**
 * Bravura as a base64 `data:` URI.
 *
 * ⚠ **Without this every notehead, clef and accidental exports as a blank box.** An SVG drawn into
 * an `<img>` is its own document: it cannot reach the page's stylesheet, and a `@font-face` naming
 * a URL is not fetched from inside an image. The font has to travel with the markup.
 * ⚠ 247 KB, fetched once per session and only when someone actually exports — it is already a
 * static file the app serves, so this adds nothing to the bundle.
 */
async function fontDataUri(): Promise<string | null> {
  if (fontCache != null) return fontCache;
  try {
    const res = await fetch(FONT_URL);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    // ⚠ In chunks: `String.fromCharCode(...buf)` on 247 KB overflows the argument list and throws.
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    fontCache = `data:font/woff2;base64,${btoa(bin)}`;
    return fontCache;
  } catch {
    return null;
  }
}

/**
 * The engraved header sitting above the staves — its own HTML element, not part of the SVG.
 *
 * ⚠ **Found from the SVG BACKWARDS, never from the top of `.kv-score`.** `SheetView` wraps the
 * header and the surface together, so `.kv-score`'s first child is that wrapper and reading its
 * text hands back the WHOLE SCORE: measured, 744 lines of Bravura codepoints, which the canvas then
 * drew as 744 rows of empty boxes in a serif font and added 16,386px of height to the export. The
 * surface is the element the drawing lives in; the header is whatever sits immediately before it.
 */
function headerLines(svg: SVGSVGElement): string[] {
  // ⚠ `closest("[id]")`, not `parentElement`: VexFlow nests its `<svg>` a level below the surface,
  // so the parent is an unnamed div and the header is nowhere near it. The surface is the nearest
  // ancestor that carries an id (`sheet-surface` on the page, `measure-surface` in the card).
  const surface = svg.closest("[id]");
  const head = surface?.previousElementSibling as HTMLElement | null;
  if (!head || head.tagName !== "DIV") return [];
  const lines = head.innerText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  // ⚠ A guard, not a formality: this is a caption of two or three lines, and anything longer means
  // the wrong element was found again. Better no caption than a page of boxes.
  return lines.length <= 4 ? lines : [];
}

/** A file name a phone's Downloads list can be read: the page's own name, punctuation removed. */
function safeName(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 80);
  return base || "nota";
}

/**
 * Draw the score to a PNG and hand it to the browser to save.
 *
 * Throws on failure so the caller can say so — a save button that does nothing and reports nothing
 * is the worst of the three outcomes.
 */
export async function exportScorePng(pageName: string): Promise<void> {
  const box = document.querySelector<HTMLElement>(".kv-score");
  const svg = box?.querySelector("svg");
  if (!box || !svg) throw new Error("no score on screen");

  // ⚠ The DISPLAYED size, not the attributes: a dense page is drawn smaller than its layout
  // (docs/features/phone.md), and the export should be what the reader is looking at.
  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  const lines = headerLines(svg);
  const headH = lines.length ? 18 + lines.length * 22 : 0;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  // ⚠ A viewBox is what makes the clone independent of the page's own scaling. The fitted pages
  // already carry one; a page that never needed fitting does not, so it gets its layout box.
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${svg.getAttribute("width") ?? w} ${svg.getAttribute("height") ?? h}`);
  }
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const font = await fontDataUri();
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent =
    (font ? `@font-face{font-family:"Bravura";src:url("${font}") format("woff2");}` : "") +
    // ⚠ The engraver sets `font-family` per element, so this only has to supply the fallback for
    // anything that named a family the image cannot resolve.
    `text{font-kerning:none;}`;
  clone.insertBefore(style, clone.firstChild);

  const markup = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("the drawing could not be read back"));
    img.src = url;
  });

  const total = w * (h + headH);
  const scale = Math.max(1, Math.min(2, Math.sqrt(MAX_CANVAS_PX / total)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round((h + headH) * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.scale(scale, scale);
  // Paper, not transparency: a score saved with a transparent background is invisible in every
  // dark viewer it is opened in.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h + headH);

  if (lines.length) {
    ctx.fillStyle = "#1a1614";
    ctx.textAlign = "center";
    lines.forEach((line, i) => {
      ctx.font = `${i === 0 ? "bold " : ""}italic ${i === 0 ? 17 : 14}px Georgia, "Times New Roman", serif`;
      ctx.fillText(line, w / 2, 24 + i * 22);
    });
  }
  ctx.drawImage(img, 0, headH, w, h);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("the image could not be saved");

  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${safeName(pageName)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // ⚠ Not revoked immediately: Safari reads the blob after the click returns.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/**
 * Hand the page to the browser's printer, which is where a vector, paginated PDF comes from.
 *
 * ⚠ All the work is in `@media print` (`app.css`): everything but the score is hidden and the
 * drawing is released from the width it was fitted to, so the paper decides the size.
 */
export function exportScorePdf(): void {
  window.print();
}
