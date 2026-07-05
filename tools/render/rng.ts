/**
 * Tiny deterministic RNG helpers for the render pipeline. Every random choice in dataset
 * generation (repeat injection, text noise, per-render coin flips) must be reproducible from a
 * seed derived from stable strings (e.g. `"{slug}:{transpose}"`), so any strip can be re-rendered
 * bit-identically later.
 */

/** FNV-1a 32-bit hash of a string → an unsigned int seed. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: fast seeded PRNG, returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
