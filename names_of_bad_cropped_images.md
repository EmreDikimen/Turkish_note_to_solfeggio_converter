# Bad crops seen while labelling — the owner's running list

purpose: strips whose CROP is unusable, noticed by eye during the batch3 labelling pass
audience: the owner while labelling; whoever next decides whether the pools need re-emitting
updated: 2026-08-19

⚠ **The review UI's `bad` verdict is the authoritative record, not this file.** Pressing `x` on a
strip writes `bad` into `batch3.csv`, and `--merge-back` carries it into `reslice_all.csv` — that is
what later tooling reads, and `--stats --batch 3` counts it as the **bad rate**. This list is a
human note beside that: useful for spotting a *pattern* (a whole page mis-sliced, one failure mode
recurring) that a per-strip verdict cannot show.

So: mark it `bad` in the UI **as well as** writing it here, or it will not reach the data.

⚠ The bad rate is a decision input, not just bookkeeping. The scanned tail is where `realval-hard`
lost **33%** of its crops as unusable; if this list grows fast, the call is to cap the impact score
rather than read on ([docs/rung3/labeling-queues.md](docs/rung3/labeling-queues.md)).

---


gul_dalinda_oten_bulbulun_olsam_nota_p1_s03_w00
gul_dalinda_oten_bulbulun_olsam_nota_p1_s03_w01
gul_dalinda_oten_bulbulun_olsam_nota_p1_s03_w02
pek_revadir_sevdigim_ettiklerin_nota_p1_s03_w00
pek_revadir_sevdigim_ettiklerin_nota_p1_s03_w01.png
pek_revadir_sevdigim_ettiklerin_nota_p1_s03_w02.pngpek_revadir_sevdigim_ettiklerin_nota_p1_s03_w03.png
pek_revadir_sevdigim_ettiklerin_nota_p1_s03_w04.png