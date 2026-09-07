"""Rung 3, step 3 — strip-label emitter: (real strip PNG -> ground-truth token label).

For every SymbTr-matched piece (scripts/rung3/match_symbtr.py -> data/real/rung3/matched/),
aligns the piece's SymbTr measures to its real pages' sliced strips and emits training labels
for exactly the measures inside each strip — content from SymbTr, geometry from the slicer,
token placement from the SAME TypeScript serializer that makes the synthetic labels
(tools/render/labels-cli.ts --ranges, "measure"/carry mode = the printed-page convention).

The alignment trusts the model almost nowhere, and everything uncertain is DROPPED or sent to
human review — a wrong label is worse than no label (docs/rung3/exam.md §3):

  1. DECODE   every page once (slicer geometry + int8 ONNX decode + per-token logprobs).
  2. FOLD     SymbTr writes repeats out twice; the page draws them once. Try every fold subset
              of the detected duplicate runs x the D.S./da-capo TAIL fold (a flattened suffix
              duplicating an earlier run — the printed segno/Son jump written out; 40/85 of
              the matched pieces have it); keep the combination matching the page's measure
              count (tie-breaks: decoded \\repstart / nav-token evidence). Volta spans remap
              volta2 to the printed second ending (flattened index end+L). Nothing within
              2 measures -> piece dropped. Strips touching the jump-mark measures (segno /
              Son / final) or whose decode read a nav token go to REVIEW — their pixels carry
              printed marks our labels don't model; the rest of a jump piece trains normally.
  3. WALK     a piece-global cursor assigns each staff row its printed measures; the row's
              decoded id stream must MATCH the expected reference (normalized Levenshtein
              <= --row-nd). Small cursor/count slips are recovered only when clearly best
              (>= --margin better than the runner-up); everything else drops the row.
              Count corrections (dn != 0) invalidate the slicer's per-strip measure spans, so
              those rows' strips go to review, never straight to training.
  4. EMIT     per accepted strip, the TS CLI serializes its printed measures (carry mode,
              \\sig prefix on row starts — non-empty signatures only). Gates: real-tokenizer
              budget (<= 59 ids incl. EOS, audit_coverage.py's rule), the CLI's in-process
              decodeLabel round-trip, and the DISAGREEMENT check:
                 nd = lev(label_ids, decoded_ids) / len(label_ids)   (empty \\sig pairs
                 stripped from both sides — the current model still emits the old marker)
              nd <= --accept-nd  -> training manifest (+ a seeded --audit-frac sample to
                                    emit_audit.csv: measures the escaped-bad-label rate)
              nd <= --review-nd  -> emit_review.csv (a human can promote later; likely either
                                    an edition difference or a genuinely hard strip)
              else               -> dropped (probably different music), logged with both sides.

Outputs under --out (default data/real/rung3/strips_r1):
  manifest.jsonl   StripDataset-compatible: image/label/mode="measure"/piece(=SymbTr stem —
                   Round-1 split-by-piece then co-splits real+synthetic)/makam/source/from/to
                   + nd/min_logprob review columns
  <strip>.png      hardlinked from data/real/strips/<page>/
  emit_review.csv  strips awaiting human review (verdict column to fill)
  emit_drops.csv   every dropped strip/piece with its reason
  emit_audit.csv   seeded sample of ACCEPTED strips (fill verdict: ok/bad -> noise rate)
  emit_report.json thresholds, per-piece status, nd histogram, drop taxonomy, token counts

Run (calibration first — writes report+CSVs only, no training strips):
    .venv-ml/bin/python scripts/rung3/emit_strip_labels.py --report-only
Then freeze the exam set (scripts/rung3/build_testset.py), and emit for real:
    .venv-ml/bin/python scripts/rung3/emit_strip_labels.py --testset data/real/rung3/testset.json
    .venv-ml/bin/python scripts/rung3/emit_strip_labels.py --exam --out data/real/rung3/strips_exam
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import re
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass, field
from itertools import combinations
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "src" / "vision"))

NAV_TOKENS = ("\\segno", "\\coda", "\\dc", "\\fine")

# The label budget, in TOKEN IDS including the training-time EOS. ⚠ IT IS NOT A MODEL LIMIT — the
# model's real ceiling is 100, in two places at once: `MAX_TOKENS` in apps/web/src/omr/decode.ts and
# `collate(max_len=100)` in src/vision/data.py, which TRUNCATES a longer label at 99 and would teach
# the model to stop early. This is the emitter's QUALITY gate, and it is a choice.
#
# ⭐ **80 UNDER SCHEME H (owner, 2026-09-07)**, where every earlier pool used 59. The owner had
# watched the live model read strips of 85-90 ids correctly — in the OLD id space, so the finding is
# that the DECODER walks 85-90 steps, and H buys real headroom on top of it. Measured the same day
# over b8's 15,758 serialized labels: at 59 the rail re-cuts 504 windows (3.20%), at 80 only 148
# (0.94%), and 356 dense strips train WHOLE that would otherwise be halved. 80 leaves 20 ids of
# margin under the hard ceiling. ⛔ Do not raise it to 100: that is the truncation cliff itself.
# docs/METRICS-SLICER-WINDOWS.md
#
# ⚠ IT MOVES WITH THE VOCABULARY, and must: an H label is ~40% shorter than the same music under the
# old vocabulary, so one number cannot serve both. The pairing is here so a pool cannot be emitted
# under H at the old pool's gate, or vice versa, by forgetting a flag.
MAX_IDS_BY_VOCAB = {"old": 59, "h": 80}   # `old` is what every pool before 2026-09-07 used

# Decoded-signature parsing (the detokenized decode glues tokens: "\\sig\\bakiyeFlata ...").
SIG_BLOCK_RE = re.compile(r"\\sig(.*?)\\sigend", re.S)
SIG_ENTRY_RE = re.compile(r"(\\(?:koma|bakiye|kucuk|buyuk)(?:Sharp|Flat))\s*([a-g])")
ACC_COMMAS = {"\\komaSharp": 1, "\\bakiyeSharp": 4, "\\kucukSharp": 5, "\\buyukSharp": 8,
              "\\komaFlat": -1, "\\bakiyeFlat": -4, "\\kucukFlat": -5, "\\buyukFlat": -8}


MAKAM_SIGNATURES = REPO / "data/makam_signatures.json"


def load_makam_table() -> dict[str, dict[str, int]]:
    """makam name (every spelling the table knows) -> its MAJORITY printed variant, as
    {letter: commas}. Used only to decide whether a vote that DELETES or CHANGES an accidental
    should be reviewed instead of applied — never to write a signature.

    ⚠ **Majority, not "any listed variant"** (owner, 2026-09-06). Mahur genuinely prints both
    spellings in our own sources (`\\kucukSharp` n=35, `\\komaSharp` n=17), so accepting any listed
    variant would vouch for the vote on **31 mahur pieces** in exactly the direction the owner
    corrected by hand 10 times out of 10 — the rule would be blind where the defect was found.
    A minority-spelled edition therefore reaches review and is confirmed by eye.
    docs/METRICS-SIGVOTE.md."""
    raw = json.loads(MAKAM_SIGNATURES.read_text())
    out: dict[str, dict[str, int]] = {}
    for key, entry in raw.items():
        best = max(entry["variants"], key=lambda v: (v.get("n", 0), v.get("weight", 0)))
        majority = {letter: ACC_COMMAS[acc] for acc, letter in SIG_ENTRY_RE.findall(best["sig"])}
        for name in [key, *entry.get("names", [])]:
            out[name.replace("_", "").lower()] = majority
    return out


def sig_needs_review(derived: tuple, voted: tuple, makam: str,
                     table: dict[str, dict[str, int]]) -> bool:
    """Rule D (owner, 2026-09-06) — should this piece's signature go to a human instead of
    letting the model's vote overwrite the derivation?

    YES when the vote DELETES an accidental the derivation had, or CHANGES one on a letter both
    carry, AND the voted signature is not `data/makam_signatures.json`'s MAJORITY spelling for the
    makam (or the makam is not in the table at all, so nothing can vouch for it).

    NO for a vote that only ADDS an accidental or only re-orders. Adding is the case the override
    was built for — a real edition prints the makam's conventional signature, which routinely
    carries signs SymbTr's content-derivation lacks — and a re-order changes no pitch.

    Why deletion is the trigger: audited 2026-09-06 over five pools, 410 overrides delete an entry
    against 156 that alter one, and 106 of the deleted entries were in the derivation. The model
    did not SEE the accidental, and its silence overwrote a correct one — invisible downstream,
    because the `nd` gate strips `\\sig` blocks from both sides. docs/METRICS-SIGVOTE.md.
    """
    d = {letter: ACC_COMMAS[acc] for acc, letter in derived}
    v = {letter: ACC_COMMAS[acc] for acc, letter in voted}
    drops = [k for k in d if k not in v]
    alters = [k for k in d if k in v and d[k] != v[k]]
    if not (drops or alters):
        return False
    majority = table.get(makam.replace("_", "").lower())
    if majority is None:
        return True                       # unjudgeable — 14 corpus makams have no table entry
    return majority != v


def decoded_sig_entries(tokens: str) -> tuple | None:
    """The signature the model read off a row-start strip, as ((acc_token, letter), ...) in
    drawn order — None when no \\sig block was decoded at all."""
    m = SIG_BLOCK_RE.search(tokens)
    if not m:
        return None
    return tuple((acc, letter) for acc, letter in SIG_ENTRY_RE.findall(m.group(1)))


# ------------------------------------------------------------------------------ small helpers
def lev(a: list[int], b: list[int]) -> int:
    """Levenshtein distance, two-row DP (eval_omr.align's cost without the backtrace —
    the emitter only needs the distance, and the row loop calls this thousands of times)."""
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, y in enumerate(b, 1):
            cur[j] = min(prev[j - 1] + (x != y), prev[j] + 1, cur[j - 1] + 1)
        prev = cur
    return prev[-1]


@dataclass
class Span:
    """A detected repeat span (labels.json `repeats`); volta2 remapped when folded — see fold()."""
    start: int
    end: int
    volta2: int | None = None


def printed_sequence(measure_count: int, spans: list[Span], folded: set[int], dc_cut: int = 0):
    """Flattened 1-based measure indices -> printed page order, folding the chosen spans.

    Exact repeat: the 2nd pass (end+1 .. end+L) is not printed. Volta: the duplicate head
    (end+1 .. end+L-1) is not printed; the TRUE second ending (end+L) is printed under the
    "2." bracket — so the adjusted span carries volta2 = end+L (repeats.ts's volta2 points at
    the flattened duplicate head, a DRAWN position that only exists on the synthetic render).

    `dc_cut` > 0 folds a D.S./da-capo TAIL: the last dc_cut flattened measures duplicate an
    earlier run (the page prints segno/Son marks and plays the jump; SymbTr writes it out) —
    they are not printed. Spans inside the cut tail are ignored.
    """
    skip: set[int] = set(range(measure_count - dc_cut + 1, measure_count + 1))
    adj: list[Span] = []
    for k, sp in enumerate(spans):
        if k not in folded or sp.start > measure_count - dc_cut:
            continue  # unfolded (page writes it out) / span lives in the cut tail
        length = sp.end - sp.start + 1
        if sp.volta2 is None:
            skip |= set(range(sp.end + 1, sp.end + length + 1))
            adj.append(Span(sp.start, sp.end))
        else:
            skip |= set(range(sp.end + 1, sp.end + length))
            adj.append(Span(sp.start, sp.end, sp.end + length))
    printed = [i for i in range(1, measure_count + 1) if i not in skip]
    return printed, adj


def detect_dc_tail(measure_labels: dict[int, str], measure_count: int):
    """The flattened D.S./da-capo signature: the piece's LAST L measures duplicate an earlier
    contiguous run (the printed page plays through once, then jumps back to the segno and plays
    to Son — SymbTr writes that second pass out). Returns (L, anchor) — tail length + 1-based
    segno measure — or None. Exact carry-label comparison; measured on the matched corpus:
    40/85 pieces carry this structure (2026-07-11)."""
    ms = [measure_labels[i] for i in range(1, measure_count + 1)]
    for L in range(min(measure_count // 2, 80), 1, -1):
        tail = ms[measure_count - L:]
        for s in range(0, measure_count - L):
            if ms[s:s + L] == tail:
                return L, s + 1
    return None


def row_reference(measure_labels: dict[int, str], ms: list[int], spans: list[Span],
                  sig_label: str | None) -> str:
    """A row's expected token stream: carry-mode measure bodies joined with the SAME boundary
    rules as serializeMeasures (repeat barlines replace `|`, voltas before the measure's notes),
    `\\sig` prefix when the row starts with a printed (non-empty) signature."""
    parts: list[str] = []
    if sig_label:
        parts.append(sig_label)
    for k, idx in enumerate(ms):
        rep_start = any(s.start == idx for s in spans)
        prev_end = k > 0 and any(s.end == ms[k - 1] for s in spans)
        if prev_end:
            parts.append("\\repend")
        if rep_start:
            parts.append("\\repstart")
        elif k > 0 and not prev_end:
            parts.append("|")
        if any(s.end == idx and s.volta2 is not None for s in spans):
            parts.append("\\volta1")
        if any(s.volta2 == idx for s in spans):
            parts.append("\\volta2")
        parts.append(measure_labels[idx])
    if ms and any(s.end == ms[-1] for s in spans):
        parts.append("\\repend")
    return " ".join(parts)


# ------------------------------------------------------------------------------ piece loading
@dataclass
class PieceGT:
    """One matched piece: ground truth + page list."""
    dir: Path
    source: str            # match.json's source key ("neyzen", "nota", ...)
    stem: str              # source-side stem (folder name)
    symbtr_stem: str       # SymbTr file stem — the split-by-piece / dedupe key
    makam: str
    pages: list[str]       # page PNG paths, in order
    measure_count: int
    spans: list[Span]
    measure_labels: dict[int, str]   # index -> carry-mode label
    sig_label: str | None            # non-empty signature prefix, else None
    score_json: Path
    dc_tail: tuple[int, int] | None = None   # (tail length L, 1-based segno anchor) — see detect_dc_tail


def load_piece(piece_dir: Path) -> PieceGT | None:
    match_p, labels_p, score_p = (piece_dir / n for n in ("match.json", "labels.json", "score.json"))
    if not (match_p.exists() and labels_p.exists() and score_p.exists()):
        return None
    match = json.loads(match_p.read_text())
    source = next((k for k, v in match.items() if isinstance(v, dict) and "pages" in v), None)
    if source is None:
        return None
    labels = json.loads(labels_p.read_text())
    if "repeats" not in labels or any("measure" not in m for m in labels["measures"]):
        raise SystemExit(f"{labels_p}: missing carry-mode labels/repeats — rerun labels-cli over matched/")
    sig_entries = labels["signature"]["entries"]
    measure_labels = {m["index"]: m["measure"] for m in labels["measures"]}
    return PieceGT(
        dir=piece_dir,
        source=source,
        stem=match[source]["stem"],
        symbtr_stem=Path(match["symbtr"]["file"]).stem,
        makam=match[source].get("makam", labels.get("makam", "")),
        pages=match[source]["pages"],
        measure_count=labels["measureCount"],
        spans=[Span(r["start"], r["end"], r.get("volta2")) for r in labels["repeats"]],
        measure_labels=measure_labels,
        sig_label=labels["signature"]["label"] if sig_entries else None,
        score_json=score_p,
        dc_tail=detect_dc_tail(measure_labels, labels["measureCount"]),
    )


# ------------------------------------------------------------- the label-budget rail (Round 4)
class Rail:
    """Round 4's label-budget rail, as the `oversize(system, m_from, m_to)` the slicer asks for.

    The slicer cannot answer that question itself: a measure range's TRUE id count comes from the
    SymbTr-derived label, and `est_tokens` is a character-count estimate with a residual sd of ~30
    ids. So the emitter prices the ranges in an earlier run (`--rail-plan` writes `emit_rail.json`,
    one id count per candidate range of every over-budget window) and this replays those numbers.

    ⛔ A range this plan never priced answers False — the packer must split ONLY the windows that
    failed, leaving every neighbouring crop byte-identical (owner, 2026-09-06). An unknown range is
    therefore a "leave it alone", never a guess.
    """

    def __init__(self, plan: dict, vocab: str, max_ids: int):
        if plan.get("vocab") != vocab:
            raise SystemExit(
                f"--rail plan was priced under vocabulary {plan.get('vocab')!r} but this run is "
                f"--vocab {vocab!r}: the two disagree about which windows are over budget.")
        if plan.get("max_ids") != max_ids:
            # a plan priced at 59 replayed under a gate of 80 would split windows that now fit —
            # crops moved for nothing, and 3,508 of them are the ones H was supposed to keep
            raise SystemExit(
                f"--rail plan was priced at a budget of {plan.get('max_ids')} ids but this run "
                f"gates at {max_ids}: re-run --rail-plan at the budget you mean to emit.")
        self.max_ids: int = max_ids
        self.pages: dict = plan["pages"]

    def page(self, stem: str):
        """The callback for one page, or None when the plan has nothing to split there."""
        rows = self.pages.get(stem)
        if not rows:
            return None

        def over(system: int, m_from: int, m_to: int) -> bool:
            ids = rows.get(str(system), {}).get(f"{m_from}:{m_to}")
            return ids is not None and ids > self.max_ids

        return over


# ------------------------------------------------------------------------------ page decodes
class FrozenCacheMissing(RuntimeError):
    """`--frozen-crops` met a page with no usable decode cache. It may not cut one, so the piece
    drops — with its own reason, because "missing_pages" would read as a missing IMAGE."""


def get_decodes(piece: PieceGT, rt, strips_root: Path, redecode: bool,
                rail: Rail | None = None, frozen: bool = False) -> list[dict] | None:
    """Per page (in order): the `<page>_decode.json` dict — reused when it already carries the
    slicer geometry and came from the same checkpoint, else re-decoded.

    ⚠ A CACHE IS ONLY VALID FOR THE WINDOWING THAT CUT ITS CROPS, and the rail is part of that
    windowing: a page the plan names is ALWAYS re-decoded (its crops are about to move), and a
    cache carrying `split_from` — i.e. cut by some rail — is refused by a run with no plan for it.

    ⛔ `frozen` (the `--frozen-crops` mode) inverts the fallback: it accepts a cache whose CV
    revision is older than today's — the crops on disk are the ones it describes, and this mode
    slices nothing — but a page WITHOUT a usable cache drops its piece instead of being decoded.
    Slicing one page would re-cut every crop on it under today's CV, which is what the mode exists
    to prevent (the measured cost: 15% of the labelled strips on a page change pixels, and a
    verdict was given against pixels). docs/rung3/round4.md step 5.
    """
    from decode_page import decode_page
    from page_to_strips import window_cache_ok

    out = []
    for page in piece.pages:
        page_path = REPO / page
        if not page_path.exists():
            return None
        stem = page_path.stem
        over = rail.page(stem) if rail is not None else None
        dj = strips_root / stem / f"{stem}_decode.json"
        d = None
        if dj.exists() and not redecode and over is None:
            d = json.loads(dj.read_text())
            strips = d.get("strips", [])
            if (d.get("checkpoint") != rt.checkpoint or d.get("suffix") != rt.suffix
                    or not window_cache_ok(d, frozen_crops=frozen)
                    or not strips or strips[0].get("meas_from") is None
                    or strips[0].get("min_logprob") is None):
                d = None  # old format / other model / other window size — refresh
            elif any(s.get("split_from") is not None for s in strips):
                d = None  # cut by a rail this run knows nothing about — refresh
        if d is None:
            if frozen:
                raise FrozenCacheMissing(stem)  # this mode may not cut a new one
            try:
                d = decode_page(page_path, rt, strips_root, debug=True, verbose=False,
                                oversize=over)
            except RuntimeError:
                return None  # staff detection found nothing — an unusable page (cover/odd scan)
        out.append(d)
    return out


# ------------------------------------------------------------------------------ row assignment
@dataclass
class Row:
    page_stem: str
    system: int
    strips: list[dict]
    row_measures: int


@dataclass
class RowAssign:
    row: Row
    c: int = 0                 # index into `printed` where this row starts
    n: int = 0                 # printed measures assigned to the row
    d: float = 1.0
    status: str = "unaligned"  # ok | recovered_dc | recovered_dn | unaligned
    dc: int = 0
    dn: int = 0


def rows_of(decodes: list[dict]) -> list[Row]:
    rows: list[Row] = []
    for d in decodes:
        page_stem = Path(d["page"]).stem
        by_sys: dict[int, list[dict]] = {}
        for s in d["strips"]:
            by_sys.setdefault(s["system"], []).append(s)
        for sysno in sorted(by_sys):
            strips = sorted(by_sys[sysno], key=lambda s: s["window"])
            rows.append(Row(page_stem, sysno, strips, strips[0]["row_measures"]))
    return rows


class Aligner:
    """Token-id-space comparison against the real training tokenizer.

    Alignment runs on CONTENT ids: the whole `\\sig … \\sigend` block is removed from both
    sides. Two reasons: the current model's real-page signature reading is noisy (it would
    tax every row/strip distance with the same ~4-id penalty regardless of whether the music
    matches), and the signature is checked SEPARATELY anyway (`sig_block`) — a decoded sig
    that disagrees with the label's is a `sig_mismatch` review, the highest-stakes label
    content there is (it resolves every bare note)."""

    def __init__(self, tok):
        self.tok = tok
        self.sig_id = tok.convert_tokens_to_ids("\\sig")
        self.sigend_id = tok.convert_tokens_to_ids("\\sigend")
        from data import strip_special
        self._strip_special = strip_special
        self._cache: dict[str, tuple[list[int], list[int]]] = {}

    def _split(self, text: str) -> tuple[list[int], list[int]]:
        """-> (content ids with sig blocks removed, ids inside the first sig block)."""
        cached = self._cache.get(text)
        if cached is not None:
            return cached
        ids = self._strip_special(self.tok(text).input_ids, self.tok)
        content: list[int] = []
        sig: list[int] = []
        in_sig = False
        first_sig = True
        for i in ids:
            if i == self.sig_id:
                in_sig = True
                continue
            if i == self.sigend_id:
                in_sig = False
                first_sig = False
                continue
            (sig if in_sig and first_sig else content if not in_sig else []).append(i)
        self._cache[text] = (content, sig)
        return content, sig

    def content_ids(self, text: str) -> list[int]:
        return self._split(text)[0]

    def sig_block(self, text: str) -> list[int]:
        return self._split(text)[1]

    def nd(self, ref_text: str, hyp_text: str) -> float:
        ref, hyp = self.content_ids(ref_text), self.content_ids(hyp_text)
        return lev(ref, hyp) / max(len(ref), 1)

    def acc_disagreement(self, ref_text: str, hyp_text: str) -> bool:
        """True when the label/decode disagreement involves any ACCIDENTAL-class token
        (8 AEU signs + \\natural). Rhythm/tuplet/tie noise is provably model-side (SymbTr's
        durations are solid ground truth), but an accidental-level disagreement can mean a
        wrong label (sig-vote error, edition pitch difference, printed courtesy naturals) —
        the one error class the headline metric cannot tolerate. Those strips never
        auto-accept; a human adjudicates them in the review queue."""
        if not hasattr(self, "_acc_ids"):
            from data import ADDED_TOKENS
            self._acc_ids = {self.tok.convert_tokens_to_ids(t) for t in ADDED_TOKENS[:9]}
        from eval_omr import align
        ref, hyp = self.content_ids(ref_text), self.content_ids(hyp_text)
        for op, r, h in align(ref, hyp):
            if op != "match" and (r in self._acc_ids or h in self._acc_ids):
                return True
        return False


def lev_lower_bound(a: list[int], b: list[int]) -> int:
    """Cheap Levenshtein lower bound (length gap / multiset symmetric difference) — prunes
    the row search's hopeless windows before the O(n*m) table."""
    ca, cb = Counter(a), Counter(b)
    diff = sum((ca - cb).values()) + sum((cb - ca).values())
    return max(abs(len(a) - len(b)), (diff + 1) // 2)


def assign_rows(piece: PieceGT, rows: list[Row], printed: list[int], adj: list[Span],
                al: Aligner, row_nd: float, margin: float) -> tuple[list[RowAssign], float]:
    """Content-driven monotonic row matching; returns assignments + printed-measure coverage.

    Each row's decoded id stream is searched against EVERY contiguous printed-measure window
    at or after the previous accepted row's end (pages print top-to-bottom, but editions
    insert/omit sections relative to SymbTr — a fixed cursor cannot recover from that; the
    real corpus proved it). A window is accepted when it clears --row-nd AND either sits at
    the expected continuation or beats every other-START candidate by --margin. Unaligned
    rows leave the search anchor unchanged (the search is global anyway)."""
    assigns: list[RowAssign] = []
    ref_cache: dict[tuple[int, int], list[int]] = {}

    def ref_ids(s: int, n: int) -> list[int]:
        key = (s, n)
        if key not in ref_cache:
            text = row_reference(piece.measure_labels, printed[s:s + n], adj, None)
            ref_cache[key] = al.content_ids(text)
        return ref_cache[key]

    prev_end = 0
    for row in rows:
        hyp = al.content_ids(" ".join(s["tokens"] for s in row.strips))
        ra = RowAssign(row)
        best: tuple[float, int, int] | None = None    # (d, s, n)
        second: tuple[float, int, int] | None = None  # best at a DIFFERENT start
        for dn in (0, -1, 1, -2, 2):
            n = row.row_measures + dn
            if n < 1:
                continue
            for s in range(prev_end, len(printed) - n + 1):
                ref = ref_ids(s, n)
                if lev_lower_bound(ref, hyp) / max(len(ref), 1) > row_nd:
                    continue
                d = lev(ref, hyp) / max(len(ref), 1)
                if best is None or d < best[0]:
                    if best is not None and best[1] != s:
                        second = best
                    best = (d, s, n)
                elif best[1] != s and (second is None or d < second[0]):
                    second = (d, s, n)
        expected = best is not None and best[1] == prev_end
        unique = best is not None and (second is None or second[0] - best[0] >= margin)
        # Ambiguity between windows with IDENTICAL reference content is harmless: either
        # choice yields the same label (repetitive verse structure is normal in şarkı).
        same_content = (best is not None and second is not None
                        and ref_ids(best[1], best[2]) == ref_ids(second[1], second[2]))
        if best is not None and best[0] <= row_nd and (expected or unique or same_content):
            d, s, n = best
            ra.c, ra.n, ra.d = s, n, d
            ra.dn = n - row.row_measures
            ra.dc = s - prev_end
            ra.status = ("ok" if ra.dn == 0 and ra.dc == 0
                         else "recovered_dn" if ra.dn != 0 else "recovered_dc")
            prev_end = s + n
        else:
            ra.d = best[0] if best else 1.0
        assigns.append(ra)
    covered = sum(a.n for a in assigns if a.status != "unaligned")
    return assigns, covered / max(len(printed), 1)


# ------------------------------------------------------------------------------ fold decision
SPAN_SUBSET_CAP = 12  # exhaustive up to 2^12 subsets; beyond, hill-climb (nota corpus has
                      # pieces with 20+ detected spans — 2^28 subsets hung the 2026-07-15 run)


def fold_candidates(spans: list[Span], measure_count: int, p_obs: int, dc_cut: int) -> list[set]:
    """Fold subsets worth scoring. Small span counts: all of them (the original exhaustive
    search). Large: hill-climb on the printed-count gap from BOTH extremes (fold-all is the
    printed-page norm, fold-none the degenerate) — O(n^2) printed_sequence calls, and the
    count evidence only ranks candidates anyway (the row search is the real arbiter)."""
    n = len(spans)
    if n <= SPAN_SUBSET_CAP:
        return [set(s) for r in range(n + 1) for s in combinations(range(n), r)]

    def gap(sub: set) -> int:
        printed, _ = printed_sequence(measure_count, spans, sub, dc_cut)
        return abs(len(printed) - p_obs)

    cands: list[set] = []
    for start in (set(range(n)), set()):
        cur = set(start)
        cands.append(set(cur))
        for _ in range(n):
            g = gap(cur)
            best = None
            for k in range(n):
                t = set(cur)
                t.symmetric_difference_update({k})
                if gap(t) < g:
                    g, best = gap(t), t
            if best is None:
                break
            cur = best
            cands.append(set(cur))
    seen: set[tuple] = set()
    out: list[set] = []
    for s in cands:
        key = tuple(sorted(s))
        if key not in seen:
            seen.add(key)
            out.append(s)
    return out


def choose_fold(piece: PieceGT, rows: list[Row], al: Aligner, row_nd: float, margin: float):
    """Try candidate fold subsets x (D.S. tail folded or not); decide by page measure count,
    tie-break by decoded \\repstart / nav-token evidence, final tie-break by actually aligning
    the rows and keeping the best outcome."""
    p_obs = sum(r.row_measures for r in rows)
    n_repstart = sum(s["tokens"].count("\\repstart") for r in rows for s in r.strips)
    nav_decoded = any(t in s["tokens"] for r in rows for s in r.strips for t in NAV_TOKENS)

    scored = []
    dc_options = [0] + ([piece.dc_tail[0]] if piece.dc_tail else [])
    for dc_cut in dc_options:
        for subset in fold_candidates(piece.spans, piece.measure_count, p_obs, dc_cut):
            printed, adj = printed_sequence(piece.measure_count, piece.spans, subset, dc_cut)
            nav_pen = 0 if (dc_cut > 0) == nav_decoded else 1  # jumps print marks; marks mean jumps
            scored.append(((abs(len(printed) - p_obs), abs(len(subset) - n_repstart), nav_pen),
                           subset, printed, adj, dc_cut))
    scored.sort(key=lambda t: t[0])
    best_score = scored[0][0]

    # The count evidence only RANKS fold candidates — the content-driven row search + the
    # coverage gate are the real arbiters (page-wide barline noise routinely shifts the
    # observed count by a few). Try the top distinct printed sequences, keep the best outcome.
    candidates = []
    seen: set[tuple[int, ...]] = set()
    for t in scored:
        key = tuple(t[2])
        if key in seen:
            continue
        seen.add(key)
        candidates.append(t)
        if len(candidates) >= 4:
            break
    results = []
    for _, subset, printed, adj, dc_cut in candidates:
        assigns, coverage = assign_rows(piece, rows, printed, adj, al, row_nd, margin)
        ok_measures = sum(a.n for a in assigns if a.status != "unaligned")
        mean_d = sum(a.d for a in assigns) / max(len(assigns), 1)
        results.append((-ok_measures, mean_d, subset, printed, adj, assigns, coverage, dc_cut))
    results.sort(key=lambda t: (t[0], t[1]))
    _, _, subset, printed, adj, assigns, coverage, dc_cut = results[0]
    return (subset, printed, adj, assigns, coverage, best_score[0], dc_cut), None


# ------------------------------------------------------------------------------ main pipeline
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--matched", default="data/real/rung3/matched")
    ap.add_argument("--out", default="data/real/rung3/strips_r1")
    ap.add_argument("--strips-root", default="data/real/strips")
    ap.add_argument("--checkpoint", default="data/checkpoints/rung22-stemfix-best")
    ap.add_argument("--onnx-dir", default="data/checkpoints/rung22-stemfix-best-onnx")
    ap.add_argument("--suffix", default="_int8")
    ap.add_argument("--testset", help="testset.json — its pieces are EXCLUDED (training mode)")
    ap.add_argument("--exam", action="store_true",
                    help="emit ONLY --testset pieces; uncertain strips go to review, never dropped")
    ap.add_argument("--report-only", action="store_true",
                    help="calibration pass: report + CSVs only, no training strips written")
    ap.add_argument("--accept-nd", type=float, default=0.10)
    ap.add_argument("--review-nd", type=float, default=0.35)
    # The row gate only PICKS the window; the strip-level --accept-nd is the quality bar (a
    # mispositioned strip can't clear it unless the windows' music is identical — in which
    # case the label is identical too). So it tolerates real-page decode noise: 0.45.
    ap.add_argument("--row-nd", type=float, default=0.45)
    ap.add_argument("--margin", type=float, default=0.10)
    ap.add_argument("--audit-frac", type=float, default=0.05)
    ap.add_argument("--seed", type=int, default=33)
    ap.add_argument("--pieces", help="comma-separated source stems (debug subset)")
    ap.add_argument("--val-side", action="store_true",
                    help="emit ONLY real-val pieces (data.is_real_val_piece) — the real-val "
                         "rebuild's input; combine with --testset to also drop exam pieces")
    ap.add_argument("--split", default="data/split_v4.json",
                    help="synthetic split whose val_pieces are forced to the real-val side")
    ap.add_argument("--redecode", action="store_true", help="ignore existing *_decode.json")
    # Round 4's two label-budget flags. `--vocab h` only changes what a label COSTS in ids (scheme
    # H fuses the 14 common pitches), so 3,508 of the 4,012 over-budget strips fall under the gate
    # with their crops untouched; `--rail-plan` / `--rail` are the second, cutting half for the
    # ~504 that are still over. docs/rung3/round4.md step 5.
    ap.add_argument("--vocab", choices=["old", "h"], default="old",
                    help="tokenizer the 59-id budget gate counts with (h = Round 4's scheme H). "
                         "⚠ ALIGNMENT still uses the decode model's own tokenizer — this is the "
                         "budget gate alone.")
    ap.add_argument("--rail-plan", action="store_true",
                    help="price every candidate sub-range of every over-budget window and write "
                         "emit_rail.json (no re-slice, no re-decode: it is a plan, not a cut)")
    ap.add_argument("--rail", help="emit_rail.json from a --rail-plan run: split the windows it "
                                   "names. ⚠ every page it names is RE-DECODED (its crops move)")
    # ⭐ Round 4 step 5's C+ route (owner, 2026-09-07): the yield this round wants comes from the
    # TOKENIZER, not from a new cut — 3,508 of the 4,012 over-budget strips fall under the gate with
    # their crops untouched. Re-slicing to get them would move pixels under labels a human already
    # read: measured on 30 pages, 20 cut differently and 15% of the labelled strips on them changed
    # bytes. This mode reuses the crops and the decodes exactly as they sit on disk.
    ap.add_argument("--frozen-crops", action="store_true",
                    help="re-use the existing crops and their decode caches even when the CV "
                         "revision has moved on: slice NOTHING, and drop a piece whose page has no "
                         "usable cache rather than cutting a new one. ⛔ refuses --rail/--redecode.")
    ap.add_argument("--max-ids", type=int, default=None,
                    help=f"label budget in ids incl. EOS (default: by --vocab, {MAX_IDS_BY_VOCAB}). "
                         "⛔ NEVER above 100 — data.collate truncates at 99 and the model would be "
                         "taught to stop early, which is the failure this budget exists to prevent.")
    args = ap.parse_args()

    # ⚠ The gate and the vocabulary move together (see MAX_IDS_BY_VOCAB) unless the caller is
    # explicit; a run that mixes an H pool with the old pool's 59 is a silent-wrong-number machine.
    max_ids = args.max_ids if args.max_ids is not None else MAX_IDS_BY_VOCAB[args.vocab]
    if max_ids > 100:
        ap.error(f"--max-ids {max_ids} is above the decoder's real ceiling of 100 "
                 "(apps/web/src/omr/decode.ts MAX_TOKENS, data.collate max_len): a longer label is "
                 "TRUNCATED at 99 in training, which teaches the model to stop early.")

    # ⛔ The whole safety of --frozen-crops is that it never slices. Every flag that would make it
    # slice is refused here rather than trusted to a code path.
    if args.frozen_crops:
        if args.rail:
            ap.error("--frozen-crops slices nothing and --rail re-cuts the windows it names: "
                     "run the rail as its own pass, into its own --strips-root.")
        if args.redecode:
            ap.error("--frozen-crops and --redecode are opposites: --redecode re-slices every page.")

    from decode_page import load_runtime

    rt = load_runtime(args.checkpoint, args.onnx_dir, args.suffix)
    al = Aligner(rt.tok)
    # ⚠ A SECOND TOKENIZER, never rt.tok mutated in place: adding scheme H's ids to the decode
    # model's own tokenizer would re-segment the DECODED text too, and every nd/alignment number
    # in this script is measured in that model's id space.
    budget_tok = rt.tok
    if args.vocab != "old":
        from data import vocabulary
        from transformers import AutoProcessor
        budget_tok = AutoProcessor.from_pretrained(args.checkpoint).tokenizer
        budget_tok.add_tokens(vocabulary(args.vocab))   # idempotent for the ids already there

    def budget_ids(label: str) -> int:
        """Ids a label costs under --vocab, counting the training-time EOS the tokenizer does not
        auto-append (audit_coverage.py's exact rule)."""
        ids = budget_tok(label).input_ids
        return len(ids) + (0 if ids and ids[-1] == budget_tok.eos_token_id else 1)

    print(f"vocabulary: {args.vocab}   label budget: {max_ids} ids (incl. EOS)"
          + ("   crops FROZEN (no slice, no decode)" if args.frozen_crops else ""))
    rail = None
    if args.rail:
        # ⛔ THE EXAM IS FROZEN AND THE RAIL MOVES CROPS. `--exam` slices the graded pages, and its
        # crops are what the exam's gold describes — re-cutting them would silently change the
        # pixels every published exam number was read on. `--rail-plan` stays allowed there: it
        # writes a file and cuts nothing.
        if args.exam:
            ap.error("--rail re-cuts crops and --exam slices the FROZEN exam pages: "
                     "the gold describes those pixels. Use build_exam_v3_queue.py for the exam.")
        rail = Rail(json.loads(Path(args.rail).read_text()), args.vocab, max_ids)
    rng = random.Random(args.seed)
    strips_root = Path(args.strips_root)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    exam_pieces: set[str] | None = None
    exam_symbtr: set[str] = set()
    if args.testset:
        ts = json.loads(Path(args.testset).read_text())
        exam_pieces = {p["stem"] for p in ts["pieces"]}
        # ⛔ THE IMAGE STEM IS NOT THE SCORE. A second printed edition of an exam piece has a
        # different page stem and the SAME SymbTr id, so a stem-only filter lets it into TRAINING
        # — which is the Round-1 contamination, and it happened again: b8's re-emit picked up the
        # `neyzen` engravings of two `nota` exam pieces (7 strips, data/real/rung3/
        # excluded_exam_pieces.txt). train.py's guard catches it, but only after the zip is built
        # and uploaded. Match on the SymbTr id here too, the same key train.py uses.
        exam_symbtr = {
            (e["symbtr_file"][:-4] if e.get("symbtr_file", "").endswith(".txt") else e.get("symbtr_file", ""))
            for e in ts["pieces"]
        } - {""}
    if args.exam and exam_pieces is None:
        ap.error("--exam requires --testset")

    only = set(args.pieces.split(",")) if args.pieces else None

    # --val-side routes through data.is_real_val_piece rather than reimplementing the hash: it is
    # THE train/val assignment train.py and build_realval_v2.py already use, and its whole point
    # is that a piece lands on the same side in every consumer. A second implementation here is
    # how strips leak across the split.
    val_pieces: set[str] | None = None
    if args.val_side:
        from data import is_real_val_piece
        val_pieces = set(json.loads((REPO / args.split).read_text())["val_pieces"])

    piece_dirs = sorted(p.parent for p in Path(args.matched).rglob("match.json"))
    pieces: list[PieceGT] = []
    for d in piece_dirs:
        p = load_piece(d)
        if p is None:
            continue
        if only and p.stem not in only:
            continue
        if exam_pieces is not None:
            # ⚠ ASYMMETRIC ON PURPOSE. --exam emits the frozen exam, which is a fixed set of PAGES,
            # so it selects on the page stem alone; widening it would pull another edition's pages
            # into the graded set. Training mode excludes on EITHER key, because there the question
            # is not "is this the exam's page" but "does this leak the exam's score".
            if args.exam:
                if p.stem not in exam_pieces:
                    continue
            elif p.stem in exam_pieces or p.symbtr_stem in exam_symbtr:
                continue
        if val_pieces is not None and not is_real_val_piece(p.symbtr_stem, val_pieces):
            continue
        pieces.append(p)
    print(f"pieces to process: {len(pieces)}")

    # Strip dirs are keyed by page stem alone (`strips_root/<stem>/`, see get_decodes), while
    # page images are makam-scoped — so two pages sharing a stem silently overwrite each other
    # and one of them is never read. That really happened to two neyzen pieces; the naming fix
    # is neyzen_stems() in collect_tuplets.py, and this refuses to slice past a new one.
    seen: dict[str, str] = {}
    for p in pieces:
        for page in p.pages:
            if seen.setdefault(Path(page).stem, page) != page:
                raise SystemExit(
                    f"page stem collision: {Path(page).stem!r} is produced by both "
                    f"{seen[Path(page).stem]} and {page} — one would overwrite the other "
                    f"under {strips_root}/. Qualify one stem (collect_tuplets.neyzen_stems).")

    # ---- pass 1: decode + fold + row assignment ------------------------------------------
    piece_results: list[dict] = []
    requests: list[dict] = []
    makam_table = load_makam_table()  # rule D's referee — read, never written to a label
    strip_ctx: dict[str, dict] = {}   # strip id -> context for gating
    drops: list[dict] = []
    review: list[dict] = []

    def drop(piece: PieceGT, reason: str, strip: dict | None = None, page: str = "", detail: str = ""):
        drops.append({"piece": piece.stem, "symbtr": piece.symbtr_stem, "page": page,
                      "strip": strip["strip"] if strip else "", "reason": reason, "detail": detail})

    for pi, piece in enumerate(pieces):
        try:
            decodes = get_decodes(piece, rt, strips_root, args.redecode, rail, args.frozen_crops)
        except FrozenCacheMissing as e:
            drop(piece, "no_frozen_cache", page=str(e))
            piece_results.append({"piece": piece.stem, "status": "no_frozen_cache"})
            continue
        if decodes is None:
            drop(piece, "missing_pages")
            piece_results.append({"piece": piece.stem, "status": "missing_pages"})
            continue
        rows = rows_of(decodes)
        if not rows:
            drop(piece, "no_rows")
            piece_results.append({"piece": piece.stem, "status": "no_rows"})
            continue

        folded, miss = choose_fold(piece, rows, al, args.row_nd, args.margin)
        if folded is None:
            drop(piece, "piece_count_mismatch", detail=f"best |printed-p_obs|={miss}")
            piece_results.append({"piece": piece.stem, "status": "count_mismatch",
                                  "count_gap": miss})
            continue
        subset, printed, adj, assigns, coverage, count_gap, dc_cut = folded

        # D.S./da-capo fold: the page prints segno/Son/D.S. marks our labels don't model — every
        # strip touching those measures (or whose decode read a nav token anywhere) goes to
        # review, never straight to training. The REST of a jump piece trains normally.
        nav_measures: set[int] = set()
        if dc_cut and piece.dc_tail:
            length, anchor = piece.dc_tail
            nav_measures = {anchor, anchor + length - 1, printed[-1]}

        # PRINTED signature, by majority vote over the row-start decodes. Real editions print
        # the makam's CONVENTIONAL signature, which routinely differs from SymbTr's
        # content-derived one (verified: hicaz pages print flat+2 sharps where the derivation
        # gives 2 entries) — so the derived sig is systematically labels != pixels. The
        # majority-voted read IS the printed truth (a lone dissenting strip is model noise);
        # when it differs from the derivation, the label request carries it as an override.
        # No clear majority -> the piece is sig-suspect and its row-start strips go to review.
        sig_votes = Counter(
            e for e in (decoded_sig_entries(s["tokens"])
                        for a in assigns for s in a.row.strips if s["is_row_start"])
            if e is not None
        )
        derived_sig = tuple(SIG_ENTRY_RE.findall(piece.sig_label)) if piece.sig_label else ()
        sig_override = None
        sig_majority_ok = True
        sig_table_conflict = False
        if sig_votes:
            (top, cnt), total = sig_votes.most_common(1)[0], sum(sig_votes.values())
            if cnt * 2 > total:
                if top != derived_sig:
                    # RULE D (owner, 2026-09-06): a vote that DELETES or CHANGES an accidental and
                    # cannot be vouched for by the makam table does not overwrite anything — the
                    # label keeps the SymbTr derivation and the piece's row-start strips go to a
                    # human. A model's silence is not evidence. docs/METRICS-SIGVOTE.md.
                    if sig_needs_review(derived_sig, top, piece.makam, makam_table):
                        sig_table_conflict = True
                    else:
                        sig_override = [{"letter": letter.upper(), "alterCommas": ACC_COMMAS[acc]}
                                        for acc, letter in top]
            else:
                sig_majority_ok = False  # split vote — no printed truth to trust

        n_ok = sum(a.status == "ok" for a in assigns)
        n_rec_dc = sum(a.status == "recovered_dc" for a in assigns)
        n_rec_dn = sum(a.status == "recovered_dn" for a in assigns)
        n_un = sum(a.status == "unaligned" for a in assigns)
        piece_results.append({
            "piece": piece.stem, "symbtr": piece.symbtr_stem, "source": piece.source,
            "status": "ok" if coverage >= 0.30 else "low_coverage",
            "coverage": round(coverage, 3),
            "folds": sorted(subset), "spans": len(piece.spans), "count_gap": count_gap,
            "dc_cut": dc_cut,
            "rows": len(assigns), "rows_ok": n_ok, "rows_recovered_dc": n_rec_dc,
            "rows_recovered_dn": n_rec_dn, "rows_unaligned": n_un,
            "sig_majority_ok": sig_majority_ok,
            "sig_override": bool(sig_override),
            "sig_table_conflict": sig_table_conflict,
        })

        # Very low coverage = the match itself is suspect (wrong piece / wrong edition) ->
        # the whole piece demotes to review. Moderate coverage is normal: unaligned rows
        # already dropped their own strips, and each accepted row passed the content check.
        piece_to_review = coverage < 0.30

        piece_req = {"score": str(piece.score_json), "strips": []}
        if sig_override:
            piece_req["signature"] = sig_override
        for a in assigns:
            for s in a.row.strips:
                sid = s["strip"]
                ctx = {"piece": piece, "page": a.row.page_stem, "strip": s,
                       "row_status": a.status, "piece_to_review": piece_to_review}
                if s.get("split_wide"):
                    drop(piece, "split_wide", s, a.row.page_stem)
                    continue
                if a.status == "unaligned":
                    if args.exam:
                        review.append({"piece": piece.stem, "page": a.row.page_stem,
                                       "strip": sid, "reason": "row_unaligned", "nd": "",
                                       "min_logprob": s["min_logprob"], "label": "",
                                       "decoded": s["tokens"], "exam": 1})
                    else:
                        drop(piece, "row_unaligned", s, a.row.page_stem,
                             detail=f"row d={a.d:.3f}")
                    continue
                flat = printed[a.c + s["meas_from"]: a.c + s["meas_to"] + 1]
                if not flat:
                    drop(piece, "empty_range", s, a.row.page_stem)
                    continue
                if any(t in s["tokens"] for t in NAV_TOKENS):
                    ctx["nav"] = "nav_decoded"       # the model read a printed jump mark here
                elif nav_measures & set(flat):
                    ctx["nav"] = "nav_measure"       # covers a segno/Son/jump measure
                ctx["sig_suspect"] = not sig_majority_ok
                ctx["sig_conflict"] = sig_table_conflict
                req_strip = {
                    "id": sid, "measures": flat,
                    "rowStart": bool(s["is_row_start"]),
                    "spans": [{k: v for k, v in vars(sp).items() if v is not None} for sp in adj],
                }
                piece_req["strips"].append(req_strip)
                ctx["flat"] = flat
                # the rail plan re-prices sub-ranges of this window, and a sub-range's label is
                # only the same label when it is asked for with the same score, signature and spans
                ctx["req"] = req_strip
                ctx["score"] = str(piece.score_json)
                ctx["signature"] = sig_override
                strip_ctx[sid] = ctx
        if piece_req["strips"]:
            requests.append(piece_req)
        if (pi + 1) % 10 == 0:
            print(f"  aligned {pi + 1}/{len(pieces)} pieces ...")

    # ---- pass 2: one labels-cli --ranges call for every strip ------------------------------
    manifest_rows: list[dict] = []
    audit: list[dict] = []
    nd_hist = Counter()
    token_counts = Counter()
    over_budget: list[tuple[str, int]] = []   # (strip id, ids under --vocab) — the rail's input

    def serialize(reqs: list[dict], req_p: Path, resp_p: Path) -> dict[str, dict]:
        """One labels-cli --ranges process for a whole batch (tsx startup is slow)."""
        req_p.write_text(json.dumps(reqs, indent=1))
        r = subprocess.run(["npx", "--yes", "tsx", "tools/render/labels-cli.ts",
                            "--ranges", str(req_p), "--out", str(resp_p)],
                           cwd=REPO, capture_output=True, text=True)
        if r.returncode not in (0, 1) or not resp_p.exists():  # 1 = "some strips errored", still usable
            sys.exit(f"labels-cli --ranges failed:\n{r.stdout}\n{r.stderr}")
        return {resp["id"]: resp for resp in json.loads(resp_p.read_text())}

    if requests:
        responses = serialize(requests, out_dir / "emit_requests.json",
                              out_dir / "emit_responses.json")

        for sid, ctx in strip_ctx.items():
            piece, s = ctx["piece"], ctx["strip"]
            resp = responses.get(sid)
            if resp is None or "error" in resp:
                drop(piece, "roundtrip_fail", s, ctx["page"],
                     detail=(resp or {}).get("error", "no response"))
                continue
            label = resp["label"]
            if resp["check"]["errors"]:
                drop(piece, "roundtrip_fail", s, ctx["page"], detail="; ".join(resp["check"]["errors"]))
                continue
            n_ids = budget_ids(label)
            if n_ids > max_ids:
                drop(piece, "over_budget", s, ctx["page"], detail=f"{n_ids} ids")
                over_budget.append((sid, n_ids))
                continue
            nd = al.nd(label, s["tokens"])
            nd_hist[min(int(nd / 0.02), 49)] += 1
            base = {"piece": piece.stem, "page": ctx["page"], "strip": sid,
                    "nd": round(nd, 4), "min_logprob": s["min_logprob"],
                    "label": label, "decoded": s["tokens"], "exam": int(bool(args.exam))}
            # Sig-suspect pieces (majority-vote decoded signature != label signature): every
            # row-start strip goes to review — the printed sig may genuinely differ from
            # SymbTr's, and a wrong-sig label poisons every bare note. Pieces whose majority
            # vote matches keep their row-start strips (a lone dissenting decode is model
            # noise; the label is still right). dn-recovered rows are NOT forced to review:
            # a strip with a wrong measure window can't clear the nd gate unless the windows'
            # content is identical — and then the label is identical too.
            # `sig_table_conflict` (rule D) routes the same way and for the same reason, under
            # its OWN reason string so the two are filterable apart in review_ui: a split vote is
            # the model disagreeing with itself, a table conflict is the model deleting or
            # changing a sign nothing else vouches for.
            sig_mismatch = bool(s["is_row_start"]) and ctx.get("sig_suspect", False)
            sig_conflict = bool(s["is_row_start"]) and ctx.get("sig_conflict", False)
            to_review = ctx["piece_to_review"] or ctx.get("nav") or sig_mismatch or sig_conflict
            if to_review:
                reason = ("low_coverage" if ctx["piece_to_review"]
                          else ctx.get("nav")
                          or ("sig_mismatch" if sig_mismatch else "sig_table_conflict"))
                review.append({**base, "reason": reason})
            elif nd <= args.accept_nd and al.acc_disagreement(label, s["tokens"]):
                review.append({**base, "reason": "acc_disagreement"})
            elif nd <= args.accept_nd:
                for t in label.split():
                    if t.startswith("\\") or t == "|":
                        token_counts[t] += 1
                flat = ctx["flat"]
                row = {
                    "image": sid, "label": label, "mode": "measure",
                    "piece": piece.symbtr_stem, "makam": piece.makam, "source": piece.source,
                    "from": flat[0], "to": flat[-1], "page": ctx["page"],
                    "nd": round(nd, 4), "min_logprob": s["min_logprob"],
                }
                if s.get("split_from") is not None:
                    # ⚠ this strip's row was re-cut by the rail, so its `_wNN` names different
                    # pixels than the same name did before: pools join by measure span, not name
                    row["split_from"] = s["split_from"]
                manifest_rows.append(row)
                if rng.random() < args.audit_frac:
                    audit.append({**base, "verdict": ""})
            elif nd <= args.review_nd or args.exam:
                review.append({**base, "reason": "nd_review" if nd <= args.review_nd else "nd_high"})
            else:
                drop(piece, "nd_high", s, ctx["page"], detail=f"nd={nd:.3f}")

    # ---- pass 3: the label-budget rail's plan (--rail-plan) ---------------------------------
    # Prices EVERY candidate sub-range of every over-budget window, so a later --rail run can
    # answer `oversize(system, m_from, m_to)` from measured id counts instead of an estimate.
    # ⛔ It cuts nothing and re-decodes nothing: the plan is a file the owner can read first.
    rail_plan = {"vocab": args.vocab, "max_ids": max_ids, "checkpoint": args.checkpoint,
                 "pages": {}, "windows": 0, "unsplittable": 0}
    if args.rail_plan and over_budget:
        sub_reqs: dict[str, dict] = {}
        want: list[tuple[str, str, int, int, int]] = []   # rid, page, system, m_from, m_to
        for sid, n_ids in over_budget:
            ctx = strip_ctx[sid]
            st, flat = ctx["strip"], ctx["flat"]
            mf, mt = st["meas_from"], st["meas_to"]
            page_rows = rail_plan["pages"].setdefault(ctx["page"], {})
            page_rows.setdefault(str(st["system"]), {})[f"{mf}:{mt}"] = n_ids
            rail_plan["windows"] += 1
            if mt <= mf:
                # a SINGLE measure over the budget cannot be split at a measure boundary — the
                # slicer returns it as it is and this emitter drops it, exactly as today
                rail_plan["unsplittable"] += 1
                continue
            req = sub_reqs.setdefault(ctx["piece"].stem,
                                      {"score": ctx["score"], "strips": []})
            if ctx["signature"]:
                req["signature"] = ctx["signature"]
            for a in range(mf, mt + 1):
                for b in range(a, mt + 1):
                    if (a, b) == (mf, mt):
                        continue                       # already priced by pass 2
                    rid = f"{sid}#{a}:{b}"
                    req["strips"].append({"id": rid, "measures": flat[a - mf: b - mf + 1],
                                          # a row's FIRST window carries the \sig prefix, and
                                          # after a split that is still the half starting at 0
                                          "rowStart": a == 0,
                                          "spans": ctx["req"]["spans"]})
                    want.append((rid, ctx["page"], st["system"], a, b))
        if want:
            sub_resp = serialize(list(sub_reqs.values()), out_dir / "emit_rail_requests.json",
                                 out_dir / "emit_rail_responses.json")
            for rid, page, system, a, b in want:
                resp = sub_resp.get(rid)
                if resp is None or "error" in resp or resp["check"]["errors"]:
                    continue        # unpriceable range: the plan leaves it alone (answers False)
                rail_plan["pages"][page].setdefault(str(system), {})[f"{a}:{b}"] = \
                    budget_ids(resp["label"])
        (out_dir / "emit_rail.json").write_text(json.dumps(rail_plan, indent=1))
        print(f"rail plan: {rail_plan['windows']} over-budget windows on "
              f"{len(rail_plan['pages'])} pages ({rail_plan['unsplittable']} single measures that "
              f"cannot be split) -> {out_dir / 'emit_rail.json'}")

    # ---- outputs ---------------------------------------------------------------------------
    def write_csv(path: Path, rows: list[dict], fields: list[str]):
        with path.open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)

    write_csv(out_dir / "emit_review.csv", review,
              ["piece", "page", "strip", "reason", "nd", "min_logprob", "exam", "label", "decoded"])
    write_csv(out_dir / "emit_drops.csv", drops,
              ["piece", "symbtr", "page", "strip", "reason", "detail"])
    write_csv(out_dir / "emit_audit.csv", audit,
              ["piece", "page", "strip", "nd", "min_logprob", "verdict", "label", "decoded"])

    if not args.report_only:
        import os
        with (out_dir / "manifest.jsonl").open("w") as f:
            for row in manifest_rows:
                src = strips_root / row["page"] / row["image"]
                dst = out_dir / row["image"]
                if not dst.exists():
                    try:
                        os.link(src, dst)
                    except OSError:
                        import shutil
                        shutil.copy2(src, dst)
                f.write(json.dumps(row) + "\n")

    statuses = Counter(p["status"] for p in piece_results)
    reasons = Counter(d["reason"] for d in drops)
    report = {
        "params": {k: getattr(args, k) for k in
                   ("accept_nd", "review_nd", "row_nd", "margin", "audit_frac", "seed",
                    "checkpoint", "suffix", "exam", "report_only", "vocab", "rail")},
        "max_ids": max_ids,
        "frozen_crops": args.frozen_crops,
        "rail": {"plan_written": bool(args.rail_plan and over_budget),
                 "over_budget_windows": len(over_budget),
                 "split_strips": sum(1 for r in manifest_rows if "split_from" in r)},
        "pieces": piece_results,
        "piece_statuses": dict(statuses),
        "rows": {"ok": sum(p.get("rows_ok", 0) for p in piece_results),
                 "recovered_dc": sum(p.get("rows_recovered_dc", 0) for p in piece_results),
                 "recovered_dn": sum(p.get("rows_recovered_dn", 0) for p in piece_results),
                 "unaligned": sum(p.get("rows_unaligned", 0) for p in piece_results)},
        "strips": {"accepted": len(manifest_rows), "review": len(review), "dropped": len(drops),
                   "audit_sample": len(audit)},
        "drop_reasons": dict(reasons),
        "nd_histogram_bin02": {f"{k * 0.02:.2f}": v for k, v in sorted(nd_hist.items())},
        "accepted_token_counts": {t: c for t, c in sorted(token_counts.items()) if c},
    }
    (out_dir / "emit_report.json").write_text(json.dumps(report, indent=1))

    print(f"\npieces: {dict(statuses)}")
    print(f"rows:   {report['rows']}")
    print(f"strips: accepted={len(manifest_rows)} review={len(review)} dropped={len(drops)}"
          f" (audit sample {len(audit)})")
    print(f"drop reasons: {dict(reasons)}")
    print(f"report: {out_dir / 'emit_report.json'}")
    if args.report_only:
        print("REPORT-ONLY: no manifest.jsonl / PNGs written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
