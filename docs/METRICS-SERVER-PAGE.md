# Metrics — the server's page path (`POST /page`)

purpose: the numbers behind moving slicing to the decode server for the native app — preprocessing parity, slicing parity, timing
audience: whoever touches apps/server/src/{donut,image,slicePage}.ts or builds the phone client on /page
updated: 2026-10-11

> Index row: [METRICS.md](METRICS.md). Why the path exists: [DECISIONS.md](DECISIONS.md) (2026-10-11,
> "SLICING FOR THE NATIVE APP RUNS ON THE SERVER"). Current state: [STATUS.md](STATUS.md).
> Built on branch `native-app`; **not deployed** — the live Cloud Run has no `/page` yet.

## Preprocessing — the server's crop → 409×583 step against training's own processor

`npm run parity:donut` — `apps/server/src/donut.ts` vs `DonutImageProcessor` (transformers 4.57.6,
Pillow 12.2.0) loaded from `r4-ctl-stage2-last`, compared before rescale/normalize.

| Measure | Value |
|---|---|
| **Byte-identical strips** | **1,200 / 1,200** — 600 real (200 pages of `strips_v2`, first/middle/last strip each) + 600 synthetic (`strips_v7_final`) |
| First run, BILINEAR for both steps | **4 / 116** identical, max \|Δ\| 41 — the finding below |
| After the BICUBIC thumbnail, before the float box | **1,197 / 1,200**, 1–4 px at \|Δ\| 1 on 3 narrow strips (the `reduce()` path) |
| x86-64 Pillow 11.3.0 (Rosetta) against arm64 Pillow 12.2.0 | **1,200 / 1,200** identical — the reference does not depend on the CPU that runs it |

⭐ **The finding: training's `thumbnail` step is BICUBIC, not the config's BILINEAR.**
`DonutImageProcessor.preprocess` passes `resample` to `resize` but calls `thumbnail` without it, so
the method's own default (`BICUBIC`, `reducing_gap=2.0`) applies. Every strip the model was trained
on went through both filters. The browser's canvas path ([../apps/web/src/omr/preprocess.ts](../apps/web/src/omr/preprocess.ts))
was always known to be "not PIL BILINEAR"; it is not PIL at all, and this is now one more reason.
⚠ The last 3 strips were Pillow's box coordinates being C `float`, not `double` — a fractional box
(every `reduce()` leaves one) loses its low bits in `precompute_coeffs`.

## Slicing — the browser's slicer run in Node, against Python

`npm run parity:serverslice -- --pages 30` — `apps/server/src/image.ts` + the TS slicer vs
`page_to_strips` itself, on a deterministic spread of 30 pages from `data/real/images` (all PNG).

| Measure | Value |
|---|---|
| Pages with the same strips (count and names) | **30 / 30** |
| Strips | **652**: 379 identical, 76 differ by ±1 only, 191 by ±2 (the max) |
| Strips whose width changed | **6**, on 3 pages — one cut moved by 1 px each |
| **Server gray vs decode-then-`cvtColor`** | **30 / 30 pages byte-identical** |

Every page with a difference is a page where Python's `cv2.imread(IMREAD_GRAYSCALE)` itself differs
from decoding first and converting after (80 to 206,762 pixels a page) — the documented
browser-vs-Python decoder gap ([METRICS-SLICER.md](METRICS-SLICER.md)). The server takes the
browser's road, decode then `cvtColor`, and lands on the same gray, so on these pages **the server
sees what the web app sees**. ⚠ Not measured: the server against the BROWSER directly (no harness
yet), and any JPEG from the corpus — `data/real/images` holds none.

**EXIF orientation:** one page saved as JPEG under all 8 orientations (stored transformed, as a phone
does): all 8 came back upright at 1654×2339, mean \|Δ\| **0.24–0.41** grey against the upright JPEG
(re-encoding noise; a wrong turn reads in the tens), **19 strips** every time.

## Timing — what a page costs (M4, this Mac)

| Measure | Value |
|---|---|
| Slicing, Node, 1 thread | **2.0 s a page** (30 pages). ⚠ Not the ~35 s skew sweep `prepPage.ts` quotes for the browser of 2026-08 — the closed-form row sums replaced that cost |
| **One page through the BUNDLED server** (orientation-6 JPEG, 2 ORT threads) | **10.0 s**: read 0.14 s + slice 2.1 s + decode 7.7 s; 9 staves → 19 strips, `hitCap` 0, RSS **996 MB** |
| `server.js` bundle | **18.0 MB** (opencv.js inlined) |

⚠ **Not measured on Cloud Run.** The deployed 1 vCPU is ~3.5× slower than an M4 core
([METRICS.md](METRICS.md) §Decode server), so slicing there is a guess of ~5–7 s a page on top of
the decode; and the image grows by opencv.js, so the cold start may too.

**Limits (`limits.ts`), checked against the bundled server:** a non-image body → **400**, a 16 MB
body → **413**, a 9000×9000 PNG (a small file) → **413 before decoding**.
