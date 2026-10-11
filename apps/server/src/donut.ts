/**
 * DonutImageProcessor's geometry, ported to plain TypeScript for the server's page path.
 *
 * ⚠ This IS a second resampler, which `apps/web/src/omr/pixels.ts` explains the server was built to
 * avoid. It exists because the native app (docs/mobile/plan.md) sends whole pages, and the server
 * then owns the crop → 409×583 step that the browser's canvas does for `/decode`. It is held to a
 * stricter bar than the canvas ever was: the canvas draw is "not PIL BILINEAR" (a measured gap), and
 * this file is a transliteration of what training actually ran —
 *
 *   transformers `DonutImageProcessor.preprocess` (4.57): align_long_axis → resize (BILINEAR) →
 *   thumbnail (BICUBIC — see step 3) → pad
 *   Pillow `Image.resize` (12.x) + `libImaging/Resample.c` + `libImaging/Reduce.c`
 *
 * — so its parity target is BIT-IDENTICAL to Python, checked by `tools/vision/parity/donut-parity.ts`.
 * Do not "simplify" any rounding below; each one is a C cast or a Python `int()`.
 *
 * Grayscale in, grayscale out: training opened every strip with `.convert("RGB")`, so the three
 * channels are equal and Pillow resamples each with the same 8-bit arithmetic used here once.
 */

/** A single-channel 8-bit image (same shape as the slicer's `Gray`). */
export interface Plane {
  data: Uint8Array;
  width: number;
  height: number;
}

/** `libImaging/Resample.c`: `PRECISION_BITS = 32 - 8 - 2`. */
const PRECISION_BITS = 22;

/** A Pillow resampling filter: `Resample.c`'s function and its support. */
export interface Filter {
  fn: (x: number) => number;
  support: number;
}

/** `Resampling.BILINEAR` (2) — what `resample: 2` in the checkpoint's config names. */
export const BILINEAR: Filter = {
  fn: (x) => {
    if (x < 0) x = -x;
    return x < 1 ? 1 - x : 0;
  },
  support: 1.0,
};

/** `Resampling.BICUBIC` (3), a = −0.5 — what `thumbnail` actually runs (see `donutPreprocess`). */
export const BICUBIC: Filter = {
  fn: (x) => {
    const a = -0.5;
    if (x < 0) x = -x;
    if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
    if (x < 2) return (((x - 5) * x + 8) * x - 4) * a;
    return 0;
  },
  support: 2.0,
};

/** `precompute_coeffs` + `normalize_coeffs_8bpc`. */
function coeffs(
  inSize: number,
  in0: number,
  in1: number,
  outSize: number,
  filter: Filter
): { ksize: number; bounds: Int32Array; kk: Int32Array } {
  // ⚠ `in0`/`in1` are C `float`s in Resample.c, and so is their difference: a fractional box
  // (every `reduce()` leaves one) loses its low bits here, and that moved 1–4 pixels on 3 of 1,200
  // strips until it was copied (2026-10-11).
  in0 = Math.fround(in0);
  in1 = Math.fround(in1);
  const scale = Math.fround(in1 - in0) / outSize;
  const filterscale = scale < 1 ? 1 : scale;
  const support = filter.support * filterscale;
  const ksize = Math.ceil(support) * 2 + 1;
  const bounds = new Int32Array(outSize * 2);
  const pre = new Float64Array(outSize * ksize);
  for (let xx = 0; xx < outSize; xx++) {
    const center = in0 + (xx + 0.5) * scale;
    const ss = 1 / filterscale;
    let xmin = Math.trunc(center - support + 0.5);
    if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5);
    if (xmax > inSize) xmax = inSize;
    xmax -= xmin;
    let ww = 0;
    for (let x = 0; x < xmax; x++) {
      const w = filter.fn((x + xmin - center + 0.5) * ss);
      pre[xx * ksize + x] = w;
      ww += w;
    }
    for (let x = 0; x < xmax; x++) if (ww !== 0) pre[xx * ksize + x]! /= ww;
    bounds[xx * 2] = xmin;
    bounds[xx * 2 + 1] = xmax;
  }
  const kk = new Int32Array(outSize * ksize);
  const one = 1 << PRECISION_BITS;
  for (let i = 0; i < kk.length; i++) {
    const v = pre[i]!;
    kk[i] = v < 0 ? Math.trunc(-0.5 + v * one) : Math.trunc(0.5 + v * one);
  }
  return { ksize, bounds, kk };
}

function clip8(v: number): number {
  if (v >= 1 << PRECISION_BITS << 8) return 255;
  if (v <= 0) return 0;
  return v >> PRECISION_BITS;
}

/**
 * `ImagingResample` for an 8-bit plane over a (possibly fractional) source box —
 * `ImagingResampleInner`: horizontal pass over only the rows the vertical pass will read, then the
 * vertical pass. Each pass runs only when that axis actually changes, exactly as in C.
 */
function resampleBox(
  src: Plane,
  outW: number,
  outH: number,
  box: readonly [number, number, number, number],
  filter: Filter
): Plane {
  const needH = outW !== src.width || box[0] !== 0 || box[2] !== outW;
  const needV = outH !== src.height || box[1] !== 0 || box[3] !== outH;
  if (!needH && !needV) return { data: src.data.slice(), width: src.width, height: src.height };

  const horiz = coeffs(src.width, box[0], box[2], outW, filter);
  const vert = coeffs(src.height, box[1], box[3], outH, filter);
  const yFirst = vert.bounds[0]!;
  const yLast = vert.bounds[outH * 2 - 2]! + vert.bounds[outH * 2 - 1]!;

  let cur = src;
  if (needH) {
    for (let i = 0; i < outH; i++) vert.bounds[i * 2]! -= yFirst;
    const h = yLast - yFirst;
    const out = new Uint8Array(outW * h);
    const half = 1 << (PRECISION_BITS - 1);
    for (let yy = 0; yy < h; yy++) {
      const row = (yy + yFirst) * src.width;
      for (let xx = 0; xx < outW; xx++) {
        const xmin = horiz.bounds[xx * 2]!;
        const xmax = horiz.bounds[xx * 2 + 1]!;
        const k = xx * horiz.ksize;
        let ss = half;
        for (let x = 0; x < xmax; x++) ss += src.data[row + x + xmin]! * horiz.kk[k + x]!;
        out[yy * outW + xx] = clip8(ss);
      }
    }
    cur = { data: out, width: outW, height: h };
  }
  if (needV) {
    const w = cur.width;
    const out = new Uint8Array(w * outH);
    const half = 1 << (PRECISION_BITS - 1);
    for (let yy = 0; yy < outH; yy++) {
      const ymin = vert.bounds[yy * 2]!;
      const ymax = vert.bounds[yy * 2 + 1]!;
      const k = yy * vert.ksize;
      for (let xx = 0; xx < w; xx++) {
        let ss = half;
        for (let y = 0; y < ymax; y++) ss += cur.data[(y + ymin) * w + xx]! * vert.kk[k + y]!;
        out[yy * w + xx] = clip8(ss);
      }
    }
    cur = { data: out, width: w, height: outH };
  }
  return cur;
}

/** `division_UINT32(divider, 8)` from `Reduce.c`: a C float division, truncated. */
function reduceMultiplier(divider: number): number {
  return Math.trunc(Math.fround(Math.fround(4294967296) / Math.fround(256 * divider)));
}

/** `(ss * multiplier) >> 24` on UINT32, overflow included. */
function reduceOut(ss: number, multiplier: number): number {
  return Math.floor((ss * multiplier) % 4294967296 / 16777216);
}

/**
 * `ImagingReduce` (+ `ImagingReduceCorners`) for an 8-bit plane: box-average `xs × ys` blocks of
 * the source box, with a smaller average over the ragged last column/row. `box` is Pillow's
 * (x0, y0, x1, y1), converted to (x, y, w, h) the way `_imaging.c`'s `_reduce` does.
 */
function reduce(src: Plane, xs: number, ys: number, b: readonly [number, number, number, number]): Plane {
  const [bx, by] = [b[0], b[1]];
  const bw = b[2] - b[0];
  const bh = b[3] - b[1];
  const outW = Math.floor((bw + xs - 1) / xs);
  const outH = Math.floor((bh + ys - 1) / ys);
  const out = new Uint8Array(outW * outH);
  const W = src.width;
  const block = (x0: number, x1: number, y0: number, y1: number): number => {
    const scale = (x1 - x0) * (y1 - y0);
    let ss = Math.floor(scale / 2);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) ss += src.data[yy * W + xx]!;
    return reduceOut(ss, reduceMultiplier(scale));
  };
  const fullW = Math.floor(bw / xs);
  const fullH = Math.floor(bh / ys);
  for (let y = 0; y < outH; y++) {
    const y0 = by + y * ys;
    const y1 = y < fullH ? y0 + ys : by + bh;
    for (let x = 0; x < outW; x++) {
      const x0 = bx + x * xs;
      const x1 = x < fullW ? x0 + xs : bx + bw;
      out[y * outW + x] = block(x0, x1, y0, y1);
    }
  }
  return { data: out, width: outW, height: outH };
}

/**
 * `Image.resize(size, filter, reducing_gap=…)` — Pillow's Python wrapper around the C resample:
 * the copy shortcut, the optional `reduce()` pre-pass with its safe box, and the two-step path for
 * an image more than 100× taller than wide.
 */
export function pilResize(
  src: Plane,
  outW: number,
  outH: number,
  filter: Filter,
  reducingGap: number | null = null
): Plane {
  let box: [number, number, number, number] = [0, 0, src.width, src.height];
  if (src.width === outW && src.height === outH)
    return { data: src.data.slice(), width: src.width, height: src.height };

  let im = src;
  if (reducingGap !== null) {
    const fx = Math.trunc((box[2] - box[0]) / outW / reducingGap) || 1;
    const fy = Math.trunc((box[3] - box[1]) / outH / reducingGap) || 1;
    if (fx > 1 || fy > 1) {
      // `_get_safe_box`: the filter's support less half a pixel
      const sx = (filter.support - 0.5) * ((box[2] - box[0]) / outW);
      const sy = (filter.support - 0.5) * ((box[3] - box[1]) / outH);
      const rb: [number, number, number, number] = [
        Math.max(0, Math.trunc(box[0] - sx)),
        Math.max(0, Math.trunc(box[1] - sy)),
        Math.min(im.width, Math.ceil(box[2] + sx)),
        Math.min(im.height, Math.ceil(box[3] + sy)),
      ];
      im = reduce(im, fx, fy, rb);
      box = [(box[0] - rb[0]) / fx, (box[1] - rb[1]) / fy, (box[2] - rb[0]) / fx, (box[3] - rb[1]) / fy];
    }
  }
  if (im.height > im.width * 100 && outH < im.height) {
    const tmp = resampleBox(im, im.width, outH, [0, box[1], im.width, box[3]], filter);
    return resampleBox(tmp, outW, outH, [box[0], 0, box[2], outH], filter);
  }
  return resampleBox(im, outW, outH, box, filter);
}

/** `np.rot90(image, 3)`: 90° clockwise. out[i][j] = in[H−1−j][i]. */
function rot90cw(src: Plane): Plane {
  const { width: W, height: H } = src;
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) out[i * H + j] = src.data[(H - 1 - j) * W + i]!;
  return { data: out, width: H, height: W };
}

/**
 * A crop → the model's 409×583 input, as interleaved RGBA (R = G = B, A = 255) — the exact bytes
 * `pixelsFromRGBA` expects, so the server feeds this straight into `decodePage`.
 */
export function donutPreprocess(crop: Plane, targetW: number, targetH: number): Uint8Array {
  let img = crop;
  // 1. align_long_axis
  if ((targetW < targetH && img.width > img.height) || (targetW > targetH && img.width < img.height))
    img = rot90cw(img);

  // 2. resize: shortest edge → min(target), `get_resize_output_image_size` (no reducing gap)
  const shortestEdge = Math.min(targetH, targetW);
  const short = Math.min(img.width, img.height);
  const long = Math.max(img.width, img.height);
  const newLong = Math.trunc((shortestEdge * long) / short);
  const [rw, rh] = img.width <= img.height ? [shortestEdge, newLong] : [newLong, shortestEdge];
  img = pilResize(img, rw, rh, BILINEAR);

  // 3. thumbnail (reducing_gap 2.0). ⚠ BICUBIC, not the config's BILINEAR: `preprocess` calls
  // `self.thumbnail(image=…, size=…)` WITHOUT `resample`, so the method's own default applies.
  // Found by this port's parity check on 2026-10-11 (4/116 identical under BILINEAR) — every
  // strip training ever saw went through both filters, and so must this one.
  let th = Math.min(img.height, targetH);
  let tw = Math.min(img.width, targetW);
  if (!(th === img.height && tw === img.width)) {
    if (img.height > img.width) tw = Math.trunc((img.width * th) / img.height);
    else if (img.width > img.height) th = Math.trunc((img.height * tw) / img.width);
    img = pilResize(img, tw, th, BICUBIC, 2.0);
  }

  // 4. pad, centred, constant 0
  const padTop = Math.floor((targetH - img.height) / 2);
  const padLeft = Math.floor((targetW - img.width) / 2);
  const rgba = new Uint8Array(targetW * targetH * 4);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const v = img.data[y * img.width + x]!;
      const p = ((y + padTop) * targetW + x + padLeft) * 4;
      rgba[p] = v;
      rgba[p + 1] = v;
      rgba[p + 2] = v;
    }
  return rgba;
}
