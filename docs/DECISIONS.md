# Decisions — what was decided, when, and what overturned it

purpose: one line per decision so nobody re-opens a settled question or re-runs a cancelled experiment
audience: agents and the owner, before proposing any change of direction
updated: 2026-07-26

Status values: **LOCKED** (stands), **OVERTURNED** (replaced by evidence), **DROPPED** (abandoned
on purpose), **SUPERSEDED** (a later decision covers it). Reasoning for the abandoned ones is kept
in [log/superseded.md](log/superseded.md) — read it before re-proposing anything here.

## Product and architecture

| Date | Decision | Status |
|---|---|---|
| 2026-07-02 | **Ship web first, then mobile.** React web now, React Native later over the same TS core. | LOCKED (reversed an earlier mobile-only decision) |
| 2026-07-02 | **No production backend.** Inference + audio run in-browser / on-device; Python is training/data only and never ships. Reason: a hosting subscription isn't affordable. | LOCKED |
| 2026-07-02 | **Platform specifics behind adapter interfaces** (`AudioBackend`), so mobile reuses `packages/core` unchanged. | LOCKED |
| 2026-06-20 | **Two-layer pitch model**: exact 53-TET komas for sound, snapped AEU signs for the printed staff (`toAeuAlter`). | LOCKED |

## Model and training

| Date | Decision | Status |
|---|---|---|
| 2026-07-01 | **Fine-tune the pretrained `Flova/omr_transformer`** (Donut-style, image→LilyPond) rather than training a CRNN+CTC. | LOCKED — CRNN fallback formally retired 2026-07-07 on accuracy grounds |
| 2026-07-02 | **Full fine-tune at small LR**; freezing is a memory fallback only. | LOCKED |
| 2026-07-02 | **Split train/val BY PIECE, never by strip** — strips of one piece are near-duplicates. | LOCKED |
| 2026-07-03 | **No Western rehearsal data** in fine-tuning; repeat/nav coverage comes from self-rendered Turkish strips. Any doc still saying "Western rehearsal mix" is stale. | LOCKED (owner decision) |
| 2026-07-02 | **Faithful + signature label scheme**: label only what is *drawn*; `\sig … \sigend` prefix on row-start crops. | LOCKED |
| 2026-07-08 | **New tokens are appended at the END of `ADDED_TOKENS`** so every earlier id stays stable across checkpoints. | LOCKED |
| 2026-07-06 | **Augmentation is screenshot-dominant** (`PHOTO_SHARE = 0.35`) because real uploads are mostly web screenshots. | LOCKED |
| 2026-07-06 | **Augmentation stays on-the-fly in the loader**, never baked into rendered files. | LOCKED |
| 2026-07-21 | **`--every-share` defaults to 0.15**; the 3-arm sweep around it was cancelled before any run (power + premise collapse). | LOCKED at the default; sweep CANCELLED |
| 2026-07-21 | Boost `\komaSharp`/`\kucukSharp` share in the re-render. | **OVERTURNED** — komaSharp was already over-represented and precision-bound |
| 2026-07-21 | `bakiyeSharp→kucukFlat` enharmonic respell to fix the kucukFlat gap. | **HELD** — the gap is a makam-mix artifact |
| 2026-07-26 | **All four AEU sharps get the thinner real-print bars**, not just the broken one — otherwise the model learns a thickness cue that real pages don't have and bar *count* stops being the discriminator. Flats untouched (89–92%, healthy). | LOCKED |
| 2026-07-26 | **`drawThinSharps` ships OFF by default** (`?thinsharps=1` / `--thin-sharps`) so an A/B against `strips_v3` stays possible. | LOCKED |

## Real data, exams and measurement

| Date | Decision | Status |
|---|---|---|
| 2026-07-11 | **Emitter-first, one big Round-1 run**: collect both sources (neyzen + notaarsivleri), then ONE fine-tune on both engraving styles — don't split what can be one run. | LOCKED (owner decision) |
| 2026-07-13 | Insert a **throwaway Round-0.5 labeler fine-tune** before the nota emit; Round 1 itself still trains from base weights. | LOCKED |
| 2026-07-12 | **Never auto-accept an accidental-class disagreement** between label and decode — those always go to a human. | LOCKED — avoided 187 headline-class poisonings |
| 2026-07-20 | **Ship criteria are pre-registered before training**, with every floor stated next to its measured baseline. | LOCKED |
| 2026-07-20 | **Ties carry no floor** (their ground truth is ~38% structurally noisy — gating on it would measure the labels); replaced by the arc-triggered false-`\tup3` rate ≤10%. | LOCKED (owner decision) |
| 2026-07-20 | **The exam is read ONCE per round**, on the final model; all iteration on real-val; a miss is never silently re-rolled, and any second read is labelled as leaked. | LOCKED |
| 2026-07-21 | **Round 1 runs FIRST; the additive-only re-slice moves to Round 2.** The current labeler is neyzen-only while the re-slice target is nota-dominant, so re-slicing first would manufacture false review disputes. | LOCKED (reversed the 2026-07-20 "re-slice starts first" ordering) |
| 2026-07-20 | **The exam is never touched mid-round** — its 27 over-budget recoveries are deferred to exam v3. | LOCKED |
| 2026-07-21 | **Exam-piece phone photos are EXAM-ONLY, never training.** | LOCKED |
| 2026-07-22 | **Standing rule: real-val ORDERS candidates, it does not PREDICT exam performance** (28pp gap measured). | LOCKED |
| 2026-07-22 | Every-share sweep **CANCELLED before any run** — the largest available intervention moved the metric 0.5pp, and the pathology it targeted was already fixed. | **DROPPED**, with a replacement power criterion (>0.5pp) for any future sweep |
| 2026-07-23 | **Ship Round 1 as "an improvement, not a pass"** — it missed 5 floors but strictly dominates the previous live model, and keeping the worse model live would hurt users. | LOCKED |
| 2026-07-23 | **Pivot trigger** (auto-switch to the correction-loop if the Round-2 exam closes < half the gap). | **DROPPED by the owner** — inherited an unproven premise and keyed a six-floor decision on one metric; the pivot stays a situational call |
| 2026-07-23 | Round-2 plan-review addenda items **6 and 8 dropped**; items 5/7/9 kept as commitments. | LOCKED |
| 2026-07-23 | **Train-time exam-disjointness guard**: `train.py` refuses to start if any `--real-dir` piece shares a SymbTr id with `testset.json`. Emit-time guarding was not enough — contamination re-arms whenever a pool grows. | LOCKED, shipped |
| 2026-07-23 | **The real-val rebuild need NOT be edition-disjoint** (clean tiers agree within 2pp); it must instead match exam *composition*, and exclude decode-derived labels from the metric pool. | LOCKED |
| 2026-07-25 | **Stop hand-labelling photos at 284 strips** — enough to measure, and many photos are unreadable even to a human. | LOCKED |
| 2026-07-25 | **Drop the "invented mark" (context-blind hallucination) work** — the flat family now scores 89–92%; the weakness moved entirely to the sharps. | DROPPED, kept as a note |
| 2026-07-25 | **Exam v3 must floor or weight the per-class mean by n** — one 3-gold class swung the headline ~11pp. | LOCKED, owed |

## Working practice

| Date | Decision | Status |
|---|---|---|
| 2026-07-15 | **Heavy compute goes to Colab** (or `nice -19` + `OMR_ORT_THREADS=2` locally) — this Mac is a fanless M4. Runs are page-cached and resumable. | LOCKED |
| 2026-07-04 | One canonical status section; every other doc points at it. | SUPERSEDED 2026-07-26 — the canonical file is now [STATUS.md](STATUS.md), not ROADMAP §7 |
| 2026-07-26 | **Docs restructured for agents**: one auto-loaded `CLAUDE.md`, one status file, one metrics file, history append-only in `log/`, superseded plans quarantined. | LOCKED |
