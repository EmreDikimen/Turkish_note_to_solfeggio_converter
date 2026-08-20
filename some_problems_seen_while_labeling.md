# Problems seen while labelling — the owner's running list

purpose: model failures noticed by eye during the batch3 labelling pass, one line each
audience: the owner while labelling; whoever next decides what the renderer or the token set owes
updated: 2026-08-20

⚠ **The review UI's verdict is the authoritative record, not this file.** A correction typed into
`batch3.csv` is what changes the training data; these lines are the *pattern* behind the corrections,
which the CSV cannot show. A note here that turns out to be systematic gets measured and written up —
the first one already was, see below.

gorunce_ben_seni_ey_mah_nota_p1_s05_w02.png: Model hallucinates repstart when there is not. It recognizes dotted bar lines as repstart or an augmentation dot of previous note

---

**Measured 2026-08-20 — the dotted-barline line above is a real, repeated failure.** 117 of 1,499
`batch3` rows decode a `\repstart` (7.8%), and of the 23 judged so far 13 had it removed as wrong.
Cause: Turkish editions print a dotted barline for usul subdivisions, `ADDED_TOKENS` has no spelling
for one, and the renderer draws none — so 0 of 40,826 strips contain one and the nearest thing the
model knows is a repeat sign, a line plus *dots*. Full write-up:
[docs/METRICS-DIAGNOSTICS.md](docs/METRICS-DIAGNOSTICS.md); the owed work is item 5 of
[docs/BACKLOG.md](docs/BACKLOG.md).
