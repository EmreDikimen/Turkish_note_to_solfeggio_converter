/**
 * Per-makam conventional PRINTED key signatures — GENERATED, do not edit by hand.
 *
 * Regenerate with:
 *   .venv-ml/bin/python scripts/build_makam_signatures.py \
 *       --from-json data/makam_signatures.json --ts-out packages/core/src/makamSignatures.ts
 *
 * Same table as `data/makam_signatures.json`, transcoded because the app ships without `data/`
 * and without Python. `sig` is the drawn-order signature body in the label token vocabulary
 * ("\\komaFlat b \\bakiyeSharp f"); `n` is how many adjudication-confirmed real strips showed
 * that spelling (0 = AEU theory fallback, no real evidence). Consumed by
 * `packages/core/src/makam.ts` to turn a decoded score's derived signature into candidate makams.
 */

export interface MakamSignatureVariant {
  /** Drawn-order signature body, label token vocabulary. */
  sig: string;
  /** Share of this makam's real strips carrying this spelling. */
  weight: number;
  /** Real strips behind it — 0 means the row is AEU theory, not observed. */
  n: number;
}

export interface MakamSignatureEntry {
  /** Raw makam spellings seen in the corpus that normalise to this key. */
  names: string[];
  source: "real" | "theory" | "real+theory";
  variants: MakamSignatureVariant[];
  /** Set when this key is a spelling alias of another ("nihavent" -> "nihavend"). */
  aliasOf?: string;
}

/** Keyed by NORMALISED makam name (lowercase, alphanumerics only). */
export const MAKAM_SIGNATURES: Record<string, MakamSignatureEntry> = {
  "acemasiran": {
    names: ["acem_asiran", "acemasiran"],
    source: "real",
    variants: [
      { sig: "\\kucukFlat b", weight: 1.0, n: 71 },
    ],
  },
  "acemkurdi": {
    names: ["acem_kurdi", "acemkurdi"],
    source: "real",
    variants: [
      { sig: "\\kucukFlat b", weight: 1.0, n: 48 },
    ],
  },
  "acemtarab": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 0 },
    ],
  },
  "besteisfahan": {
    names: ["besteisfahan"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b", weight: 1.0, n: 5 },
    ],
  },
  "bestenigar": {
    names: ["bestenigar"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeFlat d", weight: 1.0, n: 2 },
    ],
  },
  "beyati": {
    names: ["beyati"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b", weight: 1.0, n: 7 },
    ],
  },
  "buselik": {
    names: ["buselik"],
    source: "real",
    variants: [
      { sig: "\\bakiyeFlat e", weight: 1.0, n: 3 },
    ],
  },
  "evc": {
    names: ["evc"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 1 },
    ],
  },
  "evcara": {
    names: ["evcara"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f \\bakiyeSharp c \\bakiyeSharp a \\bakiyeSharp e", weight: 1.0, n: 3 },
    ],
  },
  "evic": {
    names: ["evic"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 3 },
    ],
  },
  "ferahfeza": {
    names: ["ferahfeza"],
    source: "real",
    variants: [
      { sig: "\\kucukFlat b", weight: 1.0, n: 16 },
    ],
  },
  "ferahnak": {
    names: ["ferahnak"],
    source: "real",
    variants: [
      { sig: "\\bakiyeSharp f \\bakiyeSharp c", weight: 1.0, n: 5 },
    ],
  },
  "ferahnakasiran": {
    names: ["ferahnak_asiran"],
    source: "real",
    variants: [
      { sig: "\\bakiyeSharp f \\bakiyeSharp c", weight: 1.0, n: 1 },
    ],
  },
  "gevest": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f \\bakiyeSharp c", weight: 1.0, n: 0 },
    ],
  },
  "hicaz": {
    names: ["hicaz"],
    source: "real",
    variants: [
      { sig: "\\bakiyeFlat b \\bakiyeSharp c", weight: 0.58, n: 69 },
      { sig: "\\bakiyeFlat b \\bakiyeSharp f \\bakiyeSharp c", weight: 0.328, n: 39 },
      { sig: "\\bakiyeFlat b \\komaSharp f \\bakiyeSharp c \\bakiyeSharp g", weight: 0.076, n: 9 },
      { sig: "\\bakiyeFlat b \\bakiyeSharp c \\bakiyeSharp f", weight: 0.017, n: 2 },
    ],
  },
  "hicazhumayun": {
    names: ["hicaz_humayun"],
    source: "real",
    variants: [
      { sig: "\\bakiyeFlat b \\bakiyeSharp c", weight: 1.0, n: 8 },
    ],
  },
  "hicazkar": {
    names: ["hicazkar"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeFlat e \\bakiyeFlat a \\bakiyeSharp f", weight: 1.0, n: 26 },
    ],
  },
  "hicazkarkurdi": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\komaFlat b \\bakiyeFlat e \\bakiyeFlat a \\bakiyeSharp f", weight: 1.0, n: 0 },
    ],
  },
  "hicazuzzal": {
    names: ["uzzal"],
    source: "real",
    aliasOf: "uzzal",
    variants: [
      { sig: "\\bakiyeFlat b \\bakiyeSharp f \\bakiyeSharp c", weight: 1.0, n: 1 },
    ],
  },
  "hicazzirgule": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\bakiyeFlat b \\bakiyeSharp c", weight: 1.0, n: 0 },
    ],
  },
  "hisar": {
    names: ["hisar"],
    source: "real",
    variants: [
      { sig: "\\bakiyeSharp g \\bakiyeSharp d", weight: 1.0, n: 5 },
    ],
  },
  "hisarbuselik": {
    names: ["hisarbuselik"],
    source: "real",
    variants: [
      { sig: "\\komaSharp f \\bakiyeSharp g \\bakiyeSharp d", weight: 0.571, n: 4 },
      { sig: "\\komaSharp f \\bakiyeSharp g \\bakiyeSharp c", weight: 0.429, n: 3 },
    ],
  },
  "huseyni": {
    names: ["huseyni"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 40 },
    ],
  },
  "huzzam": {
    names: ["huzzam"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeFlat e \\bakiyeSharp f", weight: 0.902, n: 37 },
      { sig: "\\bakiyeFlat e \\bakiyeSharp f", weight: 0.098, n: 4 },
    ],
  },
  "isfahan": {
    names: ["isfahan"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b", weight: 1.0, n: 6 },
    ],
  },
  "karcigar": {
    names: ["karcigar"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeFlat e \\bakiyeSharp f", weight: 1.0, n: 27 },
    ],
  },
  "kurdilihicazkar": {
    names: ["kurdilihicazkar"],
    source: "real",
    variants: [
      { sig: "\\kucukFlat b \\kucukFlat e \\kucukFlat a", weight: 0.894, n: 42 },
      { sig: "\\kucukFlat b \\komaFlat e \\kucukFlat a", weight: 0.064, n: 3 },
      { sig: "\\kucukFlat b \\kucukFlat e \\bakiyeFlat a", weight: 0.043, n: 2 },
    ],
  },
  "mahur": {
    names: ["mahur"],
    source: "real",
    variants: [
      { sig: "\\kucukSharp f", weight: 0.673, n: 35 },
      { sig: "\\komaSharp f", weight: 0.327, n: 17 },
    ],
  },
  "muberka": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 0 },
    ],
  },
  "muhayyer": {
    names: ["muhayyer"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 0.939, n: 31 },
      { sig: "\\bakiyeSharp f", weight: 0.061, n: 2 },
    ],
  },
  "muhayyerkurdi": {
    names: ["muhayyer_kurdi", "muhayyerkurdi"],
    source: "real",
    variants: [
      { sig: "\\kucukFlat b", weight: 1.0, n: 35 },
    ],
  },
  "muhayyersunbule": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 0 },
    ],
  },
  "neva": {
    names: ["neva"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 3 },
    ],
  },
  "nevabuselik": {
    names: ["neva_buselik"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 1 },
    ],
  },
  "nevakurdi": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\kucukFlat b", weight: 1.0, n: 0 },
    ],
  },
  "nigar": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\bakiyeFlat b \\bakiyeSharp c", weight: 1.0, n: 0 },
    ],
  },
  "nihavend": {
    names: ["nihavend"],
    source: "real",
    variants: [
      { sig: "\\kucukFlat b \\kucukFlat e", weight: 0.947, n: 89 },
      { sig: "\\kucukFlat b \\kucukFlat e \\bakiyeSharp f", weight: 0.032, n: 3 },
      { sig: "\\kucukFlat e", weight: 0.021, n: 2 },
    ],
  },
  "nihavent": {
    names: ["nihavend"],
    source: "real",
    aliasOf: "nihavend",
    variants: [
      { sig: "\\kucukFlat b \\kucukFlat e", weight: 0.947, n: 89 },
      { sig: "\\kucukFlat b \\kucukFlat e \\bakiyeSharp f", weight: 0.032, n: 3 },
      { sig: "\\kucukFlat e", weight: 0.021, n: 2 },
    ],
  },
  "nikriz": {
    names: ["nikriz"],
    source: "real",
    variants: [
      { sig: "\\bakiyeFlat b \\bakiyeSharp f \\bakiyeSharp c", weight: 0.935, n: 29 },
      { sig: "\\bakiyeFlat b \\bakiyeSharp c", weight: 0.065, n: 2 },
    ],
  },
  "nisabur": {
    names: ["nisabur"],
    source: "real",
    variants: [
      { sig: "\\bakiyeSharp c", weight: 1.0, n: 8 },
    ],
  },
  "nisaburek": {
    names: ["nisaburek"],
    source: "real",
    variants: [
      { sig: "\\kucukSharp f \\bakiyeSharp c \\bakiyeSharp g", weight: 0.375, n: 12 },
      { sig: "\\kucukSharp f \\bakiyeSharp c", weight: 0.375, n: 12 },
      { sig: "\\bakiyeSharp f \\bakiyeSharp c", weight: 0.25, n: 8 },
    ],
  },
  "pesendide": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 0 },
    ],
  },
  "rast": {
    names: ["rast"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 0.851, n: 86 },
      { sig: "\\bakiyeSharp f", weight: 0.129, n: 13 },
      { sig: "\\komaFlat b", weight: 0.02, n: 2 },
    ],
  },
  "rengidil": {
    names: ["rengidil"],
    source: "real",
    variants: [
      { sig: "\\bakiyeFlat a \\komaFlat b \\bakiyeFlat d", weight: 1.0, n: 4 },
    ],
  },
  "saba": {
    names: ["saba"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeFlat d", weight: 1.0, n: 31 },
    ],
  },
  "sedaraban": {
    names: ["sedaraban"],
    source: "real",
    variants: [
      { sig: "\\kucukFlat b \\bakiyeFlat e \\bakiyeSharp f", weight: 1.0, n: 1 },
    ],
  },
  "segah": {
    names: ["segah"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\komaFlat e \\bakiyeSharp f", weight: 0.929, n: 39 },
      { sig: "\\komaFlat e \\bakiyeSharp f", weight: 0.071, n: 3 },
    ],
  },
  "sehnaz": {
    names: ["sehnaz"],
    source: "real",
    variants: [
      { sig: "\\bakiyeFlat b \\bakiyeSharp c", weight: 0.529, n: 9 },
      { sig: "\\bakiyeFlat b \\komaSharp f \\bakiyeSharp c \\bakiyeSharp g", weight: 0.176, n: 3 },
      { sig: "\\bakiyeFlat b \\bakiyeSharp f \\bakiyeSharp c", weight: 0.176, n: 3 },
      { sig: "\\komaSharp f \\bakiyeSharp c \\bakiyeSharp g", weight: 0.118, n: 2 },
    ],
  },
  "sehnazbuselik": {
    names: ["sehnaz_buselik"],
    source: "real",
    variants: [
      { sig: "\\bakiyeSharp g", weight: 1.0, n: 1 },
    ],
  },
  "sevkefza": {
    names: ["sevkefza"],
    source: "real",
    variants: [
      { sig: "\\kucukFlat b \\bakiyeFlat d", weight: 1.0, n: 5 },
    ],
  },
  "sipihr": {
    names: ["sipihr"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeFlat d", weight: 1.0, n: 1 },
    ],
  },
  "sivenuma": {
    names: ["sivenuma"],
    source: "real",
    variants: [
      { sig: "\\kucukFlat b", weight: 1.0, n: 1 },
    ],
  },
  "sultanisegah": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\bakiyeFlat b \\bakiyeSharp c", weight: 1.0, n: 0 },
    ],
  },
  "sultaniyegah": {
    names: ["sultaniyegah"],
    source: "real",
    variants: [
      { sig: "\\bakiyeFlat b \\bakiyeSharp c", weight: 0.5, n: 13 },
      { sig: "\\kucukFlat b \\bakiyeSharp c", weight: 0.346, n: 9 },
      { sig: "\\kucukFlat b", weight: 0.154, n: 4 },
    ],
  },
  "suzidil": {
    names: ["suzidil"],
    source: "real",
    variants: [
      { sig: "\\komaSharp f \\bakiyeSharp d \\bakiyeSharp g", weight: 1.0, n: 2 },
    ],
  },
  "suzidilara": {
    names: ["suzidilara"],
    source: "real",
    variants: [
      { sig: "\\kucukSharp f", weight: 1.0, n: 13 },
    ],
  },
  "suzinak": {
    names: ["suzinak"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeFlat e \\bakiyeFlat a \\bakiyeSharp f", weight: 0.75, n: 12 },
      { sig: "\\komaFlat b \\bakiyeFlat e \\bakiyeSharp f", weight: 0.25, n: 4 },
    ],
  },
  "suznak": {
    names: ["suznak"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeFlat e \\bakiyeSharp f", weight: 1.0, n: 1 },
    ],
  },
  "tahir": {
    names: ["tahir"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 1 },
    ],
  },
  "tarzinevin": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 0 },
    ],
  },
  "ussak": {
    names: ["ussak"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b", weight: 1.0, n: 24 },
    ],
  },
  "uzzal": {
    names: ["uzzal"],
    source: "real",
    variants: [
      { sig: "\\bakiyeFlat b \\bakiyeSharp f \\bakiyeSharp c", weight: 1.0, n: 1 },
    ],
  },
  "vecdidil": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 0 },
    ],
  },
  "yegah": {
    names: ["yegah"],
    source: "real",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f", weight: 1.0, n: 1 },
    ],
  },
  "zavil": {
    names: [],
    source: "theory",
    variants: [
      { sig: "\\komaFlat b \\bakiyeSharp f \\bakiyeSharp c", weight: 1.0, n: 0 },
    ],
  },
};
