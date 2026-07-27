# Where we are and what we do next — in plain words

purpose: plain-English summary of the current state and the plan — no jargon, no music theory needed
audience: the project owner (this page is deliberately written in basic English)
updated: 2026-07-27

> A short, plain-language page about the **current state and the plan going forward**. No music
> knowledge needed. It does not cover the full history — for that see [rung3/](rung3/README.md)
> and [log/status-log.md](log/status-log.md). Update this page when the plan changes.
>
> This page **restates numbers on purpose**, so it can be read on its own; if it ever disagrees
> with [METRICS.md](METRICS.md), METRICS.md is right.

---

## What we are building (one paragraph)

An app that **takes a picture of Turkish sheet music and turns it into a digital score you can
edit** — like OCR (photo of text → editable text), but for music notes. The hard part: Turkish
music uses about **eight tiny note-marks** (that raise or lower a note by small amounts) which look
very similar, and the sheet music writes them in a **shorthand** that hides information (see "the
problem" below).

How it works, in three steps: **(1) Slice** the page into small pieces called **strips** (2–3
measures each); **(2) Read** — an AI model writes down the notes it sees in each strip; **(3)
Reassemble** the strips back into a full score.

---

## What we are aiming for (changed 27 July 2026)

**Goal: 9 out of 10 pages should need 5 corrections or fewer — and the app should show you where
they are.**

We used to aim at a model-accuracy number (85%). We changed it because that number does not tell
you whether the app is worth using. What you actually care about is: *how much work is left after
the app has done its part?*

Right now a typical page needs about **5 fixes**, and **57%** of pages are already at 5 or fewer.
So the work is the harder pages, not the typical one.

The second half matters more than it sounds. Today the app gives you a page that is ~95% correct —
but it does not tell you *which* 5 marks are wrong, so you have to check all of them yourself. That
wipes out most of the time you saved. If the app highlighted the few places it was unsure, you would
check five spots instead of two hundred and fifty notes. We already compute that "unsure" signal
internally; we have simply never shown it to you.

## What we learned last (27 July 2026) — we were fixing the wrong 13%

We counted every correction a user would have to make on the exam, and sorted them by *what* needs
fixing:

| what you would have to fix | share |
|---|---|
| **the note itself (which line/space it sits on)** | **40%** |
| **how long the note is** | **28%** |
| tie / triplet / grace marks | 13% |
| **the microtonal marks (koma, küçük, bakiye…)** | **13%** |
| bar-lines, repeats | 5% |

Two whole rounds of work went into that 13%. Not because it was the biggest problem — but because
our old score *only measured that*. It could not see the other 87%.

Two more things came out of the same count:

- **A few bad strips do most of the damage.** 12 strips out of 326 cause a fifth of all corrections.
  The worst one is a narrow crop showing only the clef and the key signature, with no notes at all —
  and the model invented a whole bar of notes. It turns out our training pictures **never** contain
  that shape (0 out of 40,826), while the real page-cutter produces them. That is the third time a
  "model problem" has turned out to be something we never showed it.
- **You were right about the octave labels.** Every octave disagreement we found is a case where our
  *answer key* is wrong and the model is right. But there are only a handful, and the training data
  is clean — so it is worth fixing, and it is not what is holding the model back.

**So the next round targets the notes and their lengths, not the microtonal marks.**

## Where we are right now

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
  perfectly, and the new model is better — so **whether to ship it is now an open question**, not a
  no.
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
- **The next thing to check.** All our careful measuring of how these marks should look was done on
  marks printed **on a note**. The marks in the key signature are squeezed together in a fixed space,
  and we have **never measured those** — even though that is where almost all the hard marks are.
  We may even have made them worse by widening them. So: measure first, and only then change anything.
- We finished **Round 1** — the first time the model trained on **real** printed pages (before, it
  only trained on clean computer-made ones). It scored **about 66%** on the exam (real pages it never
  trains on), below our **85%** target, but clearly better than the old model, so we **shipped it**.
  It is still the model in the app today.
- **We ran the phone-photo test.** At first the model looked terrible on photos — but the real problem
  was the **slicer** (step 1): on a slightly tilted photo it could not even find the staff lines, so
  it produced *nothing* to read on 7 out of 10 photos. We added a small "clean-up" step (straighten
  the photo, crop to the page, flatten the angle). After that the slicer works on **almost every
  photo**. To get an *honest* photo score, we then wrote the correct answer by hand for **284 photo
  strips** (we stopped there — that is enough to measure, and many photos are too blurry to read even
  for a person). The direct result: **about 74%** on the hard marks — only **~3–4 points behind clean
  pages**. **So photos are basically a solved problem now** — the model reads them almost as well as
  clean scans, and the slicer clean-up was the fix.
- **What the honest photo score revealed:** the model's real weakness is **two specific marks — the
  koma and küçük sharp** (it mixes them up with each other and with the bakiye sharp). This is *not* a
  photo problem — it happens on clean pages too. And two things we *thought* were problems — the
  bar-lines (`|`) and the "tie" marks — are actually read **well** (about 90%+). So the one thing worth
  fixing in the model is telling those three sharps apart.
- **We re-checked the exam's answer key and found it had a few wrong answers.** After fixing 13 of
  them, the exam score went from 66% to **about 78%**. But be careful: **most of that jump is a
  scoring quirk**, not the model getting better. The score is an *average across mark-types*, and one
  tiny mark-type (only **3 examples**, all scored 0) was dragging the average down; fixing those 3
  removed it from the average. The model's actual reading barely changed. **Takeaway:** the model was
  a little better than 66% suggested, but it still has a **real weakness on two of the hardest marks**
  (koma/küçük sharp), and our exam's headline number is **too easily swung by tiny categories** — we
  will fix how it is averaged.

---

## An old problem we decided NOT to fix (kept for the record)

When the model reads a strip from the **middle** of a line, that strip does not show the
**signature** — the note at the *start* of the line that says which notes are quietly lowered. (It
got cut off when we sliced the page.)

So the model sees a plain note with no mark. The right thing to do is simple: **write it down plain**
(the signature gets applied later, at reassembly). But the model sometimes **adds a mark that is not
actually printed**, out of habit — *"this note is usually lowered, so I'll add the mark."* That
invents a mistake. It happens most on the note **'si'**.

**This is a fixable habit, not an impossible task** — the right answer is always "copy what you see."
But we **dropped it on 2026-07-25**: the marks it affects (the flat family) now score 89–92%, so this
is no longer where the model loses points. The sharps are.

**Your 284 photo labels: they stay as a test only.** They are photos of the *exam* pieces, so training
on them would let the model see the exam in advance — the same mistake that spoiled Round 1. They are
now frozen as the photo part of the next exam. If we want camera photos to *train* on, we print and
shoot **different** pieces (there are thousands available).

---

## What we do next (in order)

1. **Photo test — DONE** (slicer fixed, honest photo score ~74%, photos basically solved — see above).

2. ✅ **The sharps: SOLVED at the source (2026-07-26).** This was the main model weakness. The answer
   turned out to be **our own drawing**, not the model.

   **How we found it.** The clue was strange: when the model says "küçük sharp" it is right 100% of
   the time, but it only spots 48% of them. So it was not careless — it could not *see* them. We
   tested three things in order:
   - **Was the picture too small?** No. We checked whether sharps read worse on wide strips (which
     get shrunk more before the model sees them). They do not — on either the clean exam or the
     photos. Meanwhile bakiye sharp reads at 84–94% at *every* size. So the problem followed the
     **symbol**, not the size. (Good news: this saved us from an expensive rebuild.)
   - **What does the model write instead?** Almost always one thing: it reads a **küçük as a koma** —
     11 times on the clean exam, 10 times on the photos, and never the other way round.
   - **Why?** These signs are only told apart by **counting bars**: koma has 2, küçük has 3. We
     measured our drawing against two real printed pages. Our music font draws the bars **22%
     thicker** and packs küçük's three bars **14% closer** than real print does. Together that leaves
     **less than half** the white gap — about 1 pixel by the time the model sees it. The three bars
     merge into a block, and a block with no visible gap *is* a 2-bar koma.

   **The fix.** We now draw all four sharps ourselves, with the thinner bars measured off real pages,
   and küçük's bars slightly further apart so the gaps survive shrinking. All four got the same
   thinner bars on purpose — if only küçük were thinned, the model could cheat by looking at
   thickness instead of counting, and real pages would then confuse it. Flats were left alone (they
   score 89–92%). It is **off by default** so the old and new drawings can be compared fairly; turn
   it on with `?thinsharps=1` in the browser or `--thin-sharps` when rendering.

   Pictures: `data/real/rung3/sharp_probe/all4_final.png` (before / after / after shrinking).

   **One thing still to do on this:** our training pictures contain koma **1,887** times but küçük
   only **206** times, and **never both in the same picture**. The next render should even that out
   and put koma, küçük and bakiye on neighbouring notes so the model has to compare them.

3. ⛔ **"Invented mark" habit — DROPPED (2026-07-25).** It was next on the list, but the honest scores
   show the flat-family marks are now healthy (küçük flat 92%, bakiye flat 89%, natural 89%). The
   problem moved entirely to the sharps. Kept only as a note, not as work.

4. **Rebuild our everyday score.** Our day-to-day progress number was too optimistic (it used easy
   pages only — it said 95% while the real exam said 66%). We are rebuilding it to include hard pages,
   so future decisions rest on an honest number.

5. **Fix how the exam is scored.** The headline is an average across mark-types, so a mark-type with
   only 3 examples can swing it a lot (that just happened: +11 points from one tiny category). The new
   exam will require a minimum number of examples per mark-type, or weight by how common each is.

---

## Small glossary (only the words used above)

| Word | Plain meaning |
|---|---|
| **strip** | One small horizontal slice of a page (2–3 measures) that the model reads. |
| **signature** | The note at the **start of a line** saying which notes are lowered for that whole line. |
| **mark (accidental)** | A small symbol on one note that raises or lowers it. ~8 kinds; telling them apart is the hard part. |
| **bare note** | A note with no mark drawn. It may still be "lowered" by the line's signature — but the model should still write it bare and let reassembly apply the signature. |
| **slicer** | Step 1: the tool that cuts a page into strips. It first finds the staff lines; on tilted photos it failed, which we fixed with a "clean-up" step. |
| **exam** | Real pages the model never trains on — our honest score. It read 66% first; after we fixed 13 wrong answers in the answer key it reads ~78%, but most of that jump is the scoring quirk explained above, not the model improving. |
| **Round 1** | The first cycle of training the model on real pages. Shipped, and still the model in the app. |
| **Round 2** | The second cycle. Fixed two problems in how we make training pictures, but the exam score went 78% → 74%, so it was **not** shipped. |
| **key signature** | The group of marks printed once at the start of a line, which apply to every matching note on it. This is where almost all the hard marks are — and where the model still gets confused. |
