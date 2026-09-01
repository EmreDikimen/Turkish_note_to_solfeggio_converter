r"""Group a model's mistakes by KIND, so a human can decide from them (docs/rung3/round3-criteria.md §3c).

WHY THIS EXISTS. §3c was re-settled on 2026-08-31: the numeric floor stopped being the automatic
ship gate, and the launch call is taken by the owner *after reading an error classification*. Without
this the decision has no input — `eval_omr.py` prints a rate and a per-class AEU table, neither of
which answers "what kind of thing does it get wrong, and would I mind?".

⛔ **THIS TOOL ALIGNS ON LABEL TOKENS, NOT ON TOKENIZER IDS.** `eval_omr.py` and
`paired_arm_score.py` both count edits in ID space, so their numbers agree with each other; a note
like `c''8` is several ids there, and an id is a sub-word fragment that has no musical category. A
taxonomy has to speak in `c''8`, so this file rebuilds the label tokens first. ⚠ **Its counts are
therefore NOT eval_omr's edit counts and must never be quoted beside them as if they were.** The
alignment FUNCTION is still `eval_omr.align`, imported and fed interned tokens — the sequences are
different, the algorithm is not re-implemented.

⛔ **YOU CANNOT GET LABEL TOKENS BY CALLING .split() ON EITHER SIDE, AND THE FIRST VERSION OF THIS
FILE DID EXACTLY THAT.** The tokenizer's `decode` drops the space AFTER every added token, so
`\bakiyeSharp c''4` comes back as `\bakiyeSharpc''4` — that is detokenization, not a model error, and
it hit **148 of 200** gold labels, inflating the error count and dumping ~30% of everything into
"other". `relabel()` repairs it by re-splitting on the added-token vocabulary, and **both sides go
through it**, so any artifact is symmetric. Three traps it has to carry, each found by testing:
  1. ⛔ **`3` is excluded from the splitter.** It is the tuplet digit AND the first character of the
     duration `32`, so greedy matching turned `g''32` into `["g''", "3", "2"]`. A standalone `3` is
     whitespace-delimited already.
  2. ⛔ **Longest-match-first**, or `\sigend` splits into `\sig` + `end`.
  3. ⚠ **The `f'' 32` spacing is re-glued**, same rule and regex as `promote_labels.norm_label` —
     the model emits `32` spaced and it is measured to be identical in id space. `32` ONLY.
⭐ Verified before use: with all three, decode(encode(gold)) reconstructs gold on **267 of 267**
real-val labels. ⚠ Incidental finding: **52 of 267 gold labels are stored GLUED in the manifest**
(`\volta2g''4.`), so `.split()` is not a correct tokenization of the gold either; `relabel()` repairs
that side too.

⚠ **ONE MISTAKE CAN RAISE TWO CATEGORIES, ON PURPOSE.** A substitution of `c''8` by `d''4` is a pitch
error *and* a duration error; splitting it is the entire point, because "40% of user edits are pitch"
is the kind of claim this is meant to support. So the category counts sum to more than the edit
count, and both totals are printed. Never derive a rate by dividing one by the other.

THE LENGTH BUCKETS ARE THE HEADLINE (owner, 2026-09-01). Short and medium strips are the target;
long strips and badly-written notes are a stated future concern. So every table is cut by gold
length and the SHORT+MID block is reported first, with LONG kept visible but separate rather than
pooled into a single misleading average. Buckets match the ones the real-val regression analysis
used, so the two readings line up: short <30, mid 30-49, long >=50 gold **ids**. ⚠ **Ids, not label
tokens** — `paired_arm_score.py` measures `goldTokens` in id space and the 2026-09-01 scope decision
quotes its buckets, so bucketing on label tokens here (about a third as many) would put 261 of 262
strips in "short" and silently answer a different question. That happened in the first version.

⚠ **REHEARSE ON REAL-VAL, NOT ON THE EXAM.** The exam is one-shot (§4). Developing a measuring stick
against the exam's output is reading the exam. Point this at `_realval_v2` until the read.

Run:
    .venv-ml/bin/python scripts/rung3/error_taxonomy.py \
        --checkpoint data/checkpoints/r3-final-stage2-last \
        --pool data/real/rung3/_realval_v2

    # what a round CHANGED, category by category
    .venv-ml/bin/python scripts/rung3/error_taxonomy.py \
        --checkpoint data/checkpoints/r3-final-stage2-last \
        --compare data/checkpoints/round2-stage2-best \
        --pool data/real/rung3/_realval_v2 --out data/real/rung3/final/taxonomy.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "src" / "vision"))


from data import ADDED_TOKENS  # noqa: E402  (path is set above)

# ⛔ '3' excluded, longest-first — see the header's trap list.
_SPLIT_ORDER = sorted([t for t in ADDED_TOKENS if t != "3"], key=len, reverse=True)
SPACED_32_RE = re.compile(r"(?<=\S)\s+32\b")   # promote_labels.norm_label's rule, 32 ONLY


def relabel(text: str) -> list[str]:
    """Model/gold text -> LABEL tokens, repairing the tokenizer's dropped spaces. See the header."""
    text = SPACED_32_RE.sub("32", text)
    out, buf, i, n = [], "", 0, len(text)
    while i < n:
        if text[i].isspace():
            if buf:
                out.append(buf); buf = ""
            i += 1
            continue
        hit = next((t for t in _SPLIT_ORDER if text.startswith(t, i)), None)
        if hit:
            if buf:
                out.append(buf); buf = ""
            out.append(hit); i += len(hit)
            continue
        buf += text[i]; i += 1
    if buf:
        out.append(buf)
    return out


# A note is letter + octave marks + duration + dots: c''8, b'16, a''2, f'8., e,4
NOTE_RE = re.compile(r"^([a-g])([',]*)(\d+)(\.*)$")
REST_RE = re.compile(r"^r(\d+)(\.*)$")
# Inside a \sig block the pitch letters appear bare, with no duration: "\sig \bakiyeSharp f \sigend"
BARE_LETTER_RE = re.compile(r"^[a-g]$")

ACCIDENTALS = {"\\komaSharp", "\\bakiyeSharp", "\\kucukSharp", "\\buyukSharp",
               "\\komaFlat", "\\bakiyeFlat", "\\kucukFlat", "\\buyukFlat", "\\natural"}
REPEAT = {"\\repstart", "\\repend", "\\volta1", "\\volta2", "\\segno", "\\coda", "\\dc", "\\fine"}
TUPLET = {"\\tup3", "\\tupend", "3"}
SIGMARK = {"\\sig", "\\sigend"}

# Order is the reporting order, and it is deliberate: the two the owner's edit budget is dominated by
# come first (pitch 40%, duration 28% — docs/METRICS.md), then the ones a reader can judge by eye.
CATEGORIES = ["pitch", "duration", "accidental", "signature", "repeat-structure",
              "tuplet", "barline", "note-vs-rest", "note-missing", "note-extra", "grace", "other"]

BUCKETS = [("short <30", 0, 29), ("mid 30-49", 30, 49), ("long >=50", 50, 10 ** 9)]
PRIORITY = ("short <30", "mid 30-49")   # owner, 2026-09-01


def bucket_of(n_gold: int) -> str:
    for name, lo, hi in BUCKETS:
        if lo <= n_gold <= hi:
            return name
    return BUCKETS[-1][0]


def sig_mask(tokens: list[str]) -> list[bool]:
    """True where a token sits inside a \\sig ... \\sigend span (the markers included).

    The signature is the one region whose errors are categorically different — a wrong `\\sig` block
    mis-keys the whole strip, and BACKLOG item 9 says every `\\sig` in a real-page label is itself
    unverified. Lumping those in with inline accidentals would hide both facts.
    """
    out, inside = [], False
    for t in tokens:
        if t == "\\sig":
            inside = True
        out.append(inside)
        if t == "\\sigend":
            inside = False
    return out


def classify(op: str, ref: str | None, hyp: str | None, in_sig: bool) -> list[str]:
    """One alignment op -> the categories it raises. May return more than one; see the header."""
    if in_sig:
        return ["signature"]

    tok = ref if ref is not None else hyp
    if op == "sub":
        rm, hm = NOTE_RE.match(ref or ""), NOTE_RE.match(hyp or "")
        if rm and hm:
            cats = []
            if (rm.group(1), rm.group(2)) != (hm.group(1), hm.group(2)):
                cats.append("pitch")
            if (rm.group(3), rm.group(4)) != (hm.group(3), hm.group(4)):
                cats.append("duration")
            # A substitution the regex says is identical cannot happen (they'd be a match), but be
            # explicit rather than returning [] and silently losing an error from the totals.
            return cats or ["other"]
        rr, hr = REST_RE.match(ref or ""), REST_RE.match(hyp or "")
        if rr and hr:
            return ["duration"]
        if (rm and hr) or (rr and hm):
            return ["note-vs-rest"]
        if (ref in ACCIDENTALS) or (hyp in ACCIDENTALS):
            return ["accidental"]
        if (ref in REPEAT) or (hyp in REPEAT):
            return ["repeat-structure"]
        if (ref in TUPLET) or (hyp in TUPLET):
            return ["tuplet"]
        return ["other"]

    # del (model dropped it) / ins (model invented it) — one token, categorised by what it is
    if tok in ACCIDENTALS:
        return ["accidental"]
    if tok in REPEAT:
        return ["repeat-structure"]
    if tok in TUPLET:
        return ["tuplet"]
    if tok in SIGMARK:
        return ["signature"]
    if tok == "|":
        return ["barline"]
    if tok == "\\grace":
        return ["grace"]
    if NOTE_RE.match(tok or "") or REST_RE.match(tok or "") or BARE_LETTER_RE.match(tok or ""):
        return ["note-missing" if op == "del" else "note-extra"]
    return ["other"]


def decode_pool(ckpt: str, pool: str, batch_size: int, max_length: int, device: str | None):
    """{image -> (gold_text, decoded_text, n_gold_ids)}. Decoding is expensive, so it is cached.

    ⚠ `n_gold_ids` is measured exactly as `eval_omr` / `paired_arm_score` measure `goldTokens`, in
    ID space, because that is what the length buckets are defined on."""
    import torch
    from data import StripDataset
    from eval_omr import strip_special
    from modeling import load_model_and_processor

    dev = device or ("cuda" if torch.cuda.is_available()
                     else "mps" if torch.backends.mps.is_available() else "cpu")
    model, processor, added = load_model_and_processor(ckpt)
    if added:
        raise SystemExit(f"{ckpt} is missing {added} project tokens — that is the base model, "
                         f"not a trained checkpoint")
    model.to(dev).eval()
    ds = StripDataset(pool)
    out: dict[str, tuple[str, str, int]] = {}
    with torch.no_grad():
        for at in range(0, len(ds), batch_size):
            batch = [ds[i] for i in range(at, min(at + batch_size, len(ds)))]
            pv = processor(images=[im for im, _ in batch], return_tensors="pt").pixel_values
            gen = model.generate(pv.to(dev), max_length=max_length)
            for k, ((_, label), got) in enumerate(zip(batch, gen.tolist())):
                tk = processor.tokenizer
                text = tk.decode(got, skip_special_tokens=True)
                n_ids = len(strip_special(tk(label, add_special_tokens=True).input_ids, tk))
                out[ds.strips[at + k].image_path.name] = (label, text, n_ids)
            print(f"\r   decoded {min(at + batch_size, len(ds))}/{len(ds)}", end="", file=sys.stderr)
    print("", file=sys.stderr)
    return out


def cached_decode(ckpt: str, pool: str, cache_dir: Path, args) -> dict[str, tuple[str, str, int]]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = f"{Path(ckpt).name}__{Path(pool).name}.json"
    p = cache_dir / key
    if p.exists() and not args.refresh:
        print(f"   cache hit: {p}", file=sys.stderr)
        return {k: tuple(v) for k, v in json.loads(p.read_text()).items()}
    print(f"   decoding {Path(ckpt).name} over {Path(pool).name} ...", file=sys.stderr)
    out = decode_pool(ckpt, pool, args.batch_size, args.max_length, args.device)
    p.write_text(json.dumps({k: list(v) for k, v in out.items()}, indent=1))
    return out


def tally(decodes: dict[str, tuple[str, str, int]]):
    """-> per-bucket category counts, per-bucket strip stats, and example ops for a reader."""
    from eval_omr import align

    cats = defaultdict(Counter)          # bucket -> Counter(category)
    stats = defaultdict(Counter)         # bucket -> Counter(strips/exact/token_edits)
    examples = defaultdict(lambda: defaultdict(list))   # bucket -> category -> [(img, ref, hyp)]

    for img, (gold, got, n_ids) in sorted(decodes.items()):
        ref, hyp = relabel(gold), relabel(got)     # ⛔ never .split() — see the header
        b = bucket_of(n_ids)
        stats[b]["strips"] += 1
        if ref == hyp:
            stats[b]["exact"] += 1
            continue
        insig = sig_mask(ref)
        # Intern the label tokens so eval_omr.align (which takes ints) can be reused unchanged.
        vocab: dict[str, int] = {}
        enc = lambda ts: [vocab.setdefault(t, len(vocab)) for t in ts]
        rid, hid = enc(ref), enc(hyp)
        inv = {v: k for k, v in vocab.items()}
        ri = 0
        for op, a, c in align(rid, hid):
            rt = inv[a] if a is not None else None
            ht = inv[c] if c is not None else None
            here = insig[ri] if ri < len(insig) else False
            if op != "match":
                stats[b]["token_edits"] += 1
                for cat in classify(op, rt, ht, here):
                    cats[b][cat] += 1
                    if len(examples[b][cat]) < 40:
                        examples[b][cat].append((img, op, rt, ht))
            if op in ("match", "sub", "del"):
                ri += 1
    return cats, stats, examples


def report(cats, stats, examples, title: str, n_examples: int):
    print(f"\n{'=' * 78}\n== {title}\n{'=' * 78}")
    for group, names in (("⭐ PRIORITY — short + medium strips (owner, 2026-09-01)", PRIORITY),
                         ("⏭ future concern — long strips", ("long >=50",))):
        gc, gs = Counter(), Counter()
        for b in names:
            gc.update(cats[b]); gs.update(stats[b])
        if not gs["strips"]:
            continue
        ex = gs["exact"]
        print(f"\n{group}")
        print(f"   {gs['strips']} strips, {ex} exact ({ex / gs['strips'] * 100:.1f}%), "
              f"{gs['token_edits']} token edits over {gs['strips'] - ex} imperfect strips")
        tot = sum(gc.values())
        if not tot:
            continue
        print(f"   {'category':<18} {'raised':>7} {'share':>7}   (categories sum > edits by design)")
        for c in CATEGORIES:
            if gc[c]:
                print(f"   {c:<18} {gc[c]:>7} {gc[c] / tot * 100:>6.1f}%")
        if n_examples:
            print(f"\n   examples ({n_examples} per category, gold -> decoded):")
            seen = defaultdict(list)
            for b in names:
                for c, lst in examples[b].items():
                    seen[c].extend(lst)
            for c in CATEGORIES:
                for img, op, rt, ht in seen[c][:n_examples]:
                    shown = (f"{rt!r} -> {ht!r}" if op == "sub"
                             else f"DROPPED {rt!r}" if op == "del" else f"INVENTED {ht!r}")
                    print(f"     {c:<17} {shown:<34} {img[:44]}")

    print(f"\n   per-bucket exact rate")
    for name, _, _ in BUCKETS:
        s = stats[name]
        if s["strips"]:
            print(f"     {name:<12} {s['exact']:>4}/{s['strips']:<4} = "
                  f"{s['exact'] / s['strips'] * 100:5.1f}%   {s['token_edits']:>5} token edits")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--compare", help="a second checkpoint; its table is printed for contrast")
    ap.add_argument("--pool", default="data/real/rung3/_realval_v2")
    ap.add_argument("--out", help="write the full per-strip + per-category table as JSON")
    ap.add_argument("--examples", type=int, default=3, help="examples printed per category")
    ap.add_argument("--cache-dir", default="data/real/rung3/final/_taxonomy_cache")
    ap.add_argument("--refresh", action="store_true", help="ignore the decode cache")
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device")
    args = ap.parse_args()

    cache = REPO / args.cache_dir
    result = {"generatedBy": "scripts/rung3/error_taxonomy.py", "pool": args.pool,
              "alignment": "whitespace tokens, NOT tokenizer ids — see the module docstring",
              "buckets": {n: [lo, hi] for n, lo, hi in BUCKETS}, "models": {}}

    for ckpt in [args.checkpoint] + ([args.compare] if args.compare else []):
        dec = cached_decode(ckpt, args.pool, cache, args)
        cats, stats, examples = tally(dec)
        report(cats, stats, examples, Path(ckpt).name, args.examples)
        result["models"][Path(ckpt).name] = {
            "categories": {b: dict(c) for b, c in cats.items()},
            "stats": {b: dict(s) for b, s in stats.items()},
            "examples": {b: {c: v for c, v in e.items()} for b, e in examples.items()},
        }

    if args.out:
        p = REPO / args.out
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(result, indent=1))
        print(f"\n   wrote {args.out}")
    print("\n⚠ Token-level counts. NOT comparable with eval_omr / paired_arm_score edit counts,"
          "\n  which are measured in tokenizer-id space. See the module docstring.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
