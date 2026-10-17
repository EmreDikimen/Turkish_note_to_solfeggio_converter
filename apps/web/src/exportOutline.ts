/**
 * Replace every music-font glyph in an exported score with its outline, so the export needs no font.
 *
 * ⭐ **Why (2026-10-17, a tester's Samsung phone, Samsung Internet 30 inside the Play app).** VexFlow 5
 * draws noteheads, clefs, accidentals and time signatures as `<text>` in the music font. The PNG
 * export draws the SVG into an `<img>` with the font embedded as a `data:` URI — and a browser is
 * NOT obliged to use a web font inside an image. Chrome does; Samsung Internet did not, and the
 * tester's PNG showed staves and stems with no noteheads. Paths are drawn the same by every engine,
 * so after this step the exported SVG depends on nothing but the browser's ability to fill a path.
 *
 * The outlines are `public/fonts/glyph-outlines/<hh>.json`, written by
 * `scripts/prepare_glyph_outlines.py` from the same font file — one file per 256 code points, fetched
 * only for the blocks a score actually uses, and only when someone saves.
 *
 * ⚠ **Positions are MEASURED off the live drawing, not re-derived.** `x`/`y` give the pen position of
 * a plain left-aligned, alphabetic-baseline glyph; anything else (`text-anchor`, `dominant-baseline`,
 * both of which `SheetView` sets on its own glyphs) is resolved by asking the browser where it put
 * the text against a probe drawn without them. So the outline lands where the screen drew the glyph,
 * whatever rule the engine used.
 *
 * ⚠ A glyph whose block cannot be fetched, or which is not in it, stays `<text>` — the export then
 * falls back to the embedded font for that one element rather than losing it.
 */

const NS = "http://www.w3.org/2000/svg";
const BASE = "/fonts/glyph-outlines/";
/** The family VexFlow and `SheetView` draw music in. Matched inside the computed `font-family`. */
const MUSIC_FONT = /bravura/i;

interface Block {
  upm: number;
  g: Record<string, [number, string]>;
}

const blocks = new Map<number, Promise<Block | null>>();

/** One block of outlines, fetched once per session. A failure is remembered as `null`, not retried. */
function block(n: number): Promise<Block | null> {
  let p = blocks.get(n);
  if (!p) {
    p = fetch(`${BASE}${n.toString(16).padStart(2, "0")}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Block>) : null))
      .catch(() => null);
    blocks.set(n, p);
  }
  return p;
}

const codePoints = (s: string) => Array.from(s, (c) => c.codePointAt(0)!);

/**
 * Outline `clone` in place, measuring each glyph off `live` — the drawn SVG `clone` was deep-cloned
 * from, so their `<text>` elements correspond one to one, in order. Returns how many music-font
 * `<text>` elements are LEFT (0 when every glyph was outlined).
 */
export async function outlineGlyphs(live: SVGSVGElement, clone: SVGSVGElement): Promise<number> {
  const liveTexts = [...live.querySelectorAll<SVGTextElement>("text")];
  const cloneTexts = [...clone.querySelectorAll<SVGTextElement>("text")];
  if (liveTexts.length !== cloneTexts.length) return liveTexts.length; // not a clone of `live`

  const music = liveTexts
    .map((el, i) => ({ el, copy: cloneTexts[i]!, cs: getComputedStyle(el) }))
    .filter((t) => MUSIC_FONT.test(t.cs.fontFamily) && t.el.textContent);

  const needed = new Set<number>();
  for (const t of music) for (const cp of codePoints(t.el.textContent!)) needed.add(cp >> 8);
  const loaded = new Map<number, Block | null>();
  await Promise.all([...needed].map(async (n) => loaded.set(n, await block(n))));

  let left = 0;
  for (const { el, copy, cs } of music) {
    const cps = codePoints(el.textContent!);
    const glyphs = cps.map((cp) => loaded.get(cp >> 8)?.g[cp.toString(16)]);
    const upm = loaded.get(cps[0]! >> 8)?.upm;
    const size = parseFloat(cs.fontSize);
    if (!upm || !Number.isFinite(size) || glyphs.some((g) => !g)) {
      left++;
      continue;
    }

    const xs = el.x.baseVal;
    const ys = el.y.baseVal;
    const x0 = (xs.numberOfItems ? xs.getItem(0).value : 0) + (el.dx.baseVal.numberOfItems ? el.dx.baseVal.getItem(0).value : 0);
    const y0 = (ys.numberOfItems ? ys.getItem(0).value : 0) + (el.dy.baseVal.numberOfItems ? el.dy.baseVal.getItem(0).value : 0);
    const [dx, dy] = alignmentShift(el, cs);

    const g = document.createElementNS(NS, "g");
    const transform = copy.getAttribute("transform");
    if (transform) g.setAttribute("transform", transform);
    g.setAttribute("fill", cs.fill && cs.fill !== "none" ? cs.fill : "#000");
    if (cs.opacity && cs.opacity !== "1") g.setAttribute("opacity", cs.opacity);
    if (cs.fillOpacity && cs.fillOpacity !== "1") g.setAttribute("fill-opacity", cs.fillOpacity);

    const s = size / upm;
    let pen = 0;
    for (const [advance, d] of glyphs as [number, string][]) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      // font units are y-UP; the baseline is the glyph's origin
      path.setAttribute("transform", `translate(${x0 + dx + pen} ${y0 + dy}) scale(${s} ${-s})`);
      g.appendChild(path);
      pen += advance * s;
    }
    copy.replaceWith(g);
  }
  return left;
}

/**
 * How far the browser moved this text for its `text-anchor` and `dominant-baseline`, measured
 * against a probe of the same text drawn left-aligned on the alphabetic baseline. `getBBox` of a
 * text is its glyph cells, so the difference between the two boxes IS the shift.
 */
function alignmentShift(el: SVGTextElement, cs: CSSStyleDeclaration): [number, number] {
  const anchor = cs.textAnchor || "start";
  const base = cs.dominantBaseline || "auto";
  if ((anchor === "start" || anchor === "") && (base === "auto" || base === "alphabetic")) return [0, 0];
  const probe = el.cloneNode(true) as SVGTextElement;
  probe.setAttribute("text-anchor", "start");
  probe.setAttribute("dominant-baseline", "alphabetic");
  probe.style.textAnchor = "start";
  probe.style.dominantBaseline = "alphabetic";
  el.parentNode!.insertBefore(probe, el);
  try {
    const a = el.getBBox();
    const b = probe.getBBox();
    return [a.x - b.x, a.y - b.y];
  } finally {
    probe.remove();
  }
}
