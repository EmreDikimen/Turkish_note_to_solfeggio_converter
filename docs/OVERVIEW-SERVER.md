# Why there is a server, where the app lives, and what it costs — in plain words

purpose: the plain-English explanation of the hosting setup — why a server exists at all, the three services involved, the cost, and one thing we chose not to build
audience: the project owner (deliberately basic English)
updated: 2026-08-11

Split out of [OVERVIEW.md](OVERVIEW.md) on 11 August 2026 at its size limit. **Nothing here
changed in the move.** Current state and the plan → [OVERVIEW.md](OVERVIEW.md).

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