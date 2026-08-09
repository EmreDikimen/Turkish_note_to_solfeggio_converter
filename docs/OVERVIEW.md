# Where we are and what we do next — in plain words

purpose: plain-English summary of the current state and the plan — no jargon, no music theory needed
audience: the project owner (this page is deliberately written in basic English)
updated: 2026-08-09

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

### 8–9 August 2026: the app no longer gives away other people's music, and that is now LIVE

You asked whether publishing the app causes a copyright problem. It did, and it is fixed — the full
plain-English answer is **[OVERVIEW-COPYRIGHT.md](OVERVIEW-COPYRIGHT.md)**. Short version: the
example songs built into the app came from a database whose licence says *nobody may ever make money
from anything built with it*, and two were by composers still in copyright. You chose to **remove the
examples** rather than credit them, so the app stays free of strings and now opens straight on
"upload your sheet music".

**Put online on 9 August.** Until that morning the website still handed out all five of those songs
to anyone who typed the file name — the fix existed only on this computer. Now every one of them
answers "not found", and the app was checked end to end afterwards and still reads a page both ways.

⚠ **Two copyright jobs are still open, and both are yours to decide.** The old files are still in
the **public code history** on GitHub (removing them means rewriting that history), and the project
still has **no LICENCE file** of its own. Detail: [THIRD-PARTY.md](THIRD-PARTY.md).

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

### Before that — the model work

**Rounds 1 and 2, the phone-photo test and the sharps, in the same plain words, moved to
[OVERVIEW-MODEL.md](OVERVIEW-MODEL.md)** on 9 August (this page hit its length limit). Nothing was
dropped. The one-line version: Round 2 is the model in the app, it is a small improvement once the
score is counted fairly, and the weakness that remains is telling the koma and küçük sharps apart
**inside the key signature**.

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
   developer switches fold into a **Gelişmiş** drawer that stays shut. The bar also carries the
   three that change what you see and hear: **Transpozisyon** (how far up or down to move the
   whole piece, in komas — and named by interval where one fits, like "4 ses (22 koma)"),
   whether the written staff moves with it, and how **arıza işaretleri** are printed.
9. ~~Put the new version on the website.~~ ✅ **Done 9 August.** One rebuild, one upload — it carried
   items 7 and 8 **and** the copyright removal. Checked afterwards: the app reads a page both ways,
   and the five songs that used to be downloadable are gone.
   Three things fell out of it. **We now know how long the rented computer really takes to wake up
   after a proper sleep: about 11 seconds** — measured on a server nobody had touched for three
   hours, rather than minutes after an upload as before. ⚠ But **we still have not proved the app
   handles that wait on the real website.** It briefly looked like we had; in fact an automatic
   visitor — some robot that visits every site right after it changes — had woken the server 33
   seconds before our check ran, so our check found it already awake. Worth knowing for next time:
   **checking straight after an upload can never test the sleeping case**, because uploading is what
   summons the robot. And an alarm from 6 August turned out to be nothing — the rented computer
   looked like it had got **2.5× slower to wake**, but that only happens on the first wake after new
   code is uploaded; four later wakes are back to normal.
   **You also have real users already.** Three people who are not you read a page on 8 August (two on
   Android phones, one on a desktop). We can see this because the app quietly says hello to the
   server when someone opens it. Most of the other visits are robots, not people — see the note under
   item 11.
10. **Make fixing a wrong note quick — started 7 August, about a third done.** It used to be: click
   a bar, a window opens on top of the music, edit a table of rows, and it refuses to save until the
   bar adds up again. Now you can **click a note right on the page**, **drag it up or down** to
   change its pitch, or press the **✕** to delete it — and **undo** anything (Ctrl/⌘+Z). It works
   like Mus2, which is the point.
   Still to come: a **palette** beside the music for choosing note lengths and accidentals, adding a
   note by clicking empty space, and then the old window goes away.
   ⚠ One thing to be honest about: this is **not** a labelling tool any more. An earlier plan said
   every page you corrected would become training data, but the **Save JSON** button is being
   removed, so that stops being true. The reason to build it now is simpler — *a friend whose page
   has a wrong note should be able to fix it.*
11. **Send the link to two friends and ask what to add.** Tell them the first upload of the day is
   slow (the rented computer has to wake up), and that a page takes about a minute. Ask about the
   **buttons and the screen**, not about mistakes in the notes — the notes are the exam's job.
   ⚠ **How to tell a real visitor from a robot, when you look at who used it.** The server knows two
   different things: someone **opened** the page, and someone **uploaded** a page. Only the second
   means a person used it. Robots do the first constantly — one of them pretended to be an iPhone
   from four different places in two days — so count uploads, not visits.
12. **Open it to everyone — but only if Round 3's exam result is good.**

### List B — the model (Round 3, running in parallel)

1. **Write down what Round 3 has to achieve, before training starts.** On the honest measure — *9
   pages in 10 need 5 fixes or fewer* — with today's 57% as the starting point. This number now does
   double duty: it is also the gate for opening the app to everyone.
2. **Draw more eighth notes and longer bars** (the item explained below). Check on 300 sample
   pictures before redrawing all 40,826.
3. **Decide whether to rebuild the training sets from the newly-cut strips.** Not automatic — it
   would rewrite the lists that our hand-checked answers hang off.

The longer backlog those three were chosen from — and the three ideas we tested and closed on 28
July, which should not be re-proposed — are on [OVERVIEW-MODEL.md](OVERVIEW-MODEL.md).

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
