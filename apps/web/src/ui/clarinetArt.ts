import type { ClarinetKeyId } from "@turkish-omr/core";

/**
 * The sol klarnet view's artwork and calibration — every pixel of F3's third instrument.
 *
 * ⭐ **A PHOTOGRAPH, AND IT REPLACED A DRAWING** (owner, 2026-08-29: *"çizim pek olmamış"*). This
 * file first held an SVG we drew ourselves, after a third-party schematic turned out to be **Boehm
 * (French)** keywork where the sol klarnet is **German**. The drawing was honest and the owner
 * rejected it on sight — it did not look like the instrument. Kept as the reason not to try again:
 * a schematic is fine for a kanun, whose mandals are boxes, and wrong for a clarinet, whose
 * keywork is the thing you recognise it by.
 *
 * ⚠ **The photo is CC BY-SA 4.0 and it is the FIRST attribution-licensed asset the app ships**,
 * which took amending the CC0-only image rule a second time. Its chain was followed to the root and
 * the root carries a real **VRT permission ticket 2017012510009331** from Yamaha Music Europe — it
 * is not a user's bare claim over a manufacturer's photo, which is what the metadata looks like at
 * first glance and is exactly the trap the rule exists for. [docs/THIRD-PARTY.md].
 *
 * How it's organized:
 *   * `IMAGE` — the file and its natural size; the SVG viewBox IS the image's pixel space, so every
 *     number below is a pixel on the photo and can be re-measured against it.
 *   * `HOLES` — **MEASURED** off the photograph (see below).
 *   * `KEYS` — **placed by the owner**, note by note, on the instrument he plays.
 *   * `BACK_INSET` — the thumb hole and register key, which a front photo cannot show.
 *
 * ⚠ **Bounded by HEIGHT, never width** — 244×1560 is still a 1:6.4 sliver.
 */

/**
 * The instrument photo: Yamaha YCL-457II-22, German system (Original Oehler), background removed.
 *
 * ⭐ **THE HEAD IS CUT OFF ON PURPOSE** (owner, 2026-08-29: *"klarnetin baş tarafını çıkarabilirsin,
 * yani parmak pozisyonu görünmeyen kısmı çıkarabilirsin"*). The mouthpiece, barrel and the top of
 * the upper joint carry no finger position, so they were spending a third of the card's height
 * saying nothing. The cut stops just above the highest key the view ever lights, which is what the
 * owner asked for in the same breath: the La key must stay visible.
 *
 * Re-cropped from the 1000×7050 original — **not** from the earlier crop, so nothing is scaled
 * twice — and scaled to 244×1560, which is 2× the 780 px the card draws at. 453 KB.
 */
export const IMAGE = {
  src: "instruments/clarinet-ycl457-oehler.png",
  w: 244,
  h: 1560,
} as const;

/**
 * The SVG viewBox: the image's own pixels, plus a left margin.
 *
 * ⚠ The margin carries three things and they must not collide — the note name at the top, the back
 * inset (thumb + register) in the middle, and the lip bar below it. The first layout put the label
 * and the inset's caption on the same line and they overprinted.
 */
export const VIEW_X = -112;
export const VIEW_W = IMAGE.w - VIEW_X;
export const VIEW_H = IMAGE.h;

/** A marked-up hole or key: where to draw the state marker, in image pixels. */
export interface Marker {
  id: ClarinetKeyId;
  cx: number;
  cy: number;
  r: number;
  /**
   * Where this position came from, which is not a detail — it says how much to trust it.
   *
   * `"measured"` — found by detecting the black tone holes in the image. Six of these.
   * `"owner"`    — the owner placed it himself on 2026-08-30, on the instrument he plays.
   *
   * ⚠ There is deliberately no `"guess"` value any more. Every position I had placed by eye and
   * that any fingering actually used turned out to be **wrong** — five of six — so none survived.
   */
  source: "measured" | "owner";
}

/**
 * THE SIX TONE HOLES — **MEASURED OFF THE PHOTO**, not placed by eye.
 *
 * ⭐ Found by picking out near-black blobs (luminance < 42) on the opaque body and keeping the ones
 * that are round and solid. Exactly six came back, all on the same axis (x 95.4–98.8) with the same
 * size (area 464–569 px, 24–29 px across), which is what an open tone hole ringed in bright metal
 * looks like and nothing else on the instrument does. The centres below are those blob centroids.
 *
 * ⚠ **This is the part of the calibration that carries the view**, the same way the violin's
 * nut-to-bridge line does: a fingering is mostly *which of these six is covered*, so they have to
 * land on the real holes and they do.
 */
export const HOLES: readonly Marker[] = [
  { id: "lh1", cx: 128.3, cy: 186.6, r: 18, source: "measured" },
  { id: "lh2", cx: 129.7, cy: 284.2, r: 18, source: "measured" },
  { id: "lh3", cx: 129.9, cy: 383.1, r: 18, source: "measured" },
  { id: "rh1", cx: 132.4, cy: 526.1, r: 18, source: "measured" },
  { id: "rh2", cx: 131, cy: 628.9, r: 18, source: "measured" },
  { id: "rh3", cx: 131, cy: 722.5, r: 19, source: "measured" },
];

/**
 * THE KEYS — **placed by the owner**, note by note, on 2026-08-30 (`tools/core/clarinet-editor.ts`).
 *
 * ⭐ **This replaced fifteen positions I had placed by eye, and five of the six that any fingering
 * used were on the wrong key.** The comment they replaced said the guesses were "inside the right
 * cluster" and that only which member of the cluster was uncertain. That was too generous:
 * `key_cis` sits 200 px from where I had put `lh_db`, and `key_gis4` is on the other side of the
 * instrument from my `throat_ab`.
 *
 * ⚠ **The names say which NOTE each key is pressed on, not what the key is called.** That is the
 * only thing about them that was verified. The old names claimed to know the mechanism
 * (`lh_gb`, `side3`, `sliver_rh`) and were confidently wrong.
 *
 * ⚠ Nothing unused is kept. A ring drawn over a key that no fingering ever presses is noise on a
 * photograph that already has twenty-two pieces of silver on it.
 */
export const KEYS: readonly Marker[] = [
  { id: "key_a4", cx: 124.7, cy: 134.5, r: 11, source: "owner" }, //    La4, Si♭4
  { id: "key_gis4", cx: 184.4, cy: 136.1, r: 10, source: "owner" }, //  La♭4
  { id: "key_cis", cx: 170.8, cy: 428.2, r: 10, source: "owner" }, //   Re♭4
  { id: "key_dis", cx: 155.5, cy: 333.5, r: 9, source: "owner" }, //    Mi♭4
  { id: "key_f4", cx: 67, cy: 454.6, r: 10, source: "owner" }, //       Fa4
  { id: "key_e", cx: 188.8, cy: 478.6, r: 10, source: "owner" }, //     Mi3
  { id: "key_fis", cx: 219.4, cy: 478.6, r: 10, source: "owner" }, //   Sol♭3
  { id: "key_bes", cx: 128.9, cy: 674.9, r: 9, source: "owner" }, //    Si♭3
  { id: "key_gis3", cx: 80.4, cy: 774.6, r: 10, source: "owner" }, //   La♭3
  { id: "key_low", cx: 75.1, cy: 812.3, r: 10, source: "owner" }, //    Mi3, Fa3, Sol♭3 — the only shared key
];

/**
 * The thumb hole and the register key, drawn beside the instrument.
 *
 * ⚠ **They are on the BACK, and no front photograph can show them.** Every printed clarinet chart
 * solves this the same way — the thumb is drawn as a separate circle off to one side — so this
 * follows the convention a player already reads rather than inventing one.
 */
export const BACK_INSET: readonly Marker[] = [
  { id: "register", cx: -46, cy: 110, r: 15, source: "owner" },
  { id: "thumb", cx: -46, cy: 190, r: 18, source: "owner" },
];

/** Everything the view draws a state for, in one list. */
export const MARKERS: readonly Marker[] = [...HOLES, ...KEYS, ...BACK_INSET];

/**
 * Where the lip meter is drawn: a vertical bar down the left margin.
 *
 * ⚠ Vertical on purpose. The bend is a *pitch*, and every other pitch in this app runs up the page —
 * the staff, the fingerboard, the kanun's courses. A horizontal meter would be the only place in
 * the product where lower means left.
 */
export const LIP_BAR = { x: -96, y: 430, w: 22, h: 760 } as const;
