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

## The second printing program (18 August) — what the null result does and does not mean

Moved out of [OVERVIEW.md](OVERVIEW.md) on 2026-08-19 for space; the result itself stayed there.

**The safety check earned its keep twice.** It compares what was actually printed against what the
answer key says, symbol by symbol. It caught that the second program draws a *smaller version* of the
same symbol on grace notes, which our first reader was blind to, and it caught that we were comparing
against the wrong batch of pictures.

⚠ **Two honest limits sit with the null result.** First, our measuring tool mostly looks at things a
printing program does **not** change — it cannot see the differences in letter shapes and spacing that
you can see with your own eyes when the two are side by side. Second, we deliberately kept the new
pictures the **same size** as the old ones so that only the printer changed, which means the "one
spacing" part of the original complaint was never actually tested. Changing the size is a separate,
one-line change that neither printer makes today.

⚠ **Four things would have to be added before the new pictures could stand beside the old ones**
rather than beside a test batch: the practice arcs, repeat signs, the words under the notes, and the
transposed quarter of the collection.

## The "classical parts are worse" idea — raised and dropped on 17 August, by the owner

Moved out of [OVERVIEW.md](OVERVIEW.md) on 2026-08-19 for space; a short version stayed there.

You first reported that the app makes many mistakes "especially in classical parts", even on clean
pages made by a computer. We measured it and it looked real. Then you **tried it again** and found it
was not: classical pages come out no better and no worse than songs — *"it is not read it well but it
cannot read the songs as well."* So there is no "classical problem", and the plan to go and collect
classical sheet music is cancelled.

⚠ **This is the right outcome, not a wasted day.** Before you retested, we had already found that the
classical pieces in our collection are **not harder music** — they have fewer fast notes and fewer
triplets than the songs do. Nothing was drawn or collected on the idea.

⚠ **One thing we told you on 17 August was wrong, and it is corrected here.** We said those pieces
were simply **worse photocopies**. That came from a number called `nd`, which we had been reading as
"how bad the scan is". It is not — it measures **how much the model's reading differs from the answer
key**. So "the model does badly there because `nd` is high" just says "the model does badly there
because the model does badly there". It explained nothing. Your retest is what settled the question,
and it never needed an explanation to do so.

⚠ **A number we gave you earlier still needs its correction, and it stands on its own.** We said the
model reads clean computer-set pages at 94.8%. That figure is **only about the tiny microtonal
marks** — it never measured the notes or their lengths, which are two-thirds of what you fix. So
"publish for clean pages first" still has to be measured properly rather than assumed.

## The triplet mark — the full account (11–15 August, closed 19 August)

Moved out of [OVERVIEW.md](OVERVIEW.md) on 2026-08-19 when that page passed its size limit. The short
version and the two items that survive stayed there; this is the reasoning behind them.

**What we believed.** The model was no longer *inventing* triplets — it was **missing** about one in
six. A while back it drew a "3" on almost every curved line it saw, so we added plain curved lines
*without* a "3" to the practice pictures to teach it the difference. That worked completely, but it
overshot, and the model became too careful.

**And we thought we knew why: we drew the mark in the wrong shape.** In real Turkish sheet music the
curve is **broken in the middle** and the "3" sits in the gap. Our program drew an unbroken curve with
a small "3" floating above it. So on a real page a triplet is easy to tell from an ordinary curved
line — the curve is cut — while in our pictures the only difference was a tiny floating mark. We had
taught it to look for the wrong thing. It was the same shape of mistake as the sharp signs in July,
where our music font drew the little bars too thick and the model learned our version instead of the
real one. That one cost two rounds.

**What we did, and what came of it (finished 15 August).** We redrew the mark properly — broken curve,
"3" in the gap, measured against real pages — the owner looked at it beside a real edition, and then
we tested whether it actually helps: two identical trainings, one on the new mark and one on the old,
different in nothing else. The new one read **48 of 54** triplets, the old one **46**. Two more
triplets is too small a difference to trust — with only 54 examples to test on, a coin lands there
about seven times in ten — so the honest answer is **we could not tell**.

**We are keeping the new mark anyway**, because it is what real Turkish sheet music looks like, and
that was always the reason for it. What we are *not* doing is claiming it fixed the missed triplets.
To answer that properly we would need more hand-checked triplets to test on, not another pair of
trainings.

⚠ **We nearly had a flattering number.** Looked at through a smaller slice of the same test, the new
mark reads 91% against 80% — but that slice is part of the same 54, chosen after the fact, which is
exactly the trap that cost us a whole round in July.
⚠ **The old-mark training scored identically to the model we have been running since July**, which
tells us the other things that changed in between (a new training wobble, a browser update that moved
every pixel a hair) did nothing to triplets — worth knowing before we blame them for anything later.
⚠ **The triplet labelling was already finished** before any of this. For three weeks one of our notes
said 147 rows were still waiting to be checked by hand, so that job kept being recommended; on disk it
was done and already in use. The note was simply out of date.

## The "can the model even see the page?" idea — tested 15 August, closed 17 August

Moved out of [OVERVIEW.md](OVERVIEW.md) on 2026-08-17 when that page passed its size limit. It is
history now: the idea was tested properly and stopped by a rule written down beforehand. Kept in full
because **how** it closed is the useful part, and because it should not be re-proposed.

## What we found on 15 August 2026 — the model may simply not see the page well enough

Five ideas in a row have now failed their test, and every one of them asked the same question: *are
we drawing something wrong?* So on 15 August we asked a different one — **how much of the picture
does the model actually get to look at?**

The model has a fixed-size window: 409 by 583 dots. A strip of music is turned on its side and
shrunk to fit. A normal strip of ours is about two and a half times too long for that window, so it
gets shrunk to **half size** and **61% of the window is left over as empty black**. After that, the
gap between two staff lines is 14 dots, and the difference between a note *on* a line and one *in*
the space above it is about **7 dots** — very little for the two mistakes we make most: which note it
is, and how long it is.

Then we checked the results we already had. Comparing strips carrying the **same amount of music**,
the most-shrunk third cost **2.4 times as many corrections per note**. Longer strips are not the
problem — *more shrunken* ones are.

✅ **The experiment ran on 15 August and it worked.** We made real test strips artificially wider by
pasting in blank staff from the same strip — identical music, identical answer key, the only change
being *more shrinking*. Mistakes went up at **every** step, 59% worse at the extreme, and it repeated
on a second, separate set of pages. So shrinking genuinely does cost accuracy. That much is solid.

## What happened on 17 August 2026 — we cannot buy the reverse, and we stopped the idea

Showing that shrinking **hurts** is not the same as showing that un-shrinking **helps**. So we tested
whether we could actually cut strips narrower and give the model a better look. **We can't, and there
is no room to.** Two reasons, both measured:

1. **Real pages are already at the good size.** The blank-paper test's own starting point — normal,
   unpadded strips — was *already* at 19.2 dots between staff lines. That is simply what a real test
   page looks like. To do better, a strip would have to be narrower than **one bar of music**, which
   means cutting through the middle of a bar. We tested that in July: **32% worse**.
2. **Cutting to one bar per strip causes a worse problem than it solves.** Very short strips are the
   single worst thing this model handles — it gets almost everything wrong on them, because among
   40,826 practice pictures there is not one that is just a key signature with no notes. It has never
   seen that shape. Cutting real pages to one bar each took those tiny strips from **0.8% to 4.3%** of
   all strips — five times more.

**We wrote down before running the test that "more than double" would kill the idea.** It came out at
five times. So the idea is dead, and it died by a rule set in advance rather than one invented
afterwards to fit the answer. That is the whole point of writing the rule down first.

**What we did get, and it is cheap and real.** Our practice pictures reach the model at **16 dots**
between staff lines; real test pages arrive at **19.2**. So **the model practises on blurrier music
than it is examined on** — a 20% handicap we created ourselves. Cutting only the *practice* pictures to
one bar each fixes exactly that. It costs 13% more practice pictures and changes nothing about how real
pages are sliced, so none of the problems above apply. Worth doing; we cannot know whether it helps
until we retrain.

⚠ **Two numbers in our own notes were wrong, and both had been frightening us off this.** We believed
it would cost **3× more computing per page** (real answer: **1.22×**) and **3× more practice pictures**
(real answer: **1.13×**). Both came from confusing the tool that cuts *real* pages with the one that
prints our *practice* pages — they are separate and only the first has a width limit at all.

⚠ **And the "very short strip" weakness is now the blocker on this whole idea**, not a footnote. We set
it aside in July because our *explanation* for it turned out to be wrong — but its *cost* was never in
doubt, and it is now the thing standing in front of the only version of this change that works.

