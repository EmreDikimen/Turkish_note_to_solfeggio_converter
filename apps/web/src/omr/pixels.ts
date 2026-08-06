/**
 * The last step of Donut preprocessing: interleaved RGBA bytes → the model's pixel planes.
 *
 * Its own file, and a DOM-free one, because **the decode server runs this step and no other**
 * (MVP W9). The client does the geometry — rotate, resize, pad, all of it canvas work in
 * `preprocess.ts` — and POSTs the finished 409×583 image as a PNG; the server decodes that PNG and
 * applies only the rescale below. Keeping the two apart means the server bundle contains no
 * `document.createElement` it can never call, and no `lib.dom` in its tsconfig.
 *
 * Why the seam is here rather than at the raw crop:
 *
 *  1. **No second resampler to hold in parity.** The known gap in `preprocess.ts` is that a canvas
 *     draw is not PIL BILINEAR; resizing again on the server with `sharp` or node-canvas would add
 *     a THIRD resampler and a rung to prove it matches — the exact bill that reusing `decode.ts`
 *     was chosen to avoid (docs/mvp/deploy.md).
 *  2. **PNG is lossless**, so what the server feeds the encoder is bit-for-bit what the browser
 *     would have fed it. The only thing left that can differ is ORT itself, which is what the
 *     server-vs-browser parity check measures.
 */

/** x/255 → (x − 0.5)/0.5, i.e. [0, 255] → [−1, 1], channels-first (HF rescale + normalize). */
export function pixelsFromRGBA(
  data: ArrayLike<number>,
  width: number,
  height: number
): Float32Array {
  const n = width * height;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = data[i * 4]! / 127.5 - 1; // R plane
    out[n + i] = data[i * 4 + 1]! / 127.5 - 1; // G plane
    out[2 * n + i] = data[i * 4 + 2]! / 127.5 - 1; // B plane
  }
  return out;
}
