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


THE ONES THAT IS TOO DENSE SO THAT IT SHOULD BE SLICED AGAIN

Kurdilihicazkar_sirto_kemani_sebuh_ney_p1_s03_w01.png
Kurdilihicazkar_sirto_kemani_sebuh_ney_p1_s05_w00.png
Kurdilihicazkar_sirto_kemani_sebuh_ney_p1_s06_w00.png
Kurdilihicazkar_sirto_kemani_sebuh_ney_p1_s06_w01png ehl_i_askin_nesvegahi_kuse_i_meyhanedir_nota_p2_s00_w01.png
elbet_gonullerde_v2_p1_s00_w01.png
etmedin_bir_lahza_v2_p2_s03_w00.png



TOO TIGHT ANY NOTE IS NOT SEEN

aman_saki_lutfuna_amadeyim_nota_p1_s02_w03.png
elbet_gonullerde_v2_p2_s04_w02.png
gafil_ne_bilir_nesve_i_pur_sevk_i_vegayi_1_nota_p1_s04_w02.png
meclis_imeydesakiyapdf1571218833_nota_p1_s06_w03.png


CUTTED FROM A NOTE STEM, ACCIDENTAL SIGN IS SEEN BUT NOTE IS NOT

elbet_gonullerde_v2_p1_s03_w01.png
meclis_imeydesakiyapdf1571218833_nota_p1_s03_w00.png
meclis_imeydesakiyapdf1571218833_nota_p1_s04_w00.png
nikriz_zeybek_cemil_bey_tanburi_no_1_p1_s01_w00.png



CUTTED FROM A NOTE, NOT FROM BAR

etmedin_bir_lahza_v2_p2_s03_w00.png
etmedin_bir_lahza_v2_p2_s03_w01.png
meclis_imeydesakiyapdf1571218833_nota_p1_s03_w01.png
nikriz_zeybek_cemil_bey_tanburi_no_1_p1_s02_w00.png
nikriz_zeybek_cemil_bey_tanburi_no_1_p1_s02_w01.png
nikriz_zeybek_cemil_bey_tanburi_no_1_p1_s05_w02.png
nikriz_zeybek_cemil_bey_tanburi_no_1_p1_s07_w01.png
nikriz_zeybek_cemil_bey_tanburi_no_1_p1_s07_w02.png


