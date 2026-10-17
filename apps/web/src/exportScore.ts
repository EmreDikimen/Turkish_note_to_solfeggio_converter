/**
 * Save the score — as a PNG or as a paginated PDF, both drawn by the app.
 *
 * ⚠ **NEITHER EXPORTS WHAT IS ON SCREEN** (owner, 2026-09-27: *"genişlik normal nota kağıdı
 * genişliğinde olmalı… dikeylemesine çok uzun ve bulanık"*). On a 393px phone the score is engraved
 * 324px wide with two bars to a system, so a photograph of the screen is a **324×7820 ribbon** —
 * right for a thumb, wrong for paper. Both exports read a hidden stage instead, where `App` has
 * engraved the same document at the engraver's own default width: four bars to a system, the look a
 * printed edition has.
 *
 * ⭐ **ONE MECHANISM, AND IT ASKS THE BROWSER FOR AS LITTLE AS POSSIBLE** (2026-10-17). Until then
 * the PDF was `window.print()` and the PNG drew the SVG into an image with the music font embedded.
 * A tester's Samsung phone (Samsung Internet 30, inside the Play app) printed a BLANK page and saved
 * a PNG with no noteheads — both steps rest on behaviour a browser is free to skip: a print engine
 * of its own, and web fonts inside an image. Now the glyphs are outlined (`exportOutline.ts`), every
 * page is drawn on a canvas of a size every engine accepts, and the PDF file is written here, byte by
 * byte. What is left — fill a path, encode a PNG, follow a download link — every browser does.
 *
 * ⚠ The PDF is therefore an IMAGE per A4 page (200 dpi, lossless), not vector: the owner chose
 * "the same on every phone" over "sharp at any zoom" (docs/DECISIONS.md, 2026-10-17).
 *
 * ⛔ **Nothing here reads or writes `doc`.** Export is a picture of what is drawn; the note model has
 * its own seam (`window.__omrDoc`) and the app publishes no score file (docs/DECISIONS.md).
 */

import { outlineGlyphs } from "./exportOutline";

/** The hidden paper-width engraving both exports read. Mounted by `App` only while one is running. */
export const EXPORT_STAGE_ID = "export-stage";
const FONT_URL = "/fonts/Bravura.woff2";

/**
 * The most pixels one canvas may hold, and the longest side it may have.
 *
 * ⚠ Not tidiness: past these a browser returns a BLANK or cropped image rather than an error — iOS
 * Safari at roughly this area, and some engines at a side length of 16,384 or 32,767 whatever the
 * area. A long score is the normal case, and a 1,100 px-wide score is a tall thin canvas, so BOTH are
 * enforced; the area alone let a long score's height run past the side limit.
 */
const MAX_CANVAS_PX = 16_000_000;
const MAX_CANVAS_SIDE = 16_384;

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
 * Bravura as a base64 `data:` URI — the FALLBACK for a glyph `exportOutline.ts` could not outline.
 *
 * An SVG drawn into an `<img>` is its own document: it cannot reach the page's stylesheet, and a
 * `@font-face` naming a URL is not fetched from inside an image, so the font has to travel with the
 * markup. ⚠ Even then a browser may ignore it — Samsung Internet did (2026-10-17) — which is why
 * this is only reached when an outline is missing, never relied on. 247 KB, fetched only then.
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

/**
 * A clone of the drawing that can stand on its own: every music glyph outlined, and the font
 * embedded only if some glyph could not be (see `fontDataUri`).
 */
async function portableClone(svg: SVGSVGElement): Promise<SVGSVGElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const left = await outlineGlyphs(svg, clone);
  // A checks-only hook, like `__omrDoc`: how many music glyphs still need the font (0 = none), so
  // `tools/browser/export-check.ts` can prove the export no longer depends on it.
  (window as unknown as { __omrExportLeft?: number }).__omrExportLeft = left;
  if (left > 0) {
    const font = await fontDataUri();
    if (font) {
      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = `@font-face{font-family:"Bravura";src:url("${font}") format("woff2");}`;
      clone.insertBefore(style, clone.firstChild);
    }
  }
  return clone;
}

function safeName(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 80);
  return base || "nota";
}

/** The drawing's own coordinate box: its `viewBox`, or its laid-out size when it has none. */
function userBox(svg: SVGSVGElement): { w: number; h: number; pxW: number; pxH: number } {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const pxW = Math.max(1, Math.round(r.width));
  const pxH = Math.max(1, Math.round(r.height));
  return vb && vb.width && vb.height ? { w: vb.width, h: vb.height, pxW, pxH } : { w: pxW, h: pxH, pxW, pxH };
}

/**
 * Rasterise a window `[y0, y0 + h)` of the drawing at `outW × outH` pixels.
 *
 * ⚠ The window is a `viewBox` on its own copy, and the image is decoded at the size it will be
 * drawn: an engine asked to scale an SVG image at draw time may rasterise it at its intrinsic size
 * first and then blur it up. `decode()` is awaited because `onload` does not promise the pixels
 * are ready to draw on every engine.
 */
async function rasterWindow(
  clone: SVGSVGElement,
  w: number,
  y0: number,
  h: number,
  outW: number,
  outH: number
): Promise<HTMLImageElement> {
  const one = clone.cloneNode(true) as SVGSVGElement;
  one.setAttribute("viewBox", `0 ${y0} ${w} ${h}`);
  one.setAttribute("width", String(outW));
  one.setAttribute("height", String(outH));
  one.setAttribute("preserveAspectRatio", "none");
  one.removeAttribute("style");
  const markup = new XMLSerializer().serializeToString(one);
  const img = new Image();
  img.width = outW;
  img.height = outH;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("the drawing could not be read back"));
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`;
  });
  try {
    await img.decode();
  } catch {
    /* `onload` already fired; an engine whose decode() rejects here still has the pixels */
  }
  return img;
}

/** A canvas filled with paper — white, never transparent (invisible in every dark viewer). */
function paper(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

/** The caption, centred, in the system serif — a canvas uses the page's fonts, so no web font. */
function drawHeader(ctx: CanvasRenderingContext2D, lines: string[], centreX: number, top: number, k: number): void {
  ctx.fillStyle = "#1b1f2e"; // tokens.css --ink (Tezhip)
  ctx.textAlign = "center";
  lines.forEach((line, i) => {
    ctx.font = `${i === 0 ? "bold " : ""}italic ${(i === 0 ? 22 : 17) * k}px Georgia, "Times New Roman", serif`;
    ctx.fillText(line, centreX, top + (22 + i * 26) * k);
  });
}

const headerHeight = (lines: string[]) => (lines.length ? 22 + lines.length * 26 : 0);

/** Hand a file to the browser to save. */
function download(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // ⚠ Not revoked at once: Safari reads the blob after the click returns.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/** Draw the paper-width engraving to a PNG and hand it to the browser to save. */
export async function exportScorePng(stage: HTMLElement, pageName: string): Promise<void> {
  const svg = stage.querySelector("svg");
  if (!svg) throw new Error("no score to save");

  const box = userBox(svg);
  const lines = headerLines(svg);
  const headH = headerHeight(lines);
  const pad = 24;
  const pageW = box.pxW + pad * 2;
  const pageH = box.pxH + headH + pad * 2;
  const scale = Math.max(
    0.25,
    Math.min(2, Math.sqrt(MAX_CANVAS_PX / (pageW * pageH)), MAX_CANVAS_SIDE / pageW, MAX_CANVAS_SIDE / pageH)
  );

  const clone = await portableClone(svg);
  const outW = Math.round(box.pxW * scale);
  const outH = Math.round(box.pxH * scale);
  const img = await rasterWindow(clone, box.w, 0, box.h, outW, outH);

  const { canvas, ctx } = paper(Math.round(pageW * scale), Math.round(pageH * scale));
  if (lines.length) drawHeader(ctx, lines, canvas.width / 2, pad * scale, scale);
  ctx.drawImage(img, Math.round(pad * scale), Math.round((pad + headH) * scale), outW, outH);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("the image could not be saved");
  download(blob, `${safeName(pageName)}.png`);
}

// ── PDF ─────────────────────────────────────────────────────────────────────────────────────────

/** A4 in PDF points, and the resolution each page is drawn at. */
const A4_PT = { w: 595.28, h: 841.89 };
const DPI = 200;
const MARGIN_MM = 12;

/**
 * Lay the staff systems onto A4 pages, top to bottom, never cutting one in half — the rule the
 * print sheet's `break-inside: avoid` used to enforce. A system taller than a page (it does not
 * happen at four bars a row) gets a page of its own and is drawn smaller.
 */
function paginate(bands: { y: number; h: number }[], firstAvail: number, avail: number): { y: number; h: number }[] {
  const pages: { y: number; h: number }[] = [];
  let cur: { y: number; h: number } | null = null;
  for (const b of bands) {
    const room = pages.length === 0 ? firstAvail : avail;
    if (cur && cur.h + b.h <= room) cur.h = b.y + b.h - cur.y;
    else {
      if (cur) pages.push(cur);
      cur = { y: b.y, h: b.h };
    }
  }
  if (cur) pages.push(cur);
  return pages;
}

/**
 * Draw the paper-width engraving onto A4 pages and save them as one PDF.
 *
 * Each page is its own canvas (1,654 × 2,339 px at 200 dpi — far inside every engine's limits),
 * stored as an 8-bit grey image compressed with the browser's own `CompressionStream`, or as JPEG
 * where that stream does not exist. `pdfFile` below writes the container.
 */
export async function exportScorePdf(stage: HTMLElement, pageName: string): Promise<void> {
  const svg = stage.querySelector("svg");
  if (!svg) throw new Error("no score to save");

  const box = userBox(svg);
  const lines = headerLines(svg);
  const pagePx = { w: Math.round((A4_PT.w / 72) * DPI), h: Math.round((A4_PT.h / 72) * DPI) };
  const margin = Math.round((MARGIN_MM / 25.4) * DPI);
  const contentW = pagePx.w - 2 * margin;
  const k = contentW / box.w; // page pixels per drawing unit
  const headPx = headerHeight(lines) * k;
  const availFirst = (pagePx.h - 2 * margin - headPx) / k;
  const avail = (pagePx.h - 2 * margin) / k;

  const bands = systemBands(svg);
  const pages = paginate(bands.length ? bands : [{ y: 0, h: box.h }], availFirst, avail);
  const clone = await portableClone(svg);

  const images: PdfImage[] = [];
  for (const [i, pg] of pages.entries()) {
    const room = i === 0 ? availFirst : avail;
    const fit = Math.min(1, room / pg.h); // only an oversize system is shrunk
    const outW = Math.round(contentW * fit);
    const outH = Math.max(1, Math.round(pg.h * k * fit));
    const img = await rasterWindow(clone, box.w, pg.y, pg.h, outW, outH);

    const { canvas, ctx } = paper(pagePx.w, pagePx.h);
    let top = margin;
    if (i === 0 && lines.length) {
      drawHeader(ctx, lines, pagePx.w / 2, margin, k);
      top += headPx;
    }
    ctx.drawImage(img, margin + Math.round((contentW - outW) / 2), Math.round(top), outW, outH);
    images.push(await pageImage(canvas));
  }
  download(pdfFile(images, pageName), `${safeName(pageName)}.pdf`);
}

interface PdfImage {
  width: number;
  height: number;
  /** what follows `/Filter` and `/ColorSpace` in the image dictionary */
  filter: "FlateDecode" | "DCTDecode";
  colorSpace: "DeviceGray" | "DeviceRGB";
  bytes: Uint8Array;
}

/** One page canvas → the bytes a PDF image stream holds. */
async function pageImage(canvas: HTMLCanvasElement): Promise<PdfImage> {
  const { width, height } = canvas;
  if (typeof CompressionStream !== "undefined") {
    const rgba = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
    const grey = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < grey.length; i++, p += 4)
      grey[i] = Math.round(0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!);
    // "deflate" is the zlib format, which is what /FlateDecode means
    const stream = new Blob([grey]).stream().pipeThrough(new CompressionStream("deflate"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return { width, height, filter: "FlateDecode", colorSpace: "DeviceGray", bytes };
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  if (!blob) throw new Error("the page could not be encoded");
  return { width, height, filter: "DCTDecode", colorSpace: "DeviceRGB", bytes: new Uint8Array(await blob.arrayBuffer()) };
}

/** A PDF text string that survives any title: UTF-16BE with a byte-order mark, in hex. */
function pdfText(s: string): string {
  let hex = "FEFF";
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

/**
 * Write the PDF: a catalog, a page tree, and per page a page object, its content stream (draw the
 * image over the whole sheet) and the image. Every offset in the cross-reference table is a byte
 * count, so the file is assembled as bytes, never as one string.
 */
function pdfFile(images: PdfImage[], title: string): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === "string" ? enc.encode(b) : b;
    parts.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, body: string) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker comment
  const pageNums = images.map((_, i) => 4 + i * 3);
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${images.length} >>`);
  obj(3, `<< /Title ${pdfText(title || "nota")} /Producer (KomaVision) >>`);
  const W = A4_PT.w.toFixed(2);
  const H = A4_PT.h.toFixed(2);
  images.forEach((im, i) => {
    const [page, content, image] = [pageNums[i]!, pageNums[i]! + 1, pageNums[i]! + 2];
    obj(
      page,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
        `/Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`
    );
    const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(content, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    offsets[image] = length;
    push(
      `${image} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} ` +
        `/ColorSpace /${im.colorSpace} /BitsPerComponent 8 /Filter /${im.filter} /Length ${im.bytes.length} >>\nstream\n`
    );
    push(im.bytes);
    push("\nendstream\nendobj\n");
  });

  const count = 4 + images.length * 3;
  const xref = length;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}
