/**
 * DonutImageProcessor, ported to canvas — turns a strip image into the model's pixel tensor.
 *
 * Extracted from `../omrGate.ts`, where it is the "canvas" arm of the Rung-1.5 gate: the arm that
 * proves the *product* path, as opposed to replaying Python's pre-computed `.bin` tensors. It
 * currently reads all 14 gate strips exactly (14/14).
 *
 * ⚠ The `Math.trunc` calls below are load-bearing. They reproduce HF's `int()` truncations step by
 * step, and the order matters; this is a transliteration, not a resize. Do not "simplify" it.
 *
 * ⚠ Known, measured gap: the checkpoint's `resample: 2` is PIL BILINEAR, while a canvas draw uses
 * the browser's own filter. That is why this path is not expected to agree with Python on 100% of
 * strips, and why the slicer parity harness (MVP W3) measures a *ceiling* from this arm before the
 * slicer is judged against it. See docs/mvp/README.md.
 */

/**
 * Natural pixel size of anything drawable. `HTMLImageElement` reports it as `naturalWidth`;
 * everything else (canvas, `ImageBitmap`, `OffscreenCanvas`) uses plain `width`/`height`.
 * Needed because the slicer (W6) emits crops as canvases, not `<img>` elements.
 */
export function sourceSize(src: CanvasImageSource): { width: number; height: number } {
  if (typeof HTMLImageElement !== "undefined" && src instanceof HTMLImageElement)
    return { width: src.naturalWidth, height: src.naturalHeight };
  const s = src as { width: number | SVGAnimatedLength; height: number | SVGAnimatedLength };
  if (typeof s.width === "number" && typeof s.height === "number")
    return { width: s.width, height: s.height };
  throw new Error("preprocess: image source has no intrinsic size");
}

/** Put raw pixels on a canvas so they can be drawn/scaled — the slicer's crops arrive this way. */
export function canvasFromImageData(data: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext("2d")!.putImageData(data, 0, 0);
  return canvas;
}

/**
 * DonutImageProcessor, ported (the values below mirror the checkpoint's preprocessor config):
 *  1. align_long_axis: target is portrait (409×583) and strips are landscape → rotate 90° CW
 *     (numpy's rot90(image, 3), which Python applied to every training image).
 *  2. resize: shortest edge → min(583, 409) = 409, aspect preserved (int truncation like HF).
 *  3. thumbnail: shrink to fit within 409×583 (never enlarges).
 *  4. pad: center on a 409×583 black canvas (constant 0, HF's default).
 *  5. rescale + normalize: x/255 → (x − 0.5)/0.5, i.e. [0, 255] → [−1, 1], channels-first.
 */
export function preprocessCanvas(
  img: CanvasImageSource,
  targetW: number,
  targetH: number
): Float32Array {
  const size = sourceSize(img);
  let w = size.width;
  let h = size.height;
  const rotate = (w > h && targetH > targetW) || (h > w && targetW > targetH);
  if (rotate) [w, h] = [h, w];

  // steps 2+3 with HF's exact int() truncations, then one high-quality canvas draw
  const shortest = Math.min(targetH, targetW);
  let [rw, rh] = w < h ? [shortest, Math.trunc((shortest * h) / w)] : [Math.trunc((shortest * w) / h), shortest];
  let th = Math.min(rh, targetH);
  let tw = Math.min(rw, targetW);
  if (rh > rw) tw = Math.trunc((rw * th) / rh);
  else if (rw > rh) th = Math.trunc((rh * tw) / rw);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  // No `willReadFrequently` here on purpose: it can move the canvas to software rasterization,
  // which is exactly the kind of change that would perturb drawImage's filtering and the gate's
  // 14/14 canvas arm with it. Keep this context request identical to the pre-extraction one.
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const padLeft = Math.trunc((targetW - tw) / 2);
  const padTop = Math.trunc((targetH - th) / 2);
  ctx.save();
  if (rotate) {
    // 90° CW: the image's left edge becomes the top edge
    ctx.translate(padLeft + tw, padTop);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0, th, tw); // pre-rotation axes: width along th, height along tw
  } else {
    ctx.drawImage(img, padLeft, padTop, tw, th);
  }
  ctx.restore();

  const { data } = ctx.getImageData(0, 0, targetW, targetH); // RGBA, row-major
  const n = targetW * targetH;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = data[i * 4]! / 127.5 - 1; // R plane
    out[n + i] = data[i * 4 + 1]! / 127.5 - 1; // G plane
    out[2 * n + i] = data[i * 4 + 2]! / 127.5 - 1; // B plane
  }
  return out;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
