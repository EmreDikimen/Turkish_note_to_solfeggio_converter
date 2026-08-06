# Where we are and what we do next — in plain words

purpose: plain-English summary of the current state and the plan — no jargon, no music theory needed
audience: the project owner (this page is deliberately written in basic English)
updated: 2026-08-06

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

## What we learned before that (27 July 2026) — we were fixing the wrong 13%

We counted every correction a user would have to make on the exam and sorted them by *what* needs
fixing. The answer changed the plan: **the note itself is 40% of the work and its length 28%, while
the microtonal marks — which two whole rounds went into — are only 13%.** The old score could only
see that 13%, which is why it looked like the whole problem. The full count, and what we already
know about note heights and note lengths, moved to **[OVERVIEW-JULY.md](OVERVIEW-JULY.md)**.

## What happened on 28 July 2026 — we tested four ideas and three were wrong

That test day is written up on its own page, in the same plain words:
**[OVERVIEW-JULY.md](OVERVIEW-JULY.md)**. Short version: before spending money on training we
checked four hunches about *why* the model makes mistakes. Three did not survive the check. It is
kept because the reasoning stops us re-proposing them — the short do-not-repeat list is near the
bottom of this page.

## Where we are right now

### The plan as of 5 August 2026: two things at once

Earlier (2 August) the plan was "stop the model work, finish the app, then train again." **On 5
August you changed it: now both happen at the same time.** Here is the whole plan in one table.

| | |
|---|---|
| **Who sees it first** | **Two friends.** Not a public launch |
| **What you ask them** | **"What should I add?"** — you want feedback on the **app**, not on how well it reads music |
| **The model** | **Round 3 starts now**, in parallel. It does not wait for the friends, because what they say about features will not change how we train it |
| **Which model the friends get** | **Whatever is best at the time.** Because the model now runs on a server, swapping it is something you do on your side — the friends download nothing and notice nothing |
| **How you collect feedback** | **You talk to them.** With two people, a conversation tells you more than any button inside the app, and costs nothing to build |
| **Phones** | **Later.** Web first, finish it, then think about phones |
| **Opening it to everyone** | **Only after Round 3's exam result is good.** If it is not good, do Round 4, then look again |

⚠ **One honest cost of swapping the model whenever it improves:** if a friend says "it read this
page badly", we will not know for certain which model did it. That is acceptable *because* you are
asking them about features — but it means those remarks are stories, not measurements. The exam is
still the only thing that tells us whether a model got better.

### Why the app needs a server now (decided 5 August)

Today the reading happens **on the user's own computer**, and it works — but it burns the processor
hard for about 19 seconds per page, which makes a fanless laptop hot. **You decided to move that
work to a server so your friends' computers stay cool.** The app will still cut the page into strips
locally (that part is fast and cheap) and send only the small strips to the server.

**Built AND put online on 6 August.** See "What is done and what is not" below.

Three things worth knowing about this, in plain words:

- ⚠ **It does not feel faster — and that was predicted before it was built.** We wrote down "expect
  no speedup" in advance, and the measurement agreed: the rented processor is about 3.5× slower than
  your Mac's, so a page takes longer on the server than in your own browser, plus about 11 seconds
  to wake up. **The thing you are buying is a cool laptop, not a fast one.** Writing the prediction
  down first is what stops a correct result from reading like a failure.
- ✅ **If the server is asleep or broken, the app quietly reads the page on your own computer
  instead**, and says so. That code already exists and is tested, so it is nearly free — and it
  means a friend never sees a broken app.
- ✅ **Nothing has to be rewritten.** The server runs *the same reading code the browser already
  runs*. That matters because last week proved how expensive a second copy is: rewriting the
  page-cutter in a second language took three whole stages of checking to prove the two copies
  agreed. We are not paying that bill twice.

**And it is still hot at the new speed** — you confirmed that from using it, so there is nothing to
re-measure here. (An earlier draft of this plan asked for a re-test, because the original complaint
was made when a page took ~56 seconds rather than ~25. You have used it since; that answers it.)

### What is done and what is not (6 August 2026)

**The server is live.** It runs at a Google address, it wakes up when someone uploads a page, and it
sleeps when nobody does. The app can use it, and if it is asleep or broken the app quietly reads the
page on your own computer instead and says so. All of that is tested.

**We also checked the thing that matters most: does the server read music as well as the browser?**
Not "do they agree" — they disagree on about 6% of strips — but "is either one *better*". On 267
strips where we know the right answer, the difference is **too small to detect**. Neither is worse.

**The honest headline about speed: the server is SLOWER than your own laptop.** About 250 seconds
where your browser takes 166, for the same work, plus roughly 11 seconds to wake up if it has been
idle. A rented shared processor is about 3.5× slower than the one in your Mac.

That is not bad news, and it is worth understanding why. **You did not buy speed. You bought your
friends' laptops staying cool** — that was the whole reason for the server, written down before any
of it was built. Your friends' computers are probably slower than yours anyway, so for them it may
feel about the same.

**Cost: still effectively free.** A page uses about 40 seconds of rented processor time, and Google
gives away enough for roughly **4,450 pages a month**. Fifty users would not come close.

**Two things are left before your friends can use it:**

1. **Set a $5 spending alert** in the Google billing page. Only you can do this. Remember it only
   emails you — the real protection is the limit of 3 running copies and the upload limit per
   person, and both are already switched on.
2. **Put the app itself online** (the part with the buttons). The code is ready; it needs a free
   account at Cloudflare or Netlify for the app and one at Hugging Face for the model file.

**Three bugs today, and they were all the same mistake in different clothes.** Each time, the thing
that gets shipped was not the thing being tested — we tested the convenient version. Once the app
worked perfectly while running from the development server but froze when built properly. Once the
server ran fine on this Mac but the packed-up version crashed instantly in the cloud. Once an
oversized upload was refused correctly here and looked like a crash through Google's system. All
three are fixed, and there are now checks that run the *real* version. If something surprises us
next time, that is the first thing to suspect.

### Something we decided NOT to build (5 August)

**"Show me where the app is unsure."** We had promised ourselves a specific standard: *look at 1 mark
in 10, and catch 6 mistakes out of 10.* We measured it, and the best it can actually do at that
budget is **about 2.6 out of 10**. A weaker version works (look at 1 strip in 5, catch just over half
the mistakes), but you chose not to ship that.

**Two things worth saying plainly.** First: this means half of the goal we set in July is not built,
and we are writing that down rather than quietly forgetting it. Second: **we did not lower the
standard to make the result look like a pass** — that is the mistake that has caught us twice before
with exam scores. Nothing is deleted; if a friend asks for exactly this feature, it comes back.

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

✅ **And then the slowness was fixed, the same day: a page went from ~56 seconds to ~25.** The tilt
check was doing an expensive image operation 41 times over. It turned out that operation had an
exact shortcut — not an approximation, the *same answer* by a cheaper route — so it now takes 7
milliseconds instead of 856. **We checked it as a shortcut, not as an improvement**: both versions
were run side by side on real pages at every angle, **328 comparisons, zero disagreements**. The
page-cutter in the browser is now faster than the Python original it was copied from.

What is left of the 25 seconds is **the reading itself (~19 seconds)** — which is exactly the part
moving to the server.

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

## What we do next

**Two lists now, and they run at the same time.** Nothing on one waits for the other.

### List A — the app (this is what reaches your friends)

1. ~~Build the server.~~ ✅ **Done 6 August.**
2. ~~Check it gives the same answers as the browser.~~ ✅ **Done** — no detectable difference on 267
   strips where we know the right answer.
3. ~~Switch the app over, keeping the "read it here instead" fallback.~~ ✅ **Done and tested.**
4. ~~Put it online.~~ ✅ **Done 6 August** — the server is live, and the wake-up delay turned out to
   be about 11 seconds.
5. **Set the $5 spending alert** in the Google billing settings — the last safety item, and only you
   can do it. Everything else is built and tested (upload size, uploads per person, refusing
   anything that is not a proper strip picture, at most 3 copies running).
6. **Put the app itself online** — a free Cloudflare or Netlify account for the buttons, and a free
   Hugging Face account for the model file. The code is ready and tested.
7. **Send the link to two friends and ask what to add.**
8. **Open it to everyone — but only if Round 3's exam result is good.**

### List B — the model (Round 3, running in parallel)

1. **Write down what Round 3 has to achieve, before training starts.** On the honest measure — *9
   pages in 10 need 5 fixes or fewer* — with today's 57% as the starting point. This number now does
   double duty: it is also the gate for opening the app to everyone.
2. **Draw more eighth notes and longer bars** (the item explained below). Check on 300 sample
   pictures before redrawing all 40,826.
3. **Decide whether to rebuild the training sets from the newly-cut strips.** Not automatic — it
   would rewrite the lists that our hand-checked answers hang off.

The list below is the older backlog, kept because the reasoning is still good.

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
