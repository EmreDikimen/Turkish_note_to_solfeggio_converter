# Where we are and what we do next — in plain words

purpose: plain-English summary of the current state and the plan — no jargon, no music theory needed
audience: the project owner (this page is deliberately written in basic English)
updated: 2026-08-05

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

- **A few bad strips do most of the damage.** Strips with three notes or fewer are only about 1 in
  18, but they cause a fifth of all corrections. ⚠ **We first thought the model "invents a whole bar"
  on these — that was checked on 28 July and it is wrong** (only 1 of the 8 such strips in existence
  did anything of the sort). It simply cannot read them. See the 28 July section below.
- **You were right about the octave labels.** Every octave disagreement we found is a case where our
  *answer key* is wrong and the model is right. But there are only a handful, and the training data
  is clean — so it is worth fixing, and it is not what is holding the model back.

**So the next round targets the notes and their lengths, not the microtonal marks.**

### What we already know about those two (the plan: [rung3/round3.md](rung3/round3.md))

- **Note heights are slightly off, not wrong.** When the model misses, it is usually off by only
  one or two positions up or down — 74% of the time. It is not confused about which note it sees; it
  is misjudging the height, like reading a thermometer one mark off.
  We suspected this came from our training pictures being too uniform — and they are: the staff lines
  sit at **exactly** the same size in every single one, while real strips vary. ⚠ **But testing on
  28 July says that is not what is costing us corrections today**, so the "shake the pictures more"
  setting is kept as cheap insurance rather than a fix. See the 28 July section below.
- **Note lengths are nearly always "twice too long".** A short note carries a little flag or beam on
  its stem, and the model is missing it. It also adds or drops the small dot that lengthens a note,
  about equally often. We assumed the **same story as the sharp marks**: our music font draws thicker
  strokes than real printing. ⚠ **Checked on 28 July — it is the opposite.** Our beams are exactly the
  textbook thickness and real printed music is *heavier*, so this idea is closed.

Both were checks to run *before* making new pictures. Both were run — see the 28 July section.

## What happened on 28 July 2026 — we tested four ideas and three were wrong

That test day is written up on its own page, in the same plain words:
**[OVERVIEW-JULY.md](OVERVIEW-JULY.md)**. Short version: before spending money on training we
checked four hunches about *why* the model makes mistakes. Three did not survive the check. It is
kept because the reasoning stops us re-proposing them — the short do-not-repeat list is near the
bottom of this page.

## Where we are right now

### The plan changed on 2 August 2026: finish the app first, train later

**We stopped improving the model and started finishing the product.** The model is frozen — the one
in the app stays exactly as it is — and the work is now to turn it into a link a friend can open.
The next training round (Round 3) is **paused, not cancelled**; it starts again after friends have
tried it and told us what is wrong.

Three reasons, in plain terms: Round 3 is a bet we cannot price (it changes what we *draw* for
practice, and we do not know how much that helps); **a friend would not notice it either way**; and
half of the goal we set in July — *the app shows you where it is unsure* — had never been built at
all, which we cannot fix or test without a working pipeline.

**The page-cutter was finished on 4 August.** It existed only in Python; it has now been rewritten
to run in the browser as a strict copy, not an improvement, and checked against the Python original
over **every page we have** (1,781 pages) — staff lines, bar-lines and strips all match, except for
a handful caused by a 1-shade difference in how a browser reads colours, where Python makes the
*same* change if we feed it that difference. We also cut 20 pages both ways and read both sets of
strips: same reading, and every strip the two disagreed on was **exactly the same width** in both,
which is how we know the cutter is not the cause.
### The app now reads a whole page (5 August)

**You can hand it a picture of a page and get music back.** Before today the app could only read the
small strips *after* someone else had cut them up. Now you pick one image — a screenshot or a clean
scan of a page — and the app cuts it, reads it, puts it back together, and shows you a score you can
play, edit and save. That is the whole thing working end to end for the first time.

On the test page: **7 lines of music → 16 strips → 344 notes**. Both the browser and Python cut it
into 16 strips, and the same page read the *old* way gives the same 344 notes — so the new cutter
and the old one agree all the way through.

**The hard part was not the wiring, it was the waiting.** Checking the page for tilt takes ~35
seconds, and during that time the browser tab was completely frozen: no progress shown, and the
browser would offer to kill the page. We fixed that by letting the tilt check pause between each of
its 41 attempts, so the tab keeps breathing and you see a counter move. **Nothing about the result
changed** — we re-ran the comparison against Python on 20 pages and the tilt answer was identical on
all 20.

⚠ **Still slow: about 56 seconds for a page** (35 of them the tilt check, ~19 the reading). A page
that is already straight still pays the full 41 attempts to find that out. Making it faster means
changing *how* we look for tilt, which could change results, so it needs its own careful check
rather than being slipped in. That is written down as the next piece of work.

⚠ **One trap worth remembering:** for a while the first upload just hung, with the computer doing
nothing at all. It was not our code — the development tools were quietly reloading the page in the
middle of the job and throwing the upload away. One line of configuration fixed it.

### Before that — the model work (all still true)

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
  quietly redefining the bar. Shipping means the model was converted to the small, fast form the
  browser runs (221 MB) and checked at every step: it gives **exactly** the same answers in that
  form (14 out of 14 test pictures, twice over), and in a real browser it read 27 of 28 correctly.
  The one miss is not a reading mistake: on that picture the model itself was only **69% sure** a
  triplet bracket was there (its next guess, 31%, was "no bracket"), and the browser's slightly
  different arithmetic tips that coin the other way. Every other symbol in the strip is 94–100%
  certain, and the path the actual app uses reads it correctly. The old model is kept, so we can
  switch back in minutes.
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

**Everything in the numbered list below is PAUSED until the app is released.** It is kept because
the reasoning is still good, not because it is the next thing to do. The live list is short:

1. **Upload a page in the app — DONE 5 August** (see above). The 56-second wait is now item 4.
2. **Decide about "show me where it is unsure".** We measured it, and it does **not** do what we
   promised: we wanted "check 1 line in 10, catch 6 mistakes in 10", and the best at that budget is
   **about 2.6 in 10**. A weaker setting works — check 1 strip in 5, see just over half the
   mistakes. So the choice is: ship that as a *hint*, do the harder work of pointing at individual
   notes, or drop it. A real decision, not a formality.
3. **Serve the model files and release to friends.**
4. **Make the page faster.** Mostly the tilt check. Needs its own measurement, because a
   cheaper check could give different answers on the ~15 pages in 100 that really are tilted.

Then the list below restarts, with real feedback to aim it.

1. **Photo test — DONE** (slicer fixed, honest photo score ~74%, photos basically solved — see above).

2. ✅ **The sharps: SOLVED at the source (2026-07-26).** This was the main model weakness, and the
   cause was **our own drawing**, not the model. The model was right 100% of the time when it said
   "küçük sharp" but only spotted 48% of them — so it could not *see* them. These signs are told
   apart only by **counting bars** (koma has 2, küçük has 3), and our music font drew the bars 22%
   thicker and packed küçük's three 14% closer than real print, leaving less than half the white
   gap. The three bars merged into a block, and a block *is* a 2-bar koma. We now draw all four
   sharps ourselves with thinner, better-spaced bars. Full story and pictures:
   [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md).

   **One thing still to do on this:** our training pictures contain koma **1,887** times but küçük
   only **206** times, and **never both in the same picture**. The next render should even that out
   and put koma, küçük and bakiye on neighbouring notes so the model has to compare them.

3. ⛔ **"Invented mark" habit — DROPPED (2026-07-25).** It was next on the list, but the honest scores
   show the flat-family marks are now healthy (küçük flat 92%, bakiye flat 89%, natural 89%). The
   problem moved entirely to the sharps. Kept only as a note, not as work.

4. **Work out why the 2% shrink helps — this is the next job (28 July 2026).** It is worth
   **12–15% of every correction a user makes** and costs nothing, but we will not ship a change we
   cannot explain. The size explanation is already ruled out (see above). The next things to test are
   about ink rather than size: real printed music is darker and heavier than our drawings, and
   shrinking a picture also lightens it. **Do not edit the page-cutter for this** — three guesses
   about that file have now been measured and disproved.

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

### Ideas we tested and closed on 28 July 2026 — do not re-propose these

| Idea | Why it is closed |
|---|---|
| Draw "no-note" strips into the training set | The model does not invent notes on them (1 of 8); it just cannot read them. The shape comes from our page-cutter, which already makes half as many. |
| Cut wide strips in half | Tried it — **32% worse**. And 19 of 45 have no bar-line to cut at. |
| Draw thinner beams | Ours are already the textbook thickness; **real print is heavier**. Thinning moves us away from reality. |

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
| **Round 1** | The first cycle of training the model on real pages. Shipped 2026-07-23; replaced by Round 2. |
| **Round 2** | The second cycle. Fixed two problems in how we make training pictures. The old score read 78% → 74%, but that turned out to be a scoring quirk; on the fair scores it is better, so it **shipped** on 2026-07-27 and is the model in the app. |
| **key signature** | The group of marks printed once at the start of a line, which apply to every matching note on it. This is where almost all the hard marks are — and where the model still gets confused. |
