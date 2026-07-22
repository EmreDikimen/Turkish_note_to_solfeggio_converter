#!/usr/bin/env python3
"""Build data/makam_signatures.json — the per-makam CONVENTIONAL PRINTED key signature
table used by the synthetic renderer (labels-cli printed-signature override).

Real editions print the makam's conventional signature (donanım), which routinely differs
from SymbTr's content-derived one (`deriveKeySignature`). This table captures "what editions
print for makam X", learned from the ADJUDICATION-CONFIRMED `\\sig … \\sigend` blocks already
written into the promoted real-pool labels — then patched with AEU theory for the makams that
have no (or too little) real evidence.

Output schema (keyed by NORMALISED makam = lowercase, alphanumerics only, so
`muhayyer_kurdi` / `muhayyerkurdi` / `muhayyer-kurdi` collapse to one key):

  { "<norm_makam>": {
        "names": ["<raw name seen>", ...],
        "source": "real" | "theory" | "real+theory",
        "variants": [ {"sig": "\\bakiyeFlat b \\bakiyeSharp c", "weight": 0.64, "n": 69}, ... ]
    }, ... }

`sig` is the drawn-order signature body (no `\\sig`/`\\sigend` wrapper) exactly as the
labels-cli `--printed-sig` override expects. A makam carries AS MANY variants as the
adjudicated real labels actually show — several makams print 3–4 distinct signature
spellings (hicaz, şehnaz, nisaburek, sultaniyegah) — and the renderer samples a variant by
`weight`. Single-strip spellings (n < --min-n) are dropped as decode noise UNLESS they are a
makam's only evidence.

Run: .venv-ml/bin/python scripts/build_makam_signatures.py [--min-frac 0.15] [--out PATH]
"""
from __future__ import annotations
import argparse, glob, json, re, collections, sys

SIG_RE = re.compile(r"\\sig\b(.*?)\\sigend", re.S)


def norm(makam: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (makam or "").lower())


# Spelling aliases: corpus (pieces.json) name -> the manifest name that carries the real data.
# These survive normalisation as distinct strings (trailing d/t, family prefixes), so map them
# explicitly. The output also gets an entry under the corpus spelling (alias_of) so the renderer
# can look up either form.
ALIAS = {
    "nihavent": "nihavend",   # pieces.json 'nihavent' == manifest 'nihavend' (94 real strips)
    "hicazuzzal": "uzzal",    # pieces.json 'hicaz-uzzal' -> real 'uzzal'
}


# AEU-theory fallback for makams with no / too-little real evidence.
# Drawn order, same token vocabulary as the labels. Sourced from standard AEU donanım tables;
# each is the single common printed signature (add a 2nd only where editions clearly split).
# Keys are NORMALISED makam names. These are only USED when real evidence is absent/thin.
THEORY = {
    "acemtarab":      [r"\komaFlat b \bakiyeSharp f"],            # acem-family, evc sharp
    "gevest":         [r"\komaFlat b \bakiyeSharp f \bakiyeSharp c"],
    "hicazzirgule":   [r"\bakiyeFlat b \bakiyeSharp c"],          # hicaz-family
    "hicazkarkurdi":  [r"\komaFlat b \bakiyeFlat e \bakiyeFlat a \bakiyeSharp f"],  # like hicazkar
    "muberka":        [r"\komaFlat b \bakiyeSharp f"],
    "muhayyersunbule":[r"\komaFlat b \bakiyeSharp f"],           # muhayyer-family
    "nevakurdi":      [r"\kucukFlat b"],                          # kürdi-family on neva
    "nigar":          [r"\bakiyeFlat b \bakiyeSharp c"],          # hicaz/nishabur colouring
    "tarzinevin":     [r"\komaFlat b \bakiyeSharp f"],
    "vecdidil":       [r"\komaFlat b \bakiyeSharp f"],
    "pesendide":      [r"\komaFlat b \bakiyeSharp f"],
    "zavil":          [r"\komaFlat b \bakiyeSharp f \bakiyeSharp c"],  # zavil ~ mahur/rast colour
    "sultanisegah":   [r"\bakiyeFlat b \bakiyeSharp c"],          # sultaniyegah spelling variant
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pools", default="data/real/rung3/strips_*/manifest.jsonl")
    ap.add_argument("--corpus", default="data/pieces.json")
    ap.add_argument("--out", default="data/makam_signatures.json")
    ap.add_argument("--min-frac", type=float, default=0.0,
                    help="optional extra floor: also require a variant's share ≥ this (0 = off)")
    ap.add_argument("--min-n", type=int, default=2,
                    help="min real strips to trust a non-modal variant (drops single-strip noise)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    counts: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    raw_names: dict[str, set] = collections.defaultdict(set)

    for p in sorted(glob.glob(args.pools)):
        # exam pools carry the same printed sigs; they inform the table (not a train leak — this
        # is edition convention, not piece content), but skip if you prefer strict separation.
        with open(p) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except Exception:
                    continue
                mk = r.get("makam") or ""
                if not mk:
                    continue
                m = SIG_RE.search(r.get("label", ""))
                if not m:
                    continue
                body = " ".join(m.group(1).split())
                if not body:
                    continue  # EMPTY sig — not a printed-signature convention
                k = norm(mk)
                counts[k][body] += 1
                raw_names[k].add(mk)

    table: dict[str, dict] = {}

    # 1) real-evidence makams
    for k, c in counts.items():
        items = c.most_common()
        total = sum(c.values())
        # Keep the modal spelling always, plus EVERY other spelling with real support
        # (n >= min_n). No cap on the number of variants — makams genuinely print 3–4.
        kept = [
            (sig, n) for i, (sig, n) in enumerate(items)
            if i == 0 or (n >= args.min_n and n / total >= args.min_frac)
        ]
        ksum = sum(n for _, n in kept)
        table[k] = {
            "names": sorted(raw_names[k]),
            "source": "real",
            "variants": [
                {"sig": sig, "weight": round(n / ksum, 3), "n": n} for sig, n in kept
            ],
        }

    # 2) theory fallback for corpus makams still missing or thin (n<min_n total)
    corpus = set()
    try:
        d = json.load(open(args.corpus))
        pieces = d if isinstance(d, list) else d.get("pieces", d)
        corpus = {norm(p.get("makam")) for p in pieces if isinstance(p, dict) and p.get("makam")}
    except Exception as e:
        print(f"WARN: corpus load failed ({e}); theory patch limited to THEORY keys", file=sys.stderr)
        corpus = set(THEORY)

    for k in sorted(corpus | set(THEORY)):
        real_n = sum(counts.get(k, {}).values())
        if k in table and real_n >= args.min_n:
            continue  # trust the real data
        if k in THEORY:
            variants = [{"sig": s, "weight": round(1 / len(THEORY[k]), 3), "n": 0} for s in THEORY[k]]
            if k in table:  # thin real data -> blend note
                table[k]["source"] = "real+theory"
                # prefer theory sig as primary when real was a single lonely strip
                table[k]["variants"] = variants
            else:
                table[k] = {"names": [], "source": "theory", "variants": variants}

    # 3) spelling aliases -> emit a corpus-spelling entry pointing at the real-data entry
    for a, tgt in ALIAS.items():
        if tgt in table and a not in table:
            table[a] = {**table[tgt], "alias_of": tgt}

    # report
    missing = sorted(k for k in corpus if k not in table)
    print(f"makams with a signature: {len(table)}  | corpus makams: {len(corpus)}  | "
          f"still missing: {len(missing)}")
    if missing:
        print("  MISSING (add to THEORY):", ", ".join(missing))
    for k in sorted(table):
        vs = "  ".join(f"[{v['sig']}]·{v['weight']}" for v in table[k]["variants"])
        print(f"  {k:20} ({table[k]['source']:11}) {vs}")

    if not args.dry_run:
        with open(args.out, "w") as f:
            json.dump(table, f, ensure_ascii=False, indent=2, sort_keys=True)
        print(f"\nwrote {args.out} ({len(table)} makams)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
