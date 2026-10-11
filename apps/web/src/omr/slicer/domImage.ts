/**
 * The slicer's two browser-only seams: an image file in, a crop canvas out.
 *
 * Split out of `cvOps.ts` on 2026-10-11 so the rest of the slicer is DOM-free and the decode server
 * can run it (`apps/server/src/slicePage.ts`). Nothing here changed in the move: `decodeGray` still
 * takes the same decode options and the same `cvtColor`, now behind `grayFromRGBA`.
 */
import { grayFromRGBA, type Gray } from "./cvOps";

/**
 * Decode an image URL to grayscale the way the browser must: RGBA out of the PNG decoder, then
 * cvtColor.
 *
 * `cv2.imread(IMREAD_GRAYSCALE)` converts INSIDE the decoder and a browser can never do that, so
 * this differs from Python by ±1 on some pixels of a colour page — as do OpenCV's own two paths
 * (7.4% of a colour page's pixels). Settled by measurement rather than tolerance: re-running the
 * whole slicer under exactly that perturbation left all 119 strips of the 6 most colour-shifted
 * corpus pages bit-identical (docs/METRICS-SLICER.md).
 *
 * The decode options are load-bearing — they disable the browser's colour management so we get the
 * file's own bytes rather than a display-profile transform of them.
 */
export async function decodeGray(url: string): Promise<Gray> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return grayFromRGBA(rgba.data, rgba.width, rgba.height);
}

/** A grayscale image as an RGBA canvas — the seam where slicer pixels meet the decode path. */
export function grayToCanvas(src: Gray): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = src.width;
  canvas.height = src.height;
  const img = new ImageData(src.width, src.height);
  for (let i = 0, p = 0; i < src.data.length; i++, p += 4) {
    const v = src.data[i]!;
    img.data[p] = v;
    img.data[p + 1] = v;
    img.data[p + 2] = v;
    img.data[p + 3] = 255;
  }
  canvas.getContext("2d")!.putImageData(img, 0, 0);
  return canvas;
}
