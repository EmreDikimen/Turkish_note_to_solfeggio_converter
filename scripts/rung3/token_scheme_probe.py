"""Round 4 step 1 — how long are labels under the new spelling, and do rare pitches segment stably?

Two questions, both free (no GPU, no model, no decode). They gate the round's vocabulary change:

  1. **The length distributions.** A synthetic strip was packed to fit 57 OLD ids. A real strip
     after the re-emit fills up to 59 NEW ids. If the real tail is absent from synthetic, the model
     would meet long dense labels only on real pages — which is the one reason the "no new render"
     decision would reopen (docs/rung3/round4.md).

  2. **The rare-pitch segmentation trap.** Scheme H fuses the 14 pitches with >=1,000 notes and
     leaves 7 compositional. `a'''8` must come out `a` `'''` `8` EVERY time — never sometimes
     `a''` `'` `8`. docs/rung3/tokenization.md verified the split-evidence trap for scheme B only;
     H adds fused tokens whose trie match can re-cut the letter.

Schemes (docs/rung3/tokenization.md):
  today  ADDED_TOKENS only                       — the live vocabulary
  B      + `'` `''` `'''` `16` `32`              — durations + octaves
  H      B + the 14 fused letter+octave pitches  — the Round-4 recommendation

⚠ The real pool measured here is `strips_b8`'s emit as it stands: the 3,929 accepted rows plus the
4,012 dropped `over_budget` ones, whose labels `emit_responses.json` kept. The Round-4 re-emit will
re-cut those windows under the rail at b = 57, so this is the closest proxy available, not the pool
that will exist. Nothing here re-decodes.

    .venv-ml/bin/python scripts/rung3/token_scheme_probe.py
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from transformers import AutoProcessor

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from vision.data import ADDED_TOKENS  # noqa: E402

SYNTH = ROOT / "data/synthetic/strips_v7_final/manifest.jsonl"
B8 = ROOT / "data/real/rung3/strips_b8"
GATE = 59          # audit_coverage.MAX_IDS — what drops a strip from training.
                   # ⚠ THE H POOLS ARE EMITTED AT 80 (owner, 2026-09-07); this stays 59
                   # so the numbers already recorded here reproduce.
                   # docs/METRICS-SLICER-WINDOWS.md
RAIL = 57          # the Round-4 label-budget rail

# Scheme B: the four genuinely missing pieces, plus `'` promoted so a pitch letter cannot take two
# id forms depending on what follows it (docs/rung3/tokenization.md, "the implementation trap").
B_TOKENS = ["'", "''", "'''", "16", "32"]
# Scheme H: the 14 letter+octave pairs with >=1,000 notes in the corpus. FROZEN once chosen — ids
# are append-only, so a pitch that is rare today stays compositional forever.
H_FUSED = ["a'", "a''", "b'", "b''", "c''", "c'''", "d'", "d''", "e'", "e''", "f'", "f''", "g'", "g''"]
H_COMPOSITIONAL = ["a", "b", "g", "c'", "a'''", "d'''", "e'''"]
# ⚠ H does NOT take B's `''` and `'''` (measured 2026-09-06: both are used ZERO times, because
# the fused set covers all seven letters at `''`, and `d'''` matches as `d''` + `'`). Adding them
# anyway changes no length by any digit and would burn two permanent ids on dead tokens — ids are
# append-only. So H adds `'` (already in the base vocab, promoted so a letter cannot take two id
# forms), `16`, `32` and the 14 fused pairs: 16 new ids, vocabulary 100 -> 116.
H_TOKENS = ["'", "16", "32"] + H_FUSED

NOTE_WORD = re.compile(r"^[a-g]'{0,3}(?:1|2|4|8|16|32)\.{0,2}$")


def build(checkpoint: Path, extra: list[str]):
    tok = AutoProcessor.from_pretrained(str(checkpoint)).tokenizer
    tok.add_tokens(ADDED_TOKENS)   # idempotent
    tok.add_tokens(extra)
    return tok


def labels_synth() -> list[str]:
    return [json.loads(l)["label"] for l in SYNTH.read_text().splitlines() if l.strip()]


def labels_real() -> tuple[list[str], list[str]]:
    """(accepted, over_budget) — the second from emit_responses, which kept the dropped labels."""
    accepted = [json.loads(l)["label"] for l in (B8 / "manifest.jsonl").read_text().splitlines() if l.strip()]
    dropped = {
        r["strip"] for r in csv.DictReader((B8 / "emit_drops.csv").open()) if r["reason"] == "over_budget"
    }
    resp = json.loads((B8 / "emit_responses.json").read_text())
    over = [r["label"] for r in resp if r["id"] in dropped and r.get("label")]
    return accepted, over


def lengths(tok, labels: list[str]) -> np.ndarray:
    # +1 for the EOS the collate appends by hand (src/vision/data.py) — the budget counts it.
    return np.array([len(tok(t).input_ids) + 1 for t in labels])


def describe(name: str, n: np.ndarray) -> dict:
    return {
        "pool": name, "n": len(n), "mean": n.mean(), "p50": np.percentile(n, 50),
        "p90": np.percentile(n, 90), "p95": np.percentile(n, 95), "p99": np.percentile(n, 99),
        "max": n.max(), f"over{RAIL}": int((n > RAIL).sum()), f"over{GATE}": int((n > GATE).sum()),
    }


def print_table(rows: list[dict]) -> None:
    cols = list(rows[0])
    w = [max(len(c), *(len(f"{r[c]:.1f}" if isinstance(r[c], float) else str(r[c])) for r in rows)) for c in cols]
    print("  ".join(c.ljust(x) for c, x in zip(cols, w)))
    for r in rows:
        print("  ".join((f"{r[c]:.1f}" if isinstance(r[c], float) else str(r[c])).ljust(x) for c, x in zip(cols, w)))


def segmentation(tok, labels: list[str], name: str) -> None:
    """Every distinct note word in the corpus. Reports notes spelled in a MINORITY id form.

    The trap is that one pitch takes two id forms depending on the duration that follows it, so the
    model learns that pitch twice from split evidence. Counting *pitches* overstates it wildly — one
    rare duration taints a whole pitch — so what is reported is the share of NOTES that fall in a
    non-dominant form.
    """
    words = Counter(w for t in labels for w in t.split() if NOTE_WORD.match(w))
    heads: dict[str, Counter] = defaultdict(Counter)
    per_word: dict[str, tuple[str, ...]] = {}
    for w, n in words.items():
        pieces = tuple(tok.convert_ids_to_tokens(tok(w).input_ids))
        per_word[w] = pieces
        head = []
        for piece in pieces:
            if re.match(r"^\d", piece.replace("</w>", "")):
                break
            head.append(piece)
        heads[re.match(r"^[a-g]'{0,3}", w).group(0)][tuple(head)] += n

    total = sum(words.values())
    minority = sum(n - c.most_common(1)[0][1] for c in heads.values() for n in [sum(c.values())])
    split = {p: c for p, c in heads.items() if len(c) > 1}
    print(f"\n--- segmentation, scheme {name} ---")
    print(f"distinct note words {len(words)}   notes {total}")
    print(f"pitches with >1 id form: {len(split)}   NOTES in a minority form: {minority} "
          f"({100 * minority / total:.3f}%)")
    for pitch, c in sorted(split.items()):
        print(f"  {pitch:<5} " + " · ".join(f"{'+'.join(f)}={n}" for f, n in c.most_common()))
    print("the 7 compositional pitches, every duration seen:")
    for pitch in H_COMPOSITIONAL:
        ws = sorted((w for w in words if re.match(r"^[a-g]'{0,3}", w).group(0) == pitch),
                    key=lambda x: -words[x])
        if not ws:
            print(f"  {pitch:<5} — not present in these pools")
            continue
        print(f"  {pitch:<5} n={sum(words[w] for w in ws):<7} " +
              " · ".join(f"{w}={'+'.join(per_word[w])}({words[w]})" for w in ws[:5]))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", default="data/checkpoints/r3a-stage2-best-real")
    ap.add_argument("--json-out", default="")
    args = ap.parse_args()

    ck = ROOT / args.checkpoint
    schemes = {"today": [], "B": B_TOKENS, "H": H_TOKENS}
    toks = {}
    for name, extra in schemes.items():
        t = build(ck, extra)
        toks[name] = t
        print(f"{name:<6} vocabulary {len(t)}")

    synth = labels_synth()
    accepted, over = labels_real()
    print(f"\nsynthetic {len(synth)}   real accepted {len(accepted)}   real over_budget {len(over)}")

    out = {}
    for name, tok in toks.items():
        ls, la, lo = lengths(tok, synth), lengths(tok, accepted), lengths(tok, over)
        rescued = int((lo <= GATE).sum())
        proj = np.concatenate([la, lo[lo <= GATE]])
        rows = [describe("synthetic v7_final", ls), describe("real b8 accepted", la),
                describe("real b8 over_budget", lo), describe("real PROJECTED pool", proj)]
        print(f"\n=== scheme {name} ===   rescued of {len(over)} over_budget: {rescued} "
              f"({100 * rescued / len(over):.1f}%)   projected real pool: {len(proj)}")
        print_table(rows)
        # ⭐ The coverage question round4.md asks: does synthetic still contain the real tail?
        smax, sp99 = int(ls.max()), int(np.percentile(ls, 99))
        above_p99 = int((proj > sp99).sum())
        above_max = int((proj > smax).sum())
        print(f"  synthetic covers to max {smax} (p99 {sp99}).  real strips LONGER than synthetic's "
              f"max: {above_max} ({100 * above_max / len(proj):.1f}% of the real pool); "
              f"longer than its p99: {above_p99} ({100 * above_p99 / len(proj):.1f}%)")
        out[name] = {"rows": rows, "rescued": rescued, "projected": len(proj),
                     "synth_max": smax, "synth_p99": sp99,
                     "real_above_synth_max": above_max, "real_above_synth_p99": above_p99}
        segmentation(tok, synth + accepted + over, name)

    if args.json_out:
        Path(args.json_out).write_text(json.dumps(out, indent=2, default=float))


if __name__ == "__main__":
    main()
