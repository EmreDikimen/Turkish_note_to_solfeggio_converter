/**
 * The ONLY file in the slicer port that touches opencv.js.
 *
 * Everything else works on plain typed arrays, so the transliteration of `page_to_strips.py` reads
 * like the numpy it came from and can be diffed against it line by line. W0 established that these
 * primitives are bit-identical to OpenCV-Python when fed identical bytes (both sides OpenCV 5.0.0),
 * so any divergence found later is the port, not the library.
 *
 * Mats are allocated and freed inside each call. opencv.js is emscripten — a leaked Mat is leaked
 * WASM heap, and a page-sized label map is ~12 MB.
 */
import cvReady from "@techstark/opencv-js";

type Cv = Awaited<typeof cvReady>;

let CV: Cv | null = null;

/** Load opencv.js once. Must be awaited before any other function here. */
export async function initCv(): Promise<void> {
  CV = (await cvReady) as Cv;
}

function cv(): any {
  if (!CV) throw new Error("opencv.js not initialised — await initCv() first");
  return CV;
}

/** A single-channel 8-bit image, the numpy `uint8` 2-D array of the Python. */
export interface Gray {
  data: Uint8Array;
  width: number;
  height: number;
}

/** A connectedComponents labelling: `data[y * width + x]` is the label, 0 = background. */
export interface Labels {
  data: Int32Array;
  width: number;
  height: number;
  count: number; // number of labels INCLUDING background, i.e. cv2's return value
}

function toMat(img: Gray): any {
  const m = new (cv().Mat)(img.height, img.width, cv().CV_8UC1);
  m.data.set(img.data);
  return m;
}

function fromMat(m: any): Gray {
  return { data: new Uint8Array(m.data), width: m.cols, height: m.rows };
}

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

  const src = cv().matFromImageData(rgba);
  const gray = new (cv().Mat)();
  cv().cvtColor(src, gray, cv().COLOR_RGBA2GRAY);
  src.delete();
  const out = fromMat(gray);
  gray.delete();
  return out;
}

/** `binarize_ink` (L133): Otsu on the inverted image. ink = 255, background = 0. */
export function binarizeInk(gray: Gray): Gray {
  const src = toMat(gray);
  const dst = new (cv().Mat)();
  cv().threshold(src, dst, 0, 255, cv().THRESH_BINARY_INV + cv().THRESH_OTSU);
  src.delete();
  const out = fromMat(dst);
  dst.delete();
  return out;
}

/** MORPH_OPEN with a `len`×1 rectangle — `detect_staves` L315-317. Keeps long horizontals only. */
export function openHorizontal(ink: Gray, len: number): Gray {
  const src = toMat(ink);
  const dst = new (cv().Mat)();
  const kernel = cv().getStructuringElement(cv().MORPH_RECT, new (cv().Size)(len, 1));
  cv().morphologyEx(src, dst, cv().MORPH_OPEN, kernel);
  kernel.delete();
  src.delete();
  const out = fromMat(dst);
  dst.delete();
  return out;
}

/**
 * 8-connected `cv2.connectedComponents` — the driver's L969 page-level labelling.
 *
 * Python passes `(ink > 0).astype(np.uint8)` rather than the 0/255 mask; identical labels either
 * way (non-zero is foreground), so the mask is passed straight through.
 */
export function connectedComponents(ink: Gray): Labels {
  const src = toMat(ink);
  const labels = new (cv().Mat)();
  const count = cv().connectedComponents(src, labels, 8);
  src.delete();
  const out: Labels = {
    data: new Int32Array(labels.data32S),
    width: labels.cols,
    height: labels.rows,
    count,
  };
  labels.delete();
  return out;
}

/** `cv2.resize(..., interpolation=INTER_AREA)` — `normalize_row` L469's non-uniform resize. */
export function resizeArea(src: Gray, newW: number, newH: number): Gray {
  const m = toMat(src);
  const dst = new (cv().Mat)();
  cv().resize(m, dst, new (cv().Size)(newW, newH), 0, 0, cv().INTER_AREA);
  m.delete();
  const out = fromMat(dst);
  dst.delete();
  return out;
}

/** `cv2.copyMakeBorder(..., BORDER_CONSTANT, value=255)`, top/bottom only — `normalize_row` L467. */
export function copyMakeBorderTB(src: Gray, top: number, bottom: number, value: number): Gray {
  const m = toMat(src);
  const dst = new (cv().Mat)();
  cv().copyMakeBorder(m, dst, top, bottom, 0, 0, cv().BORDER_CONSTANT, new (cv().Scalar)(value, value, value, value));
  m.delete();
  const out = fromMat(dst);
  dst.delete();
  return out;
}

/** `cv2.resize(src, None, fx=s, fy=s, interpolation=INTER_AREA)` — `estimate_skew` L247. */
export function resizeScale(src: Gray, fx: number, fy: number): Gray {
  const m = toMat(src);
  const dst = new (cv().Mat)();
  cv().resize(m, dst, new (cv().Size)(0, 0), fx, fy, cv().INTER_AREA);
  m.delete();
  const out = fromMat(dst);
  dst.delete();
  return out;
}

/**
 * Rotate about the image centre with a WHITE border — `deskew` L275-276 / `estimate_skew` L254-255.
 *
 * The border value matches the paper, not the ink: a black border would be read as a page-wide
 * horizontal run and invent staff lines at the frame edge.
 */
export function rotate(src: Gray, angleDeg: number): Gray {
  const m = toMat(src);
  const dst = new (cv().Mat)();
  const center = new (cv().Point)(src.width / 2, src.height / 2);
  const M = cv().getRotationMatrix2D(center, angleDeg, 1.0);
  cv().warpAffine(
    m,
    dst,
    M,
    new (cv().Size)(src.width, src.height),
    cv().INTER_LINEAR,
    cv().BORDER_CONSTANT,
    new (cv().Scalar)(255, 255, 255, 255)
  );
  M.delete();
  m.delete();
  const out = fromMat(dst);
  dst.delete();
  return out;
}

/** `gray[y0:y1, :]` — a row-range view, copied. */
export function subRows(src: Gray, y0: number, y1: number): Gray {
  const rows = Math.max(0, y1 - y0);
  return {
    data: src.data.subarray(y0 * src.width, (y0 + rows) * src.width),
    width: src.width,
    height: rows,
  };
}
