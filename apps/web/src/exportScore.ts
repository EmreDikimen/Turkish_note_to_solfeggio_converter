/**
 * Save the score — as a PNG the app draws, or as a PDF the browser prints.
 *
 * ⚠ **NEITHER EXPORTS WHAT IS ON SCREEN** (owner, 2026-09-27: *"genişlik normal nota kağıdı
 * genişliğinde olmalı… dikeylemesine çok uzun ve bulanık"*). On a 393px phone the score is engraved
 * 324px wide with two bars to a system, so a photograph of the screen is a **324×7820 ribbon** —
 * right for a thumb, wrong for paper. Both exports read a hidden stage instead, where `App` has
 * engraved the same document at the engraver's own default width: four bars to a system, the look a
 * printed edition has.
 *
 * ⚠ **TWO DIFFERENT MECHANISMS, DELIBERATELY.** The PNG is a picture and the app draws it. A PDF of
 * a 60-system score wants to be VECTOR and PAGINATED, and the browser does both from DOM — so the
 * PDF path builds a print sheet and calls `window.print()`, costing the build 0 bytes against
 * ~350 KB for a library that would produce one blurry page.
 *
 * ⛔ **Nothing here reads or writes `doc`.** Export is a picture of what is drawn; the note model has
 * its own seam (`window.__omrDoc`) and the app publishes no score file (docs/DECISIONS.md).
 */

/** The hidden paper-width engraving both exports read. Mounted by `App` only while one is running. */
export const EXPORT_STAGE_ID = "export-stage";
/** Where the print sheet is built. Present only while the browser's print dialog is open. */
const PRINT_ID = "print-sheet";

const FONT_URL = "/fonts/Bravura.woff2";

/**
 * The most pixels one canvas may hold.
 *
 * ⚠ Not tidiness: iOS Safari refuses a canvas past roughly this area and returns a BLANK image
 * rather than an error — a save button that silently produces nothing. A long score is the normal
 * case here, so the scale is chosen to fit this budget instead of being fixed at 2.
 */
const MAX_CANVAS_PX = 16_000_000;

let fontCache: string | null = null;

/** Wait for the stage `App` just mounted to be drawn. Polls, because a VexFlow layout of a few
 *  hundred notes takes as long as the reader's machine takes; gives up rather than hanging. */
export async function waitForStage(timeoutMs = 2000): Promise<HTMLElement> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const el = document.getElementById(EXPORT_STAGE_ID);
    if (el?.querySelector("svg .vf-stave")) return el;
    if (Date.now() > deadline) throw new Error("the score could not be engraved for export");
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

/**
 * Bravura as a base64 `data:` URI.
 *
 * ⚠ **Without this every notehead, clef and accidental exports as a blank box.** An SVG drawn into
 * an `<img>` is its own document: it cannot reach the page's stylesheet, and a `@font-face` naming a
 * URL is not fetched from inside an image. The font has to travel with the markup. 247 KB, fetched
 * once per session and only when someone exports — it is already a file the app serves.
 */
async function fontDataUri(): Promise<string | null> {
  if (fontCache != null) return fontCache;
  try {
    const res = await fetch(FONT_URL);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    // ⚠ In chunks: `String.fromCharCode(...buf)` on 247 KB overflows the argument list and throws.
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    fontCache = `data:font/woff2;base64,${btoa(bin)}`;
    return fontCache;
  } catch {
    return null;
  }
}

/**
 * The engraved caption above the staves — its own HTML element, not part of the SVG.
 *
 * ⚠ Found from the SVG BACKWARDS. VexFlow nests its `<svg>` below the surface, and reading the first
 * child of the score box hands back the WHOLE SCORE — measured, 744 lines of Bravura codepoints,
 * which a canvas then drew as 744 rows of empty boxes.
 *
 * ⚠ **The wide header is three COLUMNS, so reading its text in DOM order is the wrong order.** The
 * stage is 1100px, which is the three-column form: usul and tempo on the left, the makam/form and
 * the title in the middle, the composer on the right. Straight `innerText` therefore opened the
 * export with *"Sofyan ♩ = 80"* as its headline. The columns are read individually and recomposed
 * the way the narrow header already stacks them: title, subtitle, then the small line.
 */
function headerLines(svg: SVGSVGElement): string[] {
  const surface = svg.closest("[id]");
  const head = surface?.previousElementSibling as HTMLElement | null;
  if (!head || head.tagName !== "DIV") return [];

  const cols = [...head.children] as HTMLElement[];
  if (cols.length === 3) {
    const text = (el: HTMLElement | undefined) =>
      (el?.innerText ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    const [left, middle, right] = [text(cols[0]), text(cols[1]), text(cols[2])];
    const foot = [left.join(" "), right.join(" ")].filter(Boolean).join(" · ");
    return [...middle, foot].filter(Boolean).slice(0, 4);
  }

  const lines = head.innerText.split("\n").map((l) => l.trim()).filter(Boolean);
  // ⚠ A guard, not a formality: anything longer means the wrong element was found again, and no
  // caption beats a page of boxes.
  return lines.length <= 4 ? lines : [];
}

/**
 * Where each staff system starts and ends, in the SVG's own units.
 *
 * ⚠ **Measured off the drawn staves, never from `ROW_HEIGHT`.** The row pitch is the engraver's
 * business and this file must not hold a second copy of it; a band is the gap between one stave and
 * the next, split down the middle so a high note or a beam above a stave travels with it.
 */
function systemBands(svg: SVGSVGElement): { y: number; h: number }[] {
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const unitsPerPx = vb && vb.height ? vb.height / box.height : 1;
  const raw = [...svg.querySelectorAll<SVGGraphicsElement>(".vf-stave")]
    .map((el) => (el.getBoundingClientRect().top - box.top) * unitsPerPx)
    .sort((a, b) => a - b);
  // One entry per ROW, not per measure: a row's staves all sit at the same y.
  const tops: number[] = [];
  for (const y of raw) if (!tops.length || y - tops[tops.length - 1]! > 8) tops.push(y);
  if (!tops.length) return [];
  const total = vb && vb.height ? vb.height : box.height;
  return tops.map((top, i) => {
    const prev = i === 0 ? 0 : (tops[i - 1]! + top) / 2;
    const next = i === tops.length - 1 ? total : (top + tops[i + 1]!) / 2;
    return { y: prev, h: Math.max(1, next - prev) };
  });
}

/** A clone of the drawing that can stand on its own: the font travels with it. */
async function portableClone(svg: SVGSVGElement): Promise<SVGSVGElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const font = await fontDataUri();
  if (font) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `@font-face{font-family:"Bravura";src:url("${font}") format("woff2");}`;
    clone.insertBefore(style, clone.firstChild);
  }
  return clone;
}

function safeName(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 80);
  return base || "nota";
}

/** Draw the paper-width engraving to a PNG and hand it to the browser to save. */
export async function exportScorePng(stage: HTMLElement, pageName: string): Promise<void> {
  const svg = stage.querySelector("svg");
  if (!svg) throw new Error("no score to save");

  const w = Math.max(1, Math.round(svg.getBoundingClientRect().width));
  const h = Math.max(1, Math.round(svg.getBoundingClientRect().height));
  const lines = headerLines(svg);
  const headH = lines.length ? 22 + lines.length * 26 : 0;
  const pad = 24;

  const clone = await portableClone(svg);
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const markup = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("the drawing could not be read back"));
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`;
  });

  const pageW = w + pad * 2;
  const pageH = h + headH + pad * 2;
  const scale = Math.max(1, Math.min(2, Math.sqrt(MAX_CANVAS_PX / (pageW * pageH))));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(pageW * scale);
  canvas.height = Math.round(pageH * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.scale(scale, scale);
  // Paper, not transparency: a score saved transparent is invisible in every dark viewer.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pageW, pageH);

  if (lines.length) {
    ctx.fillStyle = "#1b1f2e"; // tokens.css --ink (Tezhip)
    ctx.textAlign = "center";
    lines.forEach((line, i) => {
      ctx.font = `${i === 0 ? "bold " : ""}italic ${i === 0 ? 22 : 17}px Georgia, "Times New Roman", serif`;
      ctx.fillText(line, pageW / 2, pad + 22 + i * 26);
    });
  }
  ctx.drawImage(img, pad, pad + headH, w, h);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("the image could not be saved");

  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${safeName(pageName)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // ⚠ Not revoked at once: Safari reads the blob after the click returns.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/**
 * Build a print sheet — ONE ELEMENT PER STAFF SYSTEM — and hand it to the browser.
 *
 * ⭐ **This is why a system is no longer cut in half at a page break** (owner, 2026-09-27). Printing
 * the score's single tall `<svg>` gives the browser nothing to break BETWEEN: it slices wherever the
 * page ends, through staves. Each system becomes its own `<svg>` here, windowed by a `viewBox` onto
 * the same drawing, inside a block that carries `break-inside: avoid` — so the page break lands in
 * the gap between two systems, which is where an engraver would put it.
 *
 * ⚠ The sheet is removed after printing. `afterprint` is the signal; a timer backs it up, because
 * the event does not fire on every browser when the dialog is dismissed.
 */
export async function exportScorePdf(stage: HTMLElement): Promise<void> {
  const svg = stage.querySelector("svg");
  if (!svg) throw new Error("no score to print");

  document.getElementById(PRINT_ID)?.remove();
  const sheet = document.createElement("div");
  sheet.id = PRINT_ID;

  const lines = headerLines(svg);
  if (lines.length) {
    const head = document.createElement("div");
    head.className = "kv-print__head";
    for (const [i, line] of lines.entries()) {
      const el = document.createElement(i === 0 ? "h1" : "p");
      el.textContent = line;
      head.appendChild(el);
    }
    sheet.appendChild(head);
  }

  const clone = await portableClone(svg);
  const vb = svg.viewBox.baseVal;
  const width = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
  for (const band of systemBands(svg)) {
    const one = clone.cloneNode(true) as SVGSVGElement;
    one.setAttribute("viewBox", `0 ${band.y} ${width} ${band.h}`);
    one.setAttribute("width", "100%");
    one.removeAttribute("height");
    one.setAttribute("preserveAspectRatio", "xMidYMin meet");
    one.removeAttribute("style");
    const row = document.createElement("div");
    row.className = "kv-print__row";
    row.appendChild(one);
    sheet.appendChild(row);
  }

  document.body.appendChild(sheet);
  const clean = () => {
    document.getElementById(PRINT_ID)?.remove();
    window.removeEventListener("afterprint", clean);
  };
  window.addEventListener("afterprint", clean);
  setTimeout(clean, 60_000);

  // ⚠ One frame, so the sheet is laid out before the dialog takes its snapshot.
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  window.print();
}
