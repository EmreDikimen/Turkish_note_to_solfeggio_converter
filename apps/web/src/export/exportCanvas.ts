/**
 * Draw the engraved score straight onto a canvas, shape by shape — no SVG image in between.
 *
 * ⭐ **Why (2026-10-17, the same Samsung tester, the day after `exportOutline.ts`).** With the glyphs
 * outlined, the PDF stopped being blank — but the music came out FADED GREY while the caption, drawn
 * on the same canvas with `fillText`, stayed dark. Everything that went through an SVG `<img>` was
 * lightened; nothing drawn on the canvas directly was. A browser may treat an image however it likes
 * (a "dark mode" that recolours images is the leading suspect, unproven), and most of the score's
 * paths carry no colour of their own — they take it from the app's stylesheet, which an image cannot
 * see. So nothing here is an image: each `<path>`, `<rect>` and `<text>` is replayed through the
 * canvas 2D API with the colour, width and opacity the BROWSER computed for it on screen, and the
 * music glyphs are filled from their outlines. A canvas fill is the one thing that came out right.
 *
 * ⚠ It handles what the score is made of — measured 2026-10-17 on four scores: `g`, `path`, `rect`,
 * `text`, `title`, nothing else — plus the other basic shapes, cheaply. Any other drawable element
 * (`image`, `use`, a gradient fill…) is REPORTED in `unsupported`, and the caller falls back to the
 * image route rather than silently dropping it.
 */
import { glyphRuns, isMusicText } from "./exportOutline";

type Paint = { fill: string | null; stroke: string | null };

interface ShapeOp {
  kind: "shape";
  m: DOMMatrix;
  path: Path2D;
  paint: Paint;
  fillRule: CanvasFillRule;
  lineWidth: number;
  cap: CanvasLineCap;
  join: CanvasLineJoin;
  miter: number;
  dash: number[];
  fillAlpha: number;
  strokeAlpha: number;
}

interface TextOp {
  kind: "text";
  m: DOMMatrix;
  text: string;
  x: number;
  y: number;
  font: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  fill: string;
  alpha: number;
}

export interface CanvasDrawing {
  /** Replay every shape under `base` (drawing units → canvas pixels). */
  draw(ctx: CanvasRenderingContext2D, base: DOMMatrix): void;
  /** Drawable elements this replayer does not know; non-empty means "use the image route". */
  unsupported: string[];
  /** Music-font texts that could not be outlined and are drawn with the page's font instead. */
  unoutlined: number;
}

/** Tags that draw nothing themselves. */
const STRUCTURAL = new Set(["svg", "g", "title", "desc", "style", "metadata", "a"]);
/** Tags whose CONTENT draws nothing (definitions, referenced from elsewhere). */
const INERT = new Set(["defs", "clipPath", "mask", "pattern", "linearGradient", "radialGradient", "symbol", "marker", "filter"]);

const paintOf = (v: string): string | null => (!v || v === "none" ? null : v.startsWith("url(") ? "url" : v);

/** Collect the drawing from the live, laid-out `svg` — the one the reader's screen engraved. */
export async function prepareCanvasDrawing(svg: SVGSVGElement): Promise<CanvasDrawing> {
  const rootInv = svg.getScreenCTM()?.inverse();
  if (!rootInv) return { draw: () => {}, unsupported: ["no screen matrix"], unoutlined: 0 };

  const all = [...svg.querySelectorAll<SVGElement>("*")];
  const musicTexts = all.filter((el): el is SVGTextElement => el instanceof SVGTextElement && isMusicText(el));
  const runs = await glyphRuns(musicTexts);

  // An element's opacity applies to everything under it; `opacity` is not inherited, so multiply.
  const alphaOf = new Map<Element, number>([[svg, 1]]);
  const hidden = new Set<Element>();
  const alpha = (el: Element): number => {
    const known = alphaOf.get(el);
    if (known !== undefined) return known;
    const cs = getComputedStyle(el);
    const up = el.parentNode as Element | null; // `parentElement` is typed HTML-only
    const parent = up && up !== svg ? alpha(up) : 1;
    if (cs.display === "none" || (up && hidden.has(up))) hidden.add(el);
    const a = parent * (parseFloat(cs.opacity) || 0);
    alphaOf.set(el, a);
    return a;
  };

  const ops: (ShapeOp | TextOp)[] = [];
  const unsupported = new Set<string>();
  let unoutlined = 0;

  for (const el of all) {
    const tag = el.tagName;
    if (el.closest([...INERT].join(","))) continue;
    if (STRUCTURAL.has(tag)) {
      alpha(el);
      continue;
    }
    if (el.closest("text") !== el && el.closest("text")) continue; // a tspan: its text draws it
    const a = alpha(el);
    const cs = getComputedStyle(el);
    if (hidden.has(el) || a === 0 || cs.visibility === "hidden") continue;
    const screen = (el as SVGGraphicsElement).getScreenCTM?.();
    if (!screen) continue;
    const m = DOMMatrix.fromMatrix(rootInv.multiply(screen));
    const fill = paintOf(cs.fill);
    const stroke = paintOf(cs.stroke);
    if (fill === "url" || stroke === "url") {
      unsupported.add(`${tag} with a paint server`);
      continue;
    }

    if (el instanceof SVGTextElement) {
      const run = runs.get(el);
      if (run) {
        for (const g of run)
          ops.push(shape(m.translate(g.x, g.y).scale(g.s, -g.s), new Path2D(g.d), { fill: fill ?? "#000", stroke: null }, cs, a));
        continue;
      }
      if (isMusicText(el)) unoutlined++;
      if (!fill) continue;
      const first = (l: SVGAnimatedLengthList) => (l.baseVal.numberOfItems ? l.baseVal.getItem(0).value : 0);
      ops.push({
        kind: "text",
        m,
        text: el.textContent ?? "",
        x: first(el.x) + first(el.dx),
        y: first(el.y) + first(el.dy),
        font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
        align: ({ middle: "center", end: "right" } as Record<string, CanvasTextAlign>)[cs.textAnchor] ?? "left",
        baseline:
          ({ middle: "middle", central: "middle", hanging: "hanging", "text-before-edge": "top", "text-after-edge": "bottom", ideographic: "ideographic" } as Record<string, CanvasTextBaseline>)[cs.dominantBaseline] ?? "alphabetic",
        fill,
        alpha: a * (parseFloat(cs.fillOpacity) || 0),
      });
      continue;
    }

    const path = shapePath(el);
    if (!path) {
      unsupported.add(tag);
      continue;
    }
    if (fill || stroke) ops.push(shape(m, path, { fill, stroke }, cs, a));
  }

  return {
    unsupported: [...unsupported],
    unoutlined,
    draw(ctx, base) {
      for (const op of ops) {
        ctx.setTransform(base.multiply(op.m));
        if (op.kind === "text") {
          ctx.globalAlpha = op.alpha;
          ctx.font = op.font;
          ctx.textAlign = op.align;
          ctx.textBaseline = op.baseline;
          ctx.fillStyle = op.fill;
          ctx.fillText(op.text, op.x, op.y);
          continue;
        }
        if (op.paint.fill) {
          ctx.globalAlpha = op.fillAlpha;
          ctx.fillStyle = op.paint.fill;
          ctx.fill(op.path, op.fillRule);
        }
        if (op.paint.stroke && op.lineWidth > 0) {
          ctx.globalAlpha = op.strokeAlpha;
          ctx.strokeStyle = op.paint.stroke;
          ctx.lineWidth = op.lineWidth;
          ctx.lineCap = op.cap;
          ctx.lineJoin = op.join;
          ctx.miterLimit = op.miter;
          ctx.setLineDash(op.dash);
          ctx.stroke(op.path);
        }
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    },
  };
}

function shape(m: DOMMatrix, path: Path2D, paint: Paint, cs: CSSStyleDeclaration, a: number): ShapeOp {
  const dash = cs.strokeDasharray && cs.strokeDasharray !== "none" ? cs.strokeDasharray.split(/[\s,]+/).map(parseFloat).filter(Number.isFinite) : [];
  return {
    kind: "shape",
    m,
    path,
    paint,
    fillRule: cs.fillRule === "evenodd" ? "evenodd" : "nonzero",
    lineWidth: parseFloat(cs.strokeWidth) || 0,
    cap: (cs.strokeLinecap as CanvasLineCap) || "butt",
    join: (cs.strokeLinejoin as CanvasLineJoin) || "miter",
    miter: parseFloat(cs.strokeMiterlimit) || 4,
    dash,
    fillAlpha: a * (parseFloat(cs.fillOpacity) || 0),
    strokeAlpha: a * (parseFloat(cs.strokeOpacity) || 0),
  };
}

/** The outline of a basic shape, in its own user space; `null` for anything that is not one. */
function shapePath(el: SVGElement): Path2D | null {
  const n = (name: string) => parseFloat(el.getAttribute(name) ?? "0") || 0;
  const p = new Path2D();
  switch (el.tagName) {
    case "path":
      return new Path2D(el.getAttribute("d") ?? "");
    case "rect": {
      const [x, y, w, h] = [n("x"), n("y"), n("width"), n("height")];
      const r = Math.min(n("rx") || n("ry"), w / 2, h / 2);
      if (r > 0 && typeof p.roundRect === "function") p.roundRect(x, y, w, h, r);
      else p.rect(x, y, w, h);
      return p;
    }
    case "line":
      p.moveTo(n("x1"), n("y1"));
      p.lineTo(n("x2"), n("y2"));
      return p;
    case "circle":
      p.arc(n("cx"), n("cy"), n("r"), 0, Math.PI * 2);
      return p;
    case "ellipse":
      p.ellipse(n("cx"), n("cy"), n("rx"), n("ry"), 0, 0, Math.PI * 2);
      return p;
    case "polyline":
    case "polygon": {
      const pts = (el.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(parseFloat);
      for (let i = 0; i + 1 < pts.length; i += 2) (i ? p.lineTo : p.moveTo).call(p, pts[i]!, pts[i + 1]!);
      if (el.tagName === "polygon") p.closePath();
      return p;
    }
    default:
      return null;
  }
}
