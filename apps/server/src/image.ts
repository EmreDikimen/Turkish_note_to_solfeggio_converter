/**
 * A whole page image (JPEG or PNG) → the slicer's grayscale, for `POST /page`.
 *
 * The browser does this with `createImageBitmap` + a canvas (`apps/web/src/omr/slicer/domImage.ts`);
 * the server has neither, so it decodes with two pure-JS decoders — `pngjs` for the same reason
 * `png.ts` gives (bytes from the open internet should not reach a native decoder), and `jpeg-js`
 * for the photos a phone takes. Both then meet the browser path at `grayFromRGBA`, so the only
 * difference left is the decoders' RGBA: ±1 on some pixels, the class of difference
 * `docs/METRICS-SLICER.md` measured as leaving the slicer's strips bit-identical.
 *
 * Two things the browser does for free are done by hand:
 *
 *   - **EXIF orientation.** `createImageBitmap` honours it by default; a phone photo held upright
 *     is usually stored sideways with orientation 6. Without this the slicer would see a page of
 *     vertical staves and find none.
 *   - **A size check before decoding.** A 20,000 × 20,000 image is a few KB of JPEG and 1.6 GB of
 *     RGBA, so the dimensions are read from the header and refused first.
 */
import jpeg from "jpeg-js";
import { grayFromRGBA, type Gray } from "../../web/src/omr/slicer/cvOps";
import { decodeRGBA, readHeader } from "./png";

export class BadImage extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** Width and height from a JPEG's first SOFn marker, without decoding. */
function jpegSize(b: Buffer): { width: number; height: number } | null {
  let p = 2;
  while (p + 9 < b.length) {
    if (b[p] !== 0xff) return null;
    const m = b[p + 1]!;
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) {
      p += 2;
      continue;
    }
    const len = b.readUInt16BE(p + 2);
    // SOF0..SOF15, minus DHT (C4), JPG (C8) and DAC (CC)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
      return { height: b.readUInt16BE(p + 5), width: b.readUInt16BE(p + 7) };
    p += 2 + len;
  }
  return null;
}

/** EXIF orientation (1–8) from a JPEG's APP1 segment; 1 when absent or unreadable. */
export function jpegOrientation(b: Buffer): number {
  let p = 2;
  while (p + 4 < b.length && b[p] === 0xff) {
    const m = b[p + 1]!;
    if (m === 0xda) break; // start of scan: no more metadata
    const len = b.readUInt16BE(p + 2);
    if (m === 0xe1 && b.toString("latin1", p + 4, p + 10) === "Exif\0\0") {
      const t = p + 10;
      const le = b.toString("latin1", t, t + 2) === "II";
      const u16 = (o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
      const u32 = (o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
      if (t + 8 > b.length) return 1;
      const ifd = t + u32(t + 4);
      if (ifd + 2 > b.length) return 1;
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > b.length) return 1;
        if (u16(e) === 0x0112) {
          const v = u16(e + 8);
          return v >= 1 && v <= 8 ? v : 1;
        }
      }
      return 1;
    }
    p += 2 + len;
  }
  return 1;
}

/** Apply an EXIF orientation to a gray plane, so the result is the image as it is meant to be seen. */
export function orient(g: Gray, o: number): Gray {
  if (o === 1) return g;
  const { width: W, height: H, data } = g;
  const swap = o >= 5;
  const w = swap ? H : W;
  const h = swap ? W : H;
  const out = new Uint8Array(W * H);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // source coordinates for output (x, y), per the EXIF definitions
      let sx: number, sy: number;
      switch (o) {
        case 2: [sx, sy] = [W - 1 - x, y]; break; // mirror horizontal
        case 3: [sx, sy] = [W - 1 - x, H - 1 - y]; break; // rotate 180
        case 4: [sx, sy] = [x, H - 1 - y]; break; // mirror vertical
        case 5: [sx, sy] = [y, x]; break; // transpose
        case 6: [sx, sy] = [y, H - 1 - x]; break; // rotate 90 CW
        case 7: [sx, sy] = [W - 1 - y, H - 1 - x]; break; // transverse
        default: [sx, sy] = [W - 1 - y, x]; break; // 8: rotate 90 CCW
      }
      out[y * w + x] = data[sy * W + sx]!;
    }
  return { data: out, width: w, height: h };
}

/**
 * Decode a page upload to gray. Throws `BadImage` (400, or 413 when too large) for anything that is
 * not a readable JPEG/PNG within `maxPixels`. opencv.js must already be initialised.
 */
export function readPageImage(buf: Buffer, maxPixels: number): Gray {
  let size: { width: number; height: number } | null;
  const png = readHeader(buf);
  if (png) size = png;
  else if (isJpeg(buf)) size = jpegSize(buf);
  else throw new BadImage("expected a JPEG or PNG page image");
  if (!size || !size.width || !size.height) throw new BadImage("unreadable image header");
  if (size.width * size.height > maxPixels)
    throw new BadImage(`image too large (${size.width}×${size.height} > ${maxPixels} pixels)`, 413);

  if (png) {
    let d;
    try {
      d = decodeRGBA(buf);
    } catch (err) {
      throw new BadImage(`unreadable PNG (${String(err)})`);
    }
    return grayFromRGBA(d.rgba, d.width, d.height);
  }

  let d;
  try {
    d = jpeg.decode(buf, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: Math.ceil(maxPixels / 1e6),
      maxMemoryUsageInMB: 1024,
    });
  } catch (err) {
    throw new BadImage(`unreadable JPEG (${String(err)})`);
  }
  return orient(grayFromRGBA(d.data, d.width, d.height), jpegOrientation(buf));
}
