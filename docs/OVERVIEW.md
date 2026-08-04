# Where we are and what we do next — in plain words

purpose: plain-English summary of the current state and the plan — no jargon, no music theory needed
audience: the project owner (this page is deliberately written in basic English)
updated: 2026-07-28

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

## What happened on 28 July 2026 — we tested four ideas before spending money. Three were wrong.

Round 3 was going to cost a lot: redraw all **40,826** training pictures and pay for a training run,
all to chase four ideas about what the model gets wrong. Every one of those ideas could be tested
against the model we already have, for the price of running it — no drawing, no training. So we
tested them first.

**That was worth doing. Three of the four ideas turned out to be wrong**, and the change that
actually helps was not on the list at all.

**Something that works, which we still cannot explain.**

If we shrink each real strip by about **2%** before the model reads it, the number of corrections a
user has to make **drops by 12–15%**. Free — no training, no redrawing. We tested four different
shrink amounts and they all help by roughly the same amount, while a much bigger shrink (4%) helps
far less. So the effect is real and there is a sweet spot around 2%.

**But we do not know why, and our best explanation turned out to be wrong.** The obvious answer was
size: our training pictures have the staff lines exactly 30.0 pixels apart, every single time, while
real strips come out of our page-cutter at about 30.4. So we thought the model simply wanted the
familiar size back. We tested that directly — measuring each strip and resizing it to exactly 30.0 —
and it helped only **6%**, less than half as much as the crude 2% shrink. If the model just wanted
the familiar size, that test should have won. It did not.

We also checked one specific suspect inside the page-cutter and it came out clean.

So: **a real, free, sizeable improvement that we are not shipping yet, because we do not understand
it.** Shipping a change we cannot explain is how you get a surprise later. The next job is to find
out what the shrink is actually doing — our current guesses are about ink weight (real print is
darker and thicker than our drawings) rather than size.

**What we found while building the practice test (28 July 2026).**

The practice test is being rebuilt so it contains hard pages (see "what we do next"). Building it
turned up two things worth knowing.

**First: the model is doing well. The old page-cutter was the problem.** Going through the hard
strips by hand, most of what looked like model mistakes are actually bad *crops* — the cutter took a
sliver of a line, or cut in the wrong place, and the model then read that sliver correctly. We
already replaced the cutter, and its new crops look right.

**Second, and awkwardly: everything we test on was cut by the OLD cutter.** The strips were made on
15–17 July; the cutter was replaced on 25 July and nothing was re-cut. We checked 30 of them: **not
one** is the same under the new cutter, two no longer exist at all, and crops that used to be 207
pixels wide are now full 1435-pixel lines. The exam has exactly the same problem.

That does not make our past results wrong — the exam and the practice test were both cut the old
way, so comparing them to each other is still fair. But it does mean both are measuring a version of
the app we no longer ship. **Open decision:** re-cut everything before finishing the practice test
(the recommendation), or finish with the old crops and accept it.

**A small thing, so nobody wastes time on it:** the model writes 32nd notes with a space, like
`f'' 32` instead of `f''32`. That is not a mistake — the two are literally the same to the scoring
code. It happens only for 32nd notes.

**What we found when we re-cut the pages (29 July 2026).**

We re-cut 158 pages with the new cutter. Then we tried to generate answer keys for them, and on the
first page **25 of 30 strips were thrown away** — mostly for being "too long to label".

Here is what is going on, and it is a good problem to have. The old cutter was **chopping the left
edge off** staff lines — up to 490 pixels, enough to lose the clef or a whole bar. The new cutter
fixed that, so each line of music now comes through complete. But the rule for how many bars go into
one strip was chosen back when lines were being chopped short. Now that they are complete, three
bars is often **more music than our answer-key format can hold**, so the strip gets discarded.

Measured: strips that are too long went from **21% to 32%**. If we put fewer bars in each strip we
get more usable ones — 1 bar per strip gives 107 usable where 3 bars gives 79.

That is not a decision yet. Smaller strips mean less context for the model, more pieces to glue back
together, and a mismatch with our training pictures (which use 2–4 bars). So the next job is to pick
that number properly, **before** we generate answer keys — otherwise we would label a batch and then
throw it away.

**The three ideas that turned out to be wrong:**

- **"When a strip has no notes in it, the model panics and invents a whole bar."** It does not. Of
  the 8 such strips that exist in everything we have labelled, only **1** invented anything. The
  truth is duller and harder: the model simply *cannot read* those strips — it gets nearly every
  symbol wrong. And those strips are made that way by our own page-cutter on purpose (it would
  rather keep a thin sliver than lose part of the page), and the newer cutter already makes half as
  many. So teaching our *drawing* program to imitate them would have been backwards.
- **"Our strips are too wide, so cut them narrower."** This looked like the biggest win available —
  wide strips are 14% of the exam but 29% of all the corrections. We tried it: cutting them in half
  made things **worse, by 32%**. And 19 of the 45 wide strips have no bar-line inside them, so there
  is nowhere sensible to cut anyway. Idea closed for good.
- **"Our beams are too heavy."** (Beams are the thick bars joining fast notes.) We once found our
  sharp signs were 22% too thick and fixing it helped, so we assumed beams had the same problem.
  The opposite is true: ours are exactly the textbook thickness, and **real printed music is
  heavier**. Making them thinner would have moved us further from reality — and we would have
  baked that mistake into all 40,826 pictures.

**Three wrong guesses about one file, and what we changed because of them.** Three times we thought
we knew what the page-cutter was doing wrong; all three were measured and all three were wrong. Twice
we had already written the fix — the first fix did literally nothing (we proved it
by re-cutting 67 pages and getting identical results), and the second was based on a guess the
cutter's own records disproved. Both were undone. Separately, two of our measuring tools quietly
gave wrong answers and we only caught them by **looking at the pictures with our own eyes**. The
rule we wrote down: *measure the thing before changing the file that produces it.*

**One more thing we learned.** Our training pictures are **identical in size, every single one**
(30.000 pixels, no variation at all). Real ones vary. We had written that we "shake" the training
pictures about five times less than reality moves; the truth is we do not shake them at all before
the shaking step. That makes the shaking change we had already written more sensible than we
thought — but our tests say it is **not** what is costing us corrections today, so it stays as
cheap insurance, not a fix.

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

**What is already done.** Reading music in the browser works: the app takes the small strips of a
page, reads them, and gives you a real score you can play, edit and save. The only missing piece is
the **page-cutter** — the tool that cuts a whole page into those strips. It existed only in Python,
so it is being rewritten to run in the browser, as a strict copy rather than an improvement, with
each part checked against the Python original over **every page we have** (1,781 pages):

- Finding the staff lines and sizing each row — **done, matches exactly**.
- Finding the bar-lines, the hardest part — **done (4 August), matching on 12,121 of 12,123 rows and
  51,013 of 51,019 bar-lines.** The handful that differ are not mistakes: they come from a 1-shade
  difference in how a browser reads colours, and the Python code makes the *same* change when we
  feed it that difference.
- Cutting the row into strips — **this is what is left.**

⚠ **One thing to know:** cutting a page in the browser currently takes about **36 seconds**, about
35 of them spent checking whether the page is tilted. A known problem to fix before release.

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

1. **Finish the page-cutter** — the last part, cutting each row into strips.
2. **Let you upload a page in the app** (and fix the 36-second delay above).
3. **Decide about "show me where it is unsure".** We measured it, and it does **not** do what we
   promised: we wanted "check 1 line in 10, catch 6 mistakes in 10", and the best at that budget is
   **about 2.6 in 10**. A weaker setting works — check 1 strip in 5, see just over half the
   mistakes. So the choice is: ship that as a *hint*, do the harder work of pointing at individual
   notes, or drop it. A real decision, not a formality.
4. **Serve the model files and release to friends.**

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
