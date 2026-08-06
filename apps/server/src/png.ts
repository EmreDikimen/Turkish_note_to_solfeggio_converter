/**
 * PNG in, RGBA out — plus the header check that runs BEFORE any decoding.
 *
 * `pngjs` is pure JavaScript, which is the reason it is here rather than `sharp`: this endpoint
 * parses bytes from the open internet, and a native image decoder is the classic way to turn that
 * into something worse than a 400. It also keeps the container free of native build deps beyond
 * onnxruntime itself.
 */
import { PNG } from "pngjs";

const MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
}

/**
 * Read IHDR without decoding anything.
 *
 * The point is to reject a wrong-sized or hostile payload while it is still 30 bytes of header,
 * rather than after `pngjs` has allocated its pixels — a 20,000 × 20,000 PNG is a few KB on the
 * wire and 1.6 GB in memory.
 */
export function readHeader(buf: Buffer): PngHeader | null {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(MAGIC)) return null;
  if (buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24]!,
    colorType: buf[25]!,
  };
}

/** Decode to interleaved RGBA. Throws on malformed data; the caller turns that into a 400. */
export function decodeRGBA(buf: Buffer): { rgba: Uint8Array; width: number; height: number } {
  const png = PNG.sync.read(buf);
  return { rgba: new Uint8Array(png.data), width: png.width, height: png.height };
}
