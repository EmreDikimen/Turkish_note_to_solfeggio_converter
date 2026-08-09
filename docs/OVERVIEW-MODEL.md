# The model so far, in plain words — Rounds 1 and 2, and the backlog behind Round 3

purpose: the plain-English story of the model track (what Rounds 1–2 found, and the older model backlog), split out of OVERVIEW.md at the 400-line cap
audience: the project owner (basic English, same as OVERVIEW)
updated: 2026-08-09

> Split out of [OVERVIEW.md](OVERVIEW.md) on 2026-08-09. That page kept the **app** story and the
> two "what we do next" lists; this one keeps the **model** story behind them.
>
> Most of this page is **history** — it records what we found, not what to do now. The exception is
> the backlog near the bottom, which is still live work; the three items actually queued for Round 3
> are in **List B** on [OVERVIEW.md](OVERVIEW.md), not here.
>
> This page restates numbers on purpose so it reads on its own. If it ever disagrees with
> [METRICS.md](METRICS.md), METRICS.md is right.

---

## Rounds 1 and 2 — what happened (all still true)

- **Round 2 is finished. It first looked like a step backwards — then we found our score was
  misleading us.** We fixed two real problems in how we make our training pictures (see below),
  trained again, and took the exam once. The old score went **down**, 78% → 74%.
- **The old score was unfair.** It works by measuring 6 kinds of marks separately and averaging the
  6 numbers. But one of those marks, the koma sharp, appears only **14 times** in the whole exam —
  so a handful of mistakes on it drags the whole average down. (Last round the opposite happened:
  a mark with only **3** examples dropped out and the score jumped 11 points for no real reason.)
- **We fixed the scoring, and Round 2 is actually a small improvement.** Counting every mark
  question-by-question instead of averaging subjects: **83.9% → 84.8%**. Ignoring the marks with too
  few examples to judge: **81.4% → 84.8%**. Both up. Add fewer mistakes per page and more strips read
  perfectly, and the new model is better.
- **So we shipped Round 2 — it is the model in the app now** (2026-07-27). Same wording as Round 1:
  *an improvement, not a pass* — it still does not clear our 85% bar, and we say so rather than
  quietly redefining it. Shipping meant converting the model to the small, fast form the browser
  runs (221 MB) and checking each step: **exactly** the same answers in that form (14/14 test
  pictures, twice), and 27 of 28 correct in a real browser. The one miss is not a reading mistake —
  the model was only **69% sure** a triplet bracket was there, and the browser's slightly different
  arithmetic tips that coin. The path the app actually uses reads it correctly, and the old model is
  kept so we can switch back in minutes.
- **Important honesty note:** the fairer score looks higher (≈85% instead of 74%), but that does
  **not** mean we hit our 85% goal. The goal was written against the old, stricter score. We did not
  move the goalposts to a number that flatters us — we use the fair score to tell whether a change
  *helped*, and keep the strict score as the bar to clear. The proper fix is to put more koma-sharp
  examples into the next exam so the strict score becomes trustworthy.
- **The mark we were trying to fix got better:** the küçük sharp went from 50% to **72%** in the place
  that matters most.
- **What we learned.** The old mistake was one-way: when unsure, the model always guessed "koma".
  That guessing habit is now **gone** — which is exactly what our fix was supposed to do. What is left
  underneath is different: the model now mixes koma and küçük up **in both directions, equally**, and
  **only inside the key signature** (the marks printed once at the start of each line). It is no
  longer guessing; it genuinely cannot tell 2 bars from 3 bars there.
- **The next thing to check.** All our measuring of how these marks should look was done on marks
  printed **on a note**. The key-signature marks are squeezed into a fixed space and have **never
  been measured** — even though that is where almost all the hard marks are, and widening them may
  have made things worse. Measure first, change second.
- We finished **Round 1** — the first time the model trained on **real** printed pages (before, it
  only trained on clean computer-made ones). It scored **about 66%** on the exam (real pages it never
  trains on), below our **85%** target, but clearly better than the old model, so we **shipped it**.
  It was the model in the app until Round 2 replaced it on 27 July 2026.
- **We ran the phone-photo test.** At first the model looked terrible on photos — but the real problem
  was the **slicer** (step 1): on a slightly tilted photo it could not even find the staff lines, so
  it produced *nothing* to read on 7 out of 10 photos. We added a small "clean-up" step (straighten
  the photo, crop to the page, flatten the angle). After that the slicer works on **almost every
  photo**. To get an *honest* photo score, we then wrote the correct answer by hand for **284 photo
  strips** (we stopped there — that is enough to measure, and many photos are too blurry to read even
  for a person). The direct result: **about 74%** on the hard marks — only **~3–4 points behind clean
  pages**. **So photos are basically a solved problem now** — the model reads them almost as well as
  clean scans, and the slicer clean-up was the fix.
- **What the honest photo score revealed:** the model's real weakness is **two marks — the koma and
  küçük sharp** (mixed up with each other and with the bakiye sharp), and it is *not* a photo problem
  — it happens on clean pages too. Two things we *thought* were problems, the bar-lines (`|`) and the
  "tie" marks, are read **well** (~90%+). So the one thing worth fixing is telling those sharps apart.
- **We re-checked the exam's answer key and found a few wrong answers.** Fixing 13 took the score
  from 66% to **about 78%** — but **most of that jump is a scoring quirk**, not the model improving.
  The score averages across mark-types, and one tiny type (**3 examples**, all scored 0) was dragging
  it down; fixing those 3 removed it from the average. **Takeaway:** the model was a little better
  than 66% suggested, it still has a **real weakness on koma/küçük sharp**, and our headline number
  is **too easily swung by tiny categories** — we will fix how it is averaged.

---

## The older backlog, kept because the reasoning is still good

The three items actually queued for Round 3 are **List B** on [OVERVIEW.md](OVERVIEW.md). This is
the longer list they were chosen from.

1. **Photo test — DONE** (slicer fixed, honest photo score ~74%, photos basically solved — see above).

2. ✅ **The sharps: SOLVED at the source (2026-07-26).** This was the main model weakness, and the
   cause was **our own drawing**, not the model. The model was right 100% of the time when it said
   "küçük sharp" but only spotted 48% of them — so it could not *see* them. These signs are told
   apart only by **counting bars** (koma has 2, küçük has 3), and our music font drew the bars 22%
   thicker and packed küçük's three 14% closer than real print. The three bars merged into a block,
   and a block *is* a 2-bar koma. We now draw all four sharps ourselves with thinner, better-spaced
   bars. Full story and pictures: [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md).

   **One thing still to do on this:** our training pictures contain koma **1,887** times but küçük
   only **206** times, and **never both in the same picture**. The next render should even that out
   and put koma, küçük and bakiye on neighbouring notes so the model has to compare them.

3. ⛔ **"Invented mark" habit — DROPPED (2026-07-25).** It was next on the list, but the honest scores
   show the flat-family marks are now healthy (küçük flat 92%, bakiye flat 89%, natural 89%). The
   problem moved entirely to the sharps. Kept only as a note, not as work.

4. **Work out why the 2% shrink helps — this is the next job (28 July 2026).** It is worth
   **12–15% of every correction a user makes** and costs nothing, but we will not ship a change we
   cannot explain. The size explanation is already ruled out. The next things to test are about ink
   rather than size: real printed music is darker and heavier than our drawings, and shrinking a
   picture also lightens it. **Do not edit the page-cutter for this** — three guesses about that file
   have now been measured and disproved.

5. **Draw more eighth notes and longer bars.** Real pages are about half eighth notes; ours are less
   than a third, and the model's single most common mistake is reading an eighth note as a quarter —
   exactly the direction our lopsided training would push it. We also put a bar-line roughly three
   times as often as real pages do. Ours are also physically wider than real strips, which means
   everything inside them arrives smaller when the model looks at it. Fix the mix and the width
   together, and check on 300 sample pictures before redrawing all 40,826.

6. ✅ **Rebuild our everyday score — DONE (31 July 2026).** Our day-to-day progress number was too
   optimistic (easy pages only: it said 95% while the real exam said 66%). It now includes hard
   pages, so decisions rest on an honest number.

7. **Fix how the exam is scored.** The headline averages across mark-types, so one with only 3
   examples can swing it a lot (+11 points once, from one tiny category). The next exam will require
   a minimum number of examples per mark-type, or weight by how common each is.

## Ideas we tested and closed on 28 July 2026 — do not re-propose these

| Idea | Why it is closed |
|---|---|
| Draw "no-note" strips into the training set | The model does not invent notes on them (1 of 8); it just cannot read them. The shape comes from our page-cutter, which already makes half as many. |
| Cut wide strips in half | Tried it — **32% worse**. And 19 of 45 have no bar-line to cut at. |
| Draw thinner beams | Ours are already the textbook thickness; **real print is heavier**. Thinning moves us away from reality. |

The four hunches tested that same day, three of which did not survive, are on
[OVERVIEW-JULY.md](OVERVIEW-JULY.md).
