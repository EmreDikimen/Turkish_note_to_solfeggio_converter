"""
Build the DOTTED (USUL) BARLINE's paired pilot pools — the instrument
`usul_falserep_score.py` reads.

WHAT IT MAKES. Two strip pools, `_usul_falserep_ctl` and `_usul_falserep_usul`, holding the SAME
music with byte-identical manifests, differing only in whether the dashed usul rules are drawn.
That pairing is the whole design: greedy decode is deterministic, so a strip is its own control and
any `\repstart` that appears only on the ruled side was caused by the mark.

HOW A STRIP IS SELECTED — and why it is not done by re-deriving the coin. The rule fires on a piece
when `mulberry32(hashStr(f"{slug}:usulbar"))() < USUL_BAR_RATE` AND its meter is in
`USUL_BEAM_GROUPS` with at least two groups. Reproducing that here would mean a second copy of the
coin, the hash and the meter table in a second language — the exact duplication that cost Round 1
(docs/METRICS.md). So this script does not predict where the flag fired; it MEASURES it, by
comparing the two renders' PNGs. A strip whose bytes differ is a strip the flag drew on. That is
ground truth, it needs no table, and it cannot drift away from the renderer.

Two filters on top:
  * the gold must carry ZERO `\repstart` — the metric is "did a repeat sign appear at all", which
    only means anything if none was ever due. Same construction as the staccato pools' zero dotted
    durations.
  * the strip must exist in BOTH renders with the SAME label, or it cannot be paired.

⚠ THE TWO RENDERS MUST DIFFER IN THIS ONE FLAG AND NOTHING ELSE. Pass `--concave-tuplet` and
`--staccato-noise` to BOTH or to NEITHER; a seed that moves between them breaks the pairing
silently, because the manifests would still look reasonable. The plan below does this correctly —
prefer it to typing the renders by hand.

Run:
    .venv-ml/bin/python scripts/rung3/make_usul_pools.py --plan     # print the two render commands
    .venv-ml/bin/python scripts/rung3/make_usul_pools.py            # select + write the pools
"""

from __future__ import annotations

import argparse
import json
import random
import shutil
from hashlib import sha256
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

CTL_RENDER = "data/synthetic/_usul_pilot_ctl"
USUL_RENDER = "data/synthetic/_usul_pilot_usul"
CTL_OUT = "data/synthetic/_usul_falserep_ctl"
USUL_OUT = "data/synthetic/_usul_falserep_usul"

PLAN = """\
# 1. A SMALL piece list — the full corpus is not needed for a 110-strip pilot, and a big render here
#    would cost as much as the real one. 40 pieces is sized, not guessed: of the corpus's 208, 105
#    carry a usul whose conventional meter USUL_BEAM_GROUPS rules (aksak 9/8, duyek 8/8, curcuna and
#    aksaksemai 10/8, yürük semai 6/8, ağır aksak 9/4), and USUL_BAR_RATE = 0.35 of those come up
#    heads. So 40 pieces expects ~8 that draw rules, at ~196 strips a piece — a wide margin over the
#    110 needed, on about a fifth of a full corpus render.
.venv-ml/bin/python scripts/rung3/make_usul_pools.py --write-list --pieces 40

# 2. TWO renders, identical but for the one flag. Both carry the other two final-render flags so the
#    pilot pixels look like the corpus the model will actually be trained on.
npx --yes tsx tools/render/render.ts --pieces data/pieces_usul_pilot.json \\
    --out {ctl_render} --thin-sharps --staccato-noise --concave-tuplet
npx --yes tsx tools/render/render.ts --pieces data/pieces_usul_pilot.json \\
    --out {usul_render} --thin-sharps --staccato-noise --concave-tuplet --usul-barline

# 3. Select the paired strips (this script, no flags) -> {ctl_out} / {usul_out}
.venv-ml/bin/python scripts/rung3/make_usul_pools.py

# 4. Read the instrument
.venv-ml/bin/python scripts/rung3/usul_falserep_score.py \\
    --checkpoint data/checkpoints/round2-stage2-best
"""


def sha(p: Path) -> str:
    return sha256(p.read_bytes()).hexdigest()


def load(root: Path) -> dict[str, dict]:
    mf = root / "manifest.jsonl"
    if not mf.exists():
        raise SystemExit(f"{mf} missing — run the renders first:\n\n"
                         + PLAN.format(ctl_render=CTL_RENDER, usul_render=USUL_RENDER,
                                       ctl_out=CTL_OUT, usul_out=USUL_OUT))
    return {r["image"]: r for r in (json.loads(l) for l in mf.open() if l.strip())}


def write_list(n: int) -> int:
    """A piece SUBSET of data/pieces_v4.json, so the pilot renders in minutes not hours.

    Sampled with a fixed seed from the corpus's own list, so the pilot is reproducible and is not
    hand-picked toward meters the flag likes — the selection of which strips carry a rule happens
    later, and by measurement."""
    src = json.loads((REPO / "data/pieces_v4.json").read_text())
    pieces = src["pieces"]
    picked = random.Random(20260831).sample(pieces, min(n, len(pieces)))
    out = dict(src)
    out["pieces"] = picked
    out["generatedBy"] = "scripts/rung3/make_usul_pools.py --write-list"
    dst = REPO / "data/pieces_usul_pilot.json"
    dst.write_text(json.dumps(out, indent=1))
    print(f"wrote {dst} — {len(picked)} of {len(pieces)} pieces")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--plan", action="store_true", help="print the render commands and exit")
    ap.add_argument("--write-list", action="store_true", help="write data/pieces_usul_pilot.json")
    ap.add_argument("--pieces", type=int, default=40, help="how many pieces in that list")
    ap.add_argument("--limit", type=int, default=110,
                    help="strips per pool (110 matches the staccato pools)")
    ap.add_argument("--ctl-render", default=CTL_RENDER)
    ap.add_argument("--usul-render", default=USUL_RENDER)
    args = ap.parse_args()

    if args.plan:
        print(PLAN.format(ctl_render=args.ctl_render, usul_render=args.usul_render,
                          ctl_out=CTL_OUT, usul_out=USUL_OUT))
        return 0
    if args.write_list:
        return write_list(args.pieces)

    ctl_root, usul_root = REPO / args.ctl_render, REPO / args.usul_render
    ctl, usul = load(ctl_root), load(usul_root)
    shared = sorted(set(ctl) & set(usul))
    print(f"{len(ctl)} ctl / {len(usul)} usul strips, {len(shared)} shared filenames")

    same_label = [i for i in shared if ctl[i]["label"] == usul[i]["label"]]
    if len(same_label) != len(shared):
        # LABEL-FREE is the flag's central claim, so this is not a warning to skip past.
        print(f"⚠ {len(shared) - len(same_label)} shared strips have DIFFERENT labels across the two "
              f"renders — the flag is supposed to be label-free. Excluded, but investigate.")

    no_rep = [i for i in same_label if "\\repstart" not in ctl[i]["label"]]
    print(f"{len(no_rep)} of those carry no \\repstart in the gold")

    ruled = [i for i in no_rep if sha(ctl_root / i) != sha(usul_root / i)]
    print(f"⭐ {len(ruled)} of those actually CHANGED PIXELS — the flag drew a rule on them")
    if not ruled:
        raise SystemExit("no strip differs between the renders — was --usul-barline actually passed?")

    picked = ruled[:args.limit]
    for out_name, root in ((CTL_OUT, ctl_root), (USUL_OUT, usul_root)):
        out = REPO / out_name
        if out.exists():
            shutil.rmtree(out)
        out.mkdir(parents=True)
        with (out / "manifest.jsonl").open("w") as f:
            for i in picked:
                shutil.copy2(root / i, out / i)
                # ⚠ Write the CTL row into BOTH manifests. The two are meant to be byte-identical,
                # and taking each from its own render would silently copy across any seed the
                # renderer happens to record differently.
                f.write(json.dumps(ctl[i]) + "\n")
        print(f"wrote {out_name}: {len(picked)} strips")

    a = (REPO / CTL_OUT / "manifest.jsonl").read_bytes()
    b = (REPO / USUL_OUT / "manifest.jsonl").read_bytes()
    print(f"manifests byte-identical: {a == b}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
