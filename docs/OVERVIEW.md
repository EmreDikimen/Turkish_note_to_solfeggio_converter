# Where we are and what we do next — in plain words

purpose: plain-English summary of the current state and the plan — no jargon, no music theory needed
audience: the project owner (this page is deliberately written in basic English)
updated: 2026-08-07

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

- ⚠ **It does not feel faster — and that was predicted before it was built.** We wrote "expect no
  speedup" down in advance and the measurement agreed. **You are buying a cool laptop, not a fast
  one.** Writing the prediction down first is what stops a correct result reading like a failure.
- ✅ **If the server is asleep or broken, the app quietly reads the page on your own computer
  instead**, and says so. That code already exists and is tested, so a friend never sees a broken app.
- ✅ **Nothing has to be rewritten.** The server runs *the same reading code the browser already
  runs*. Last week proved how expensive a second copy is: rewriting the page-cutter in a second
  language took three whole stages of checking to prove the two copies agreed. Not paying that twice.

**And it is still hot at the new speed** — you confirmed that from using it, so there is nothing to
re-measure. (An earlier draft asked for a re-test, from when a page took ~56 seconds, not ~25.)

### What is done and what is not (6 August 2026)

**The server is live.** It wakes when someone uploads a page and sleeps when nobody does; if it is
asleep or broken the app reads the page on your own computer instead and says so. All tested.

**The thing that matters most: does the server read music as well as the browser?** Not "do they
agree" — they disagree on about 6% of strips — but "is either *better*". On 267 strips where we know
the right answer, the difference is **too small to detect**. Neither is worse.

**The honest headline about speed: the server is SLOWER than your own laptop.** About 250 seconds
where your browser takes 166, plus ~11 seconds to wake up — a rented shared processor is about 3.5×
slower than the one in your Mac. Not bad news: **you did not buy speed, you bought your friends'
laptops staying cool**, the whole reason for the server and written down before it was built. Their
computers are probably slower than yours anyway, so for them it may feel the same.

**Cost: still effectively free.** A page uses about 40 seconds of rented processor time, and Google
gives away enough for roughly **4,450 pages a month**. Fifty users would not come close.

**✅ It is online: <https://komavision.netlify.app>.** Done on 6 August, safety list complete.

### The three places it lives, and why it is not just one

This confused things when it was being set up, so it is written down plainly. Your app is in three
different places because they are three different *kinds* of job, and no single free service does
all three well.

| | What it is | What it does for you | Why not somewhere else |
|---|---|---|---|
| **Netlify** | A **filing cabinet for a website**. It stores files and hands them to whoever asks. | Holds the page itself: the buttons, the sheet-music drawing, the sound. 43 MB. | It only ever hands out files. It cannot *run* anything, so it cannot read music. |
| **Hugging Face** | A **filing cabinet for big AI files**, free for public ones. | Holds the model — the 211 MB the app learned to read music with. | Netlify refuses files this big, and your friends should never download them anyway (see below). |
| **Google Cloud Run** | A **computer you rent by the second**. It wakes when asked, works, and sleeps. | Actually reads the music. Your friend's page is sent here, and notes come back. | This is the only one of the three that runs a program. It is also the only one that could cost money — hence the $5 alert. |

The everyday path is: **Netlify gives your friend the page → the page cuts the photo into strips →
the strips go to Cloud Run → the notes come back.** Hugging Face is not involved at all.

Hugging Face only wakes up in an emergency. If Cloud Run is asleep or broken, the page downloads the
model from Hugging Face and reads the music **on your friend's own computer** instead — slower, and
their laptop gets warm, but it works rather than showing an error. That is why the model has to live
somewhere a browser can reach, even though almost nobody will ever fetch it.

**One good way to picture it:** Netlify is the *menu*, Hugging Face is the *emergency recipe book*,
and Cloud Run is the *kitchen*. Normally you order from the menu and the kitchen cooks. If the
kitchen is closed, you get handed the recipe book and cook at home.

The step-by-step of how it was set up: **[mvp/hosting-setup.md](mvp/hosting-setup.md)**.

**Netlify, not Cloudflare — for an oddly specific reason.** Cloudflare refuses any single file over
25 MiB and one of ours is 25.58 — over by half a megabyte. Netlify does not mind and reads the same
settings file, so nothing had to be rewritten. That file can be halved later; it changes how the app
reads music on its own, so it is not something to rush the day before a release.

**Three bugs today, all the same mistake in different clothes: what gets shipped was not what we
tested.** The app worked from the development server but froze when built properly; the server ran
here but crashed packed up in the cloud; an oversized upload was refused correctly here and looked
like a crash through Google's system. All fixed, and there are now checks that run the *real*
version. If something surprises us next time, suspect this first.

### Something we decided NOT to build (5 August)

**"Show me where the app is unsure."** We had promised ourselves a specific standard: *look at 1 mark
in 10, and catch 6 mistakes out of 10.* We measured it, and the best it can actually do at that
budget is **about 2.6 out of 10**. A weaker version works (look at 1 strip in 5, catch just over half
the mistakes), but you chose not to ship that.

**Two things worth saying plainly.** Half of the goal we set in July is therefore not built, and we
are writing that down rather than quietly forgetting it. And **we did not lower the standard to make
the result look like a pass** — the mistake that has caught us twice before with exam scores.
Nothing is deleted; if a friend asks for this feature, it comes back.

**The page-cutter was finished on 4 August.** It existed only in Python and has been rewritten to run
in the browser as a strict copy, not an improvement, then checked against the original over **every
page we have** (1,781) — staff lines, bar-lines and strips all match, bar a handful caused by a
1-shade difference in how a browser reads colours, where Python makes the *same* change if fed that
difference. We also cut 20 pages both ways and read both sets: same reading, and every strip they
disagreed on was **exactly the same width** in both, which is how we know the cutter is not the cause.
### The app now reads a whole page (5 August)

**You can hand it a picture of a page and get music back.** Before that day the app could only read
small strips *after* someone else cut them up. Now you pick one image — a screenshot or a clean scan
— and the app cuts it, reads it, puts it back together, and shows a score you can play, edit and
save. On the test page: **7 lines of music → 16 strips → 344 notes**, and the browser and Python cut
it the same way, so the new cutter and the old one agree all the way through.

**The hard part was not the wiring, it was the waiting.** Checking a page for tilt froze the tab for
~35 seconds — no progress shown, and the browser offering to kill the page. Letting the check pause
between each of its 41 attempts fixed that with **no change to the answer** (identical on 20 pages).

✅ **Then the slowness itself was fixed: a page went from ~56 seconds to ~25.** The tilt check was
doing an expensive image operation 41 times, and that operation had an exact shortcut — not an
approximation, the *same answer* more cheaply — so it takes 7 milliseconds instead of 856. **Checked
as a shortcut, not an improvement:** both versions run side by side at every angle, **328
comparisons, zero disagreements**.

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

*(The one old problem we decided **not** to fix — the cut-off signature, and why your 284 photo
labels stay a test only — moved to [OVERVIEW-JULY.md](OVERVIEW-JULY.md) on 7 August.)*

## What we do next

**Two lists now, and they run at the same time.** Nothing on one waits for the other.

### List A — the app (this is what reaches your friends)

1–6. ~~Build the reading server, check it matches the browser, switch the app over with a fallback,
   put both online, set the $5 alert, lock the door.~~ ✅ **All done 6 August** —
   <https://komavision.netlify.app>, the model on Hugging Face, the wake-up delay about 11 seconds.
7. ~~Make the app play the right makam.~~ ✅ **Done 7 August.** The app used to play every note
   exactly where it is written — but Turkish music does not work like that. In **uşşak** the note
   written "si with one small flat" is actually **played lower**, and no sign exists for where it
   really goes; only the makam tells you. The app now **guesses the makam from the page**, shows the
   guess and why, lets you change it, and plays the piece the way that makam is really played. It
   **only changes the sound — the notes on screen never move.** Right on 204 of 213 test pieces.
8. ~~Make the app look good.~~ ✅ **Done 7 August.** It is called **KomaVision**, it is in Turkish,
   and it looks like a music page rather than a testing tool: warm paper, the sheet music as the
   main thing on screen, one big box at the top to drop (or paste) the photo into. Only the buttons
   a musician uses stay in the open — play, stop, tempo, metronome, usul, makam; the dozen
   developer switches fold into a **Gelişmiş** drawer that stays shut.
9. **Put the new version on the website.** One rebuild, one upload — it carries items 7 and 8
   together. Then check it with `npm run smoke:live`.
10. **Make fixing a wrong note quick.** Today you click a bar, a window opens on top of the music,
   you edit a table of rows — and it will not save until the bar adds up again. It should work like
   MuseScore or Mus2: click the note, nudge it with the arrow keys, keep going. Worth doing properly
   because it is also *your labelling tool* — every page you correct becomes training data.
11. **Send the link to two friends and ask what to add.** Tell them the first upload of the day is
   slow (the rented computer has to wake up), and that a page takes about a minute. Ask about the
   **buttons and the screen**, not about mistakes in the notes — the notes are the exam's job.
12. **Open it to everyone — but only if Round 3's exam result is good.**

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
| **mark (accidental)** | A small symbol on one note that raises or lowers it. ~8 kinds; telling them apart is the hard part. |
| **bare note** | A note with no mark drawn. It may still be "lowered" by the line's signature — but the model should still write it bare and let reassembly apply the signature. |
| **slicer** | Step 1: the tool that cuts a page into strips. It first finds the staff lines; on tilted photos it failed, which we fixed with a "clean-up" step. |
| **exam** | Real pages the model never trains on — our honest score. It read 66% first; after we fixed 13 wrong answers in the answer key it reads ~78%, but most of that jump is the scoring quirk explained above, not the model improving. |
| **Round 1** | The first cycle of training the model on real pages. Shipped 2026-07-23; replaced by Round 2. |
| **Round 2** | The second cycle. Fixed two problems in how we make training pictures. The old score read 78% → 74%, but that turned out to be a scoring quirk; on the fair scores it is better, so it **shipped** on 2026-07-27 and is the model in the app. |
| **key signature** | The group of marks printed once at the start of a line, which apply to every matching note on it. This is where almost all the hard marks are — and where the model still gets confused. |
| **makam** | The "mode" a Turkish piece is in (uşşak, hicaz, hüzzam…). It decides not just which notes are used but **exactly where some of them are played**, which the written page cannot tell you. The app guesses it and lets you change it. |
