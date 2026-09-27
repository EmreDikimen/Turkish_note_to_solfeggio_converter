# Where we are and what we do next — in plain words

purpose: plain-English summary of the current state and the plan — no jargon, no music theory needed
audience: the project owner (this page is deliberately written in basic English)
updated: 2026-09-26

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
wipes out most of the time you saved.

⛔ **This half is still NOT built, and the obvious way to build it was tried and failed.** This page
used to end the paragraph above with "if the app highlighted the places it was unsure you would check
five spots instead of two hundred and fifty — we already compute that signal, we simply never showed
it to you." **That was too optimistic, and it stayed here for months after we knew better.** The
model's own "how sure am I" number was tested on 5 August against a target set in advance — highlight
the 10% of the page it is least sure about, and catch at least 60% of the real mistakes. It caught
**26.3%**. The idea was dropped rather than the target lowered. ⚠ Re-measured a different way on 18
August, it came out **worse than picking at random**. So finding the mistakes for you is still an
open, unsolved problem — not a feature waiting to be switched on.

## What we learned before that (27 July 2026) — we were fixing the wrong 13%

We counted every correction a user would have to make on the exam and sorted them by *what* needs
fixing. The answer changed the plan: **the note itself is 40% of the work and its length 28%, while
the microtonal marks — which two whole rounds went into — are only 13%.** The old score could only
see that 13%, which is why it looked like the whole problem. The full count, and what we already
know about note heights and note lengths, is counted in
[METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md).

## What happened on 28 July 2026 — we tested four ideas and three were wrong

Before spending money on training we checked four hunches about *why* the model makes mistakes.
Three did not survive the check. The reasoning is what stops us re-proposing them — the short
do-not-repeat list is near the bottom of this page, and the measurements are in
[METRICS.md](METRICS.md) and [DECISIONS.md](DECISIONS.md).

## The "can the model even see the page?" idea

Tested 15 August, **closed 17 August**. Short version: making a strip artificially wider (so the model
shrinks it more) genuinely does cost accuracy — but we then found we cannot buy the reverse, because
real pages are *already* at the good size, and cutting them smaller than one bar creates a worse
problem than it solves. It was stopped by a rule written down before the test ran. Two numbers we had
been believing turned out to be three times too pessimistic. Full account on that page.

## Where we are right now

### Round 3's practice questions and final exam are both finished (31 August 2026)

Round 3 is the next training run. Two piles of paper had to be finished before it could start, and
both are now done.

**The final exam is ready.** The exam is a set of real printed pages the model has never trained on,
read **once** at the end to decide whether the round passed. Every one of its **663** strips now has
a human answer, and all **64** pages are complete — that matters, because the score counts mistakes
*per page*, so a half-checked page would flatter itself.

**The practice material is ready too.** `strips_b8` is the pile the model learns from: **3,955**
small pictures of real music with the correct notes written beside each. You read **1,016** of them
by hand and corrected 576. The other 2,939 were accepted automatically, on a simple rule — if the
old answer and the model's own reading say exactly the same thing, the answer is probably right.
**We checked that rule on a random sample: 41 such rows, a human read all 41, none was wrong.**

⚠ **With one exception you had already spotted.** The **key signature** (the flats and sharps at the
start of a line) is the one part of an answer the *model* decides rather than the music database. So
for signatures, "the answer agrees with the model" is circular — the answer came from the model.
Your `unaccept_sig.py` puts those rows back in the queue; running it found **12 more wrong
signatures**.

**What Round 3 will use, and nothing else:** the 3,929 real pictures above, a fresh set of
computer-drawn practice pages, a small "practice test" (`_realval_v2`) to pick the best training
run, and the exam to grade it. The other queue (`b8-review`, about 4,700 more rows) waits for
**Round 4** — your decision. It would add roughly **11%** more material to a pile that already grew
70%, so it is not the thing that decides this round.

### The three things we now draw differently for training (31 August 2026)

The computer-drawn practice pages are how the model learns. This round adds three marks to them, and
all three are now built. You can look at them: `data/synthetic/_flag_preview/`.

1. **Staccato dots.** A dot *beside* a note means "longer". A dot *above* it means "short and
   detached" — and we had never drawn one, so the model thought every dot meant longer. Teaching it
   took the mistake from **72.7% to 0%**.
2. **A second way of drawing the triplet "3"**, which you found on two real scanned editions.
3. **The dotted usul barline** — the light broken line inside a bar that shows the usul's beats. We
   had never drawn one either, so the model guessed it was a repeat sign. You have been deleting
   those by hand while labelling: about **1 in 5** of your corrections was exactly that.

⚠ **None of the three changes the written answer** — they only change the picture. We checked: 188
answers came out **letter for letter identical** with the marks on and off. That is what makes them
free: no page has to be re-labelled.

⚠ **One number in the third one is a guess, and it is marked as a guess.** We draw the dotted
barline on 35% of pieces. Nobody has counted how often real Turkish printing uses it. Counting that
is still owed before we draw the final set.

### The app now reads the page's road signs (30 August 2026)

Sheet music does not write everything out. It uses **road signs** that say "go back and play that
part again". The app used to ignore two of them.

1. **The repeat sign** (`‖: … :‖`) means "play these bars twice". The app used to print those bars
   **twice on the paper**. Now the paper looks like a normal printed score — the bars appear once,
   with the sign — and the repeat is taken **when the music plays**.
2. **The 𝄋 sign** (called *segno*) is the one you asked about. In a **saz semâîsi** the **teslim**
   is written only once, and it is played after **every hâne**. The page says that with one glyph: a
   𝄋 at the start of the teslim, and a 𝄋 at the end of each later hâne. The rule is: the **first**
   𝄋 is only a bookmark; **every later** 𝄋 means "go back to the bookmark, play that section again,
   then come back here and carry on". The last one has nothing left to come back to, so the piece
   ends there — which is where the page prints "Son".

Before this, the second 𝄋 did nothing at all unless the page also said "D.C.", and almost none of
them do: of the **258** real pages that carry two or more 𝄋, **249** have no "D.C.". So the teslim
was simply never played after the later hâne.

⚠ **One thing the app cannot guess: where the section ENDS.** It looks for a "Son", and if there is
none, for the first `:‖` after the 𝄋. If the page has neither, the app **does nothing** and writes a
note saying why — on **58** of those 258 pages. Replaying a random stretch of music would be wrong;
playing the page straight through is only incomplete.


### The cutting tool got three fixes, and then you froze it (26 August 2026)

The **slicer** cuts a photo of a page into small strips. Before the model can read anything, the
slicer has to find the staff — the five lines the notes sit on. It was getting that wrong in three
different ways, and you found two of them **by looking at pages yourself**.

1. **Whole rows of music were disappearing.** Not cut badly — **not found at all**. On a faint
   photocopy the tool looks for a line that stays perfectly straight for a long way; a hand-ruled or
   slightly tilted line wanders, so the tool erased it. One page had 9 rows of music and the tool
   found 4. ⭐ **This is why no accuracy number ever showed it**: a row that is never found makes no
   strip, so there is nothing to be wrong about. The fix finds **320 extra rows across 227 pages**.
   It is **switched off** for now, and **on in the slice inspector** so you can see the lost rows.
2. **The app and the training data cut one page differently.** The browser and Python read the same
   picture and disagreed about where one staff ended — because a browser cannot convert an image to
   grey in exactly the same way, and the difference was **one unit of brightness**. That was enough
   to flip a decision that sat less than a pixel from its edge. Fixed, and now they agree.
3. **A crop that swallowed the row above it.** The tool measured one staff's line spacing 54% too
   large, so it magnified that row too little and the fixed-size picture reached up into the
   neighbouring music. Fixed.

⭐ **The most useful lesson is about the SHAPE of a fix.** Four times we tried to fix something by
making a rule *looser* everywhere. **All four made things worse** when measured on all 6,440 rows,
even though each looked right on a handful of pages. The three fixes that worked all do the same
thing instead: **only act where the normal rule already produced something broken, never touch a page
that is fine.** That is now written at the top of the slicer notes so nobody spends a day
rediscovering it.

**Then you froze the slicer**, and that was the right call: the last two fixes were worth **−2 and +2
rows out of 6,440** — essentially nothing. The tool is not perfect, but it is no longer the thing
worth working on.

**You lifted the freeze twice on 3 September, and the second time paid.** A row was cut at a note's
stem (the thin line on a note) that ran exactly from the top staff line to the bottom one, so every
test read it as a barline. New rule: **a line with something wide at BOTH ends is a stem** — a
barline's ends are bare. On all 6,440 rows: **+371 rows read exactly right**, and it only ever
removes cuts. [METRICS-SLICER-STEMS.md](METRICS-SLICER-STEMS.md).

### The exam stays as it is, and you are labelling it

We looked at re-cutting the exam with the improved tool and **decided not to**. The reason is
simple: when the exam is re-cut, your old answers come back only as **suggestions to confirm**, not
as finished work — deliberately, because an answer you gave about one picture should not be trusted
about a different picture. So re-cutting would turn **208 rows left** into **about 663 to look at
again**. Not worth it.

The exam is fine for grading: all 67 pages were cut by the **same** tool, and that is what makes the
test fair. ⚠ One thing to say out loud when you quote the score: it describes the model on crops
**slightly older** than what the app cuts today. The difference is small — 62 and 13 rows out of
6,440 — but it is not zero.


### The features that shipped in early August

In one line each: the **violin, clarinet and kanun** play real
recordings and are live (13 August, and you signed them off after four rounds of listening); your
**two friends** liked the app and asked for exactly those instrument sounds (11 August); the **usul
plays on a real darbuka and bendir** and all ten patterns passed your ear (11 August); the **example
songs were removed** so the app gives away nobody's music (8–9 August, two copyright jobs still
yours to decide); and the app learned to **read a whole page** at about 25 seconds (5 August).

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
| **Phones** | ⚠ **CHANGED 19 September 2026: the phone is now the next thing on the app side**, and on **26 September** you rebuilt most of it by using it. The plan said *"web first, phones later"*. Then we looked at a 375-pixel-wide phone screen for the first time and it was bad: the music started **halfway down**, the one line that fit was **cut off on the right**, and on the edit screen **not one editing tool was visible**. ✅ **All of that is fixed, and more.** The music now fits the screen, upright or sideways (the part hidden off the right edge went from **659 pixels to 0**), and a page too crowded to fit is **drawn slightly smaller** instead of being cut — like a pocket songbook — which needed 87% on the busiest page we have. ✅ The **"Çal" tab is gone**: everything that was on it (usul, metronome, drum, makam, transposition, accidentals, instrument sound) now **slides open under the Play/Stop row**, so you change it with the music still on screen. ✅ The **tempo box can be typed in** — it could not be, at all: it refused every half-typed number, so from 80 you could never reach 120. It now also has **− and + buttons** that speed up when you hold them. ✅ **Geri al** (undo) moved into the toolbox, where your hand already is, and it steps back as far as you like. ✅ The **Güfte switch is gone** for now, because the reader does not read words off the page yet. ⛔ **But none of this is on the website yet — it is only in the code.** The next upload (`npm run deploy:app`) is what puts it there, and that is the one thing waiting on you. ✅ **On 27 September four more.** You can now **save the score** — one button in the corner of the page, then a choice of **PNG** (a picture) or **PDF** (paper). The PDF is made by the browser's own print, which is why it comes out sharp at any zoom, breaks into pages properly, and adds nothing to what a visitor has to download. You can **retune the violin's four strings**, each from a list of ordinary note names. And the staff now prints an **arıza işareti once per bar** instead of on every single note, which is what a printed music book does. ⛔ One of the four was a **bug you would have hit**: the new save button was sitting exactly on top of the *"Enstrüman üzerinde"* half of the switch, on the **Düzenle** screen — so a finger aimed at the instrument opened the save menu instead. It is fixed. ⏭ Still to do: the editing toolbox still makes you scroll to find a tool. Tablets stay out of it on purpose — an iPad keeps the desktop screen. Details: [STATUS.md](STATUS.md), and the phone's own page [features/phone.md](features/phone.md) |
| **Opening it to everyone** | ⚠ **OVERTAKEN BY EVENTS: you opened it on 5 September 2026**, before any exam result. The plan said to wait for Round 3's exam and it did not wait — that was your call, and what it changed is in [STATUS.md](STATUS.md) |

⚠ **One honest cost of swapping the model whenever it improves:** if a friend says "it read this
page badly", we will not know for certain which model did it. That is acceptable *because* you are
asking them about features — but it means those remarks are stories, not measurements. The exam is
still the only thing that tells us whether a model got better.

### Why there is a server, where it lives, what it costs → [OVERVIEW-SERVER.md](OVERVIEW-SERVER.md)

Moved there on 11 August 2026, when this page grew past its size limit. It explains — in the same
plain words — why the reading now happens on a rented computer instead of your laptop, the three
places the app lives and why it is not just one, what it all costs, and one thing we decided **not**
to build. None of it has changed; it is background rather than news.

### Before that — the model work

**Rounds 1 and 2, the phone-photo test and the sharps.** The one-line version: Round 2 was the model
in the app until 3 September, it was a small improvement once the score was counted fairly, and the
weakness that remains is telling the koma and küçük sharps apart **inside the key signature**.
Numbers: [METRICS-EXAM.md](METRICS-EXAM.md). Reasoning:
[archive/rounds/round1.md](archive/rounds/round1.md), [archive/rounds/round2.md](archive/rounds/round2.md).

---

*(The one old problem we decided **not** to fix — the cut-off signature, and why your 284 photo
labels stay a test only — is recorded in [DECISIONS.md](DECISIONS.md).)*

## What we do next

**Two lists now, and they run at the same time.** Nothing on one waits for the other.

### List A — the app → [OVERVIEW-APP.md](OVERVIEW-APP.md)

**Fifteen items, and the app side is where almost everything has shipped.** The whole list — what
each one does, what it cost and what it taught — moved to [OVERVIEW-APP.md](OVERVIEW-APP.md) on
27 September 2026, when this file hit its size limit. ⏭ **The one thing waiting on you is an
upload**: everything built on 26 and 27 September is in the code and not on the website. The phone
row in the table above says what that upload would carry.

### The model work → [OVERVIEW-ROUND4.md](OVERVIEW-ROUND4.md)

Round 3 is finished and it missed; **what we do next is [OVERVIEW-ROUND4.md](OVERVIEW-ROUND4.md)** (3
September). The Round 3 story — the triplet work, the scanned-pages decision, the three trainings and
what the one-shot exam decided — is in [rung3/round3.md](rung3/round3.md), numbers in
[METRICS-EXAMSET.md](METRICS-EXAMSET.md).

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
