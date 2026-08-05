/**
 * Slice inspector — upload a page, see exactly what the slicer cut out of it.
 *
 * A SEPARATE page from the app (`/slices.html`), on purpose: this is a diagnostic view, and nothing
 * here touches a score, the model, or the editor. It runs the same `slicePage` the "Read page"
 * button runs — the same ported slicer W6 checked against Python over the corpus — and then simply
 * shows the crops instead of decoding them. So what you see IS what the model would be fed.
 *
 * No model is loaded, which is why this is quick: slicing a page is ~1.6 s, against ~19 s to read
 * one. Everything is held in memory for the session only (owner decision 2026-08-05); a reload
 * starts empty. Deleting a strip removes it from THIS view and nothing else — it cannot change a
 * score, because this page never makes one.
 */
import { slicePage, type SlicedPage } from "../omr/page";
import { setVplaceTopClaim } from "../omr/slicer/constants";
import { decodeStrips, type StripInput } from "../omr/pipeline";
import { getModel } from "../omr/session";
import type { Strip } from "../omr/slicer/slicer";

/**
 * LilyPond note letter → the solfège syllable the rest of the app uses (`packages/core`'s
 * `spellNote`). Lower-case here because a decoded token is lower-case: `b'16` reads as `si'16`.
 */
const LETTER_TO_SOLFEGE: Record<string, string> = {
  c: "do",
  d: "re",
  e: "mi",
  f: "fa",
  g: "sol",
  a: "la",
  b: "si",
};

/** A note token: letter, octave marks, an OPTIONAL duration, dots. `\d*` is what lets a bare
 *  signature letter (`\sig \bakiyeFlat b`) be renamed too — it carries no duration. */
const NOTE_TOKEN = /^([a-g])([',]*)(\d*)(\.*)$/;

/**
 * Rewrite one decoded token with its note name, leaving everything else exactly as the model
 * emitted it: `b'16` → `si'16`, `\komaSharp` → `\komaSharp`, `r4` → `r4`.
 *
 * Rests are deliberately NOT renamed. The note model calls a rest "Es", but `r` is unambiguous in
 * the token stream and inventing a second spelling for it would make the two harder to compare.
 */
export function toSolfegeToken(tok: string): string {
  const m = NOTE_TOKEN.exec(tok);
  if (!m) return tok;
  const [, letter, octave, dur, dots] = m;
  return `${LETTER_TO_SOLFEGE[letter!] ?? letter}${octave}${dur}${dots}`;
}

/** The whole label, token by token. Whitespace is normalized to single spaces. */
export function toSolfegeLabel(tokens: string): string {
  return tokens.trim().split(/\s+/).filter(Boolean).map(toSolfegeToken).join(" ");
}

interface StripItem {
  name: string;
  canvas: HTMLCanvasElement;
  geom: Strip;
  /** what the model read, once this page has been decoded — raw tokens as emitted */
  tokens?: string;
  /** the least confident token in the strip; the W1 signal, shown because it is free here */
  minLogprob?: number;
}

interface PageItem {
  id: number;
  fileName: string;
  stem: string;
  /** object URL of the original upload, for the thumbnail — revoked when the page is removed */
  thumbUrl: string;
  sliced: SlicedPage;
  strips: StripItem[];
}

const pages: PageItem[] = [];
let selectedId: number | null = null;
let actualSize = false;
let nextId = 1;

const root = document.getElementById("root")!;

// ---------------------------------------------------------------------------------------------
// Chrome

const style = document.createElement("style");
style.textContent = `
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; color: #222; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .sub { color: #666; margin: 0 0 16px; }
  .bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
  .status { color: #0a58ca; margin: 8px 0; min-height: 20px; }
  .err { color: crimson; }
  .thumbs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
  .thumb { border: 2px solid #ddd; border-radius: 8px; padding: 6px; cursor: pointer; background: #fff;
           width: 132px; text-align: center; }
  .thumb.sel { border-color: #0a58ca; box-shadow: 0 0 0 2px rgba(10,88,202,.15); }
  .thumb img { width: 116px; height: 150px; object-fit: contain; background: #f6f6f6; display: block; }
  .thumb .name { font-size: 11px; word-break: break-all; margin-top: 4px; color: #444; }
  .thumb .meta { font-size: 11px; color: #888; }
  .thumb .del { font-size: 11px; color: #b00; background: none; border: none; cursor: pointer; }
  .stats { background: #f6f8fa; border: 1px solid #e2e6ea; border-radius: 8px; padding: 10px 12px;
           margin-bottom: 14px; font-size: 13px; color: #333; }
  .strip { border: 1px solid #ddd; border-radius: 8px; padding: 8px; margin-bottom: 10px; background: #fff; }
  .strip.gone { opacity: .35; }
  .strip header { display: flex; gap: 12px; align-items: baseline; font-size: 12px; color: #555;
                  margin-bottom: 6px; flex-wrap: wrap; }
  .strip header .id { font-weight: 600; color: #222; font-family: ui-monospace, monospace; }
  .strip .wrap { overflow-x: auto; background: #fafafa; width: fit-content; max-width: 100%; }
  .strip canvas { display: block; }
  .strip.fit canvas { max-width: 100%; height: auto; }
  .strip button { font-size: 12px; cursor: pointer; }
  .label { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
           line-height: 1.5; margin-top: 8px; padding: 7px 9px; background: #f6f8fa;
           border: 1px solid #e2e6ea; border-radius: 6px; word-break: break-word; }
  .label .cmd { color: #8250df; }
  .label .note { color: #0a3069; font-weight: 600; }
  .label .raw { display: block; margin-top: 5px; color: #8a8a8a; font-size: 11.5px; font-weight: 400; }
  .label .unsure { float: right; color: #b26a00; font-size: 11.5px; }
  .label.none { color: #888; font-style: italic; font-family: inherit; }
  .vplace { font-size: 11.5px; color: #777; }
  .vplace.bad { color: #b00; font-weight: 600; }
  .empty { color: #888; padding: 30px 0; }
`;
document.head.appendChild(style);

root.innerHTML = `
  <h1>Slice inspector</h1>
  <p class="sub">
    Upload a page and see the strips the slicer cut from it — the exact crops the model would read.
    No model is loaded and no score is made. Held in memory for this session only.
    The app itself is at <a href="/">/</a>.
  </p>
  <div class="bar">
    <label>Add page(s): <input id="file" type="file" accept="image/*" multiple /></label>
    <label><input id="actual" type="checkbox" /> actual size</label>
    <label title="Decode every strip with the model as soon as the page is sliced (~1.2 s a strip). Untick to slice only, which is ~1.6 s a page."><input id="autoread" type="checkbox" checked /> read with the model</label>
    <label title="Restore the OLD rule, where a slur or ornament above the staff could push the staff down and shear the beams below. Off = the capped rule that ships. Re-slices every page."><input id="bottomfirst" type="checkbox" /> old placement (ornaments outrank beams)</label>
    <button id="clear">Clear all</button>
  </div>
  <div id="status" class="status"></div>
  <div id="thumbs" class="thumbs"></div>
  <div id="detail"></div>
`;

const fileInput = root.querySelector<HTMLInputElement>("#file")!;
const actualBox = root.querySelector<HTMLInputElement>("#actual")!;
const clearBtn = root.querySelector<HTMLButtonElement>("#clear")!;
const bottomFirstBox = root.querySelector<HTMLInputElement>("#bottomfirst")!;
const autoReadBox = root.querySelector<HTMLInputElement>("#autoread")!;
const statusEl = root.querySelector<HTMLDivElement>("#status")!;
const thumbsEl = root.querySelector<HTMLDivElement>("#thumbs")!;
const detailEl = root.querySelector<HTMLDivElement>("#detail")!;

function setStatus(text: string, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "status err" : "status";
}

// ---------------------------------------------------------------------------------------------
// Slicing

fileInput.addEventListener("change", () => {
  const files = [...(fileInput.files ?? [])];
  fileInput.value = ""; // re-picking the same file must fire change again
  if (files.length) void addPages(files);
});

async function addPages(files: File[]) {
  fileInput.disabled = true;
  try {
    for (const [i, file] of files.entries()) {
      const prefix = files.length > 1 ? `(${i + 1}/${files.length}) ` : "";
      const url = URL.createObjectURL(file);
      const stem = file.name.replace(/\.[^.]+$/, "") || "page";
      try {
        const sliced = await slicePage(url, stem, {
          onProgress: (phase, done, total) =>
            setStatus(done != null ? `${prefix}${phase}… ${done}/${total}` : `${prefix}${phase}…`),
        });
        // `slicePage` hands back canvases already — the same objects the decoder would be given.
        const strips: StripItem[] = sliced.strips.map((s, k) => ({
          name: s.name ?? `strip ${k}`,
          canvas: s.image as HTMLCanvasElement,
          geom: sliced.geometry[k]!,
        }));
        const page: PageItem = { id: nextId++, fileName: file.name, stem, thumbUrl: url, sliced, strips };
        pages.push(page);
        selectedId = page.id;
        render();
        setStatus(
          `${prefix}${file.name}: ${sliced.nStaves} staves → ${strips.length} strips in ` +
            `${(sliced.totalMs / 1000).toFixed(1)} s` +
            (sliced.skewDeg ? ` (deskewed ${sliced.skewDeg.toFixed(1)}°)` : ""),
        );
        // Read it immediately. The button was there from the start and was not found, which is the
        // right verdict on the design: the labels were asked for, so they should just be present.
        if (strips.length && autoReadBox.checked) await readPage(page);
        if (!strips.length)
          setStatus(
            `${prefix}${file.name}: no staves found — this reads screenshots and clean scans of ` +
              `Turkish notation, one page at a time`,
            true,
          );
      } finally {
        // the object URL stays alive for the thumbnail; only release it if the page never landed
        if (!pages.some((p) => p.thumbUrl === url)) URL.revokeObjectURL(url);
      }
    }
  } catch (err) {
    setStatus(String(err), true);
  } finally {
    fileInput.disabled = false;
  }
}

// ---------------------------------------------------------------------------------------------
// Reading the strips with the model

let reading = false;

/**
 * Decode the selected page's strips, on demand.
 *
 * Deliberately NOT automatic. Slicing a page is ~1.6 s; reading it is ~1.2 s per strip, so a
 * 29-strip page is ~35 s and would throw away the reason this view is quick. Only strips that have
 * no label yet are decoded, so deleting a few and pressing it again costs nothing for the rest.
 */
async function readPage(p: PageItem) {
  const todo = p.strips.filter((s) => s.tokens === undefined);
  if (!todo.length || reading) return;
  reading = true;
  render();
  try {
    setStatus("loading model…");
    const { sessions, meta } = await getModel(setStatus);
    const inputs: StripInput[] = todo.map((s) => ({
      system: s.geom.system,
      window: s.geom.window,
      image: s.canvas,
      name: s.name,
    }));
    const decoded = await decodeStrips(sessions, meta, inputs, {
      onProgress: (done, total) =>
        setStatus(done < total ? `reading strip ${done + 1} of ${total}…` : "done"),
    });
    decoded.forEach((d, i) => {
      const strip = todo[i]!;
      strip.tokens = d.tokens;
      strip.minLogprob = d.minLogprob;
    });
    const unsure = todo.filter((s) => (s.minLogprob ?? 0) < -1.0).length;
    setStatus(
      `read ${todo.length} strip${todo.length > 1 ? "s" : ""} of ${p.fileName}` +
        (unsure ? ` — ${unsure} the model was unsure about (min logprob < −1.0)` : ""),
    );
  } catch (err) {
    setStatus(String(err), true);
  } finally {
    reading = false;
    render();
  }
}


/**
 * Re-slice everything under the other vertical-placement rule (see `VPLACE_BOTTOM_FIRST`).
 *
 * Ticking it restores the OLD uncapped rule, where ink above the staff could claim room without
 * limit and shear the beams below. Kept as an A/B so the shipped rule can be checked on a real page
 * rather than taken on trust. Labels are dropped because the crops change, so an old label would
 * describe pixels that no longer exist.
 */
bottomFirstBox.addEventListener("change", () => {
  setVplaceTopClaim(bottomFirstBox.checked ? 99 : 3.5); // 99 sp = effectively uncapped
  void resliceAll();
});

async function resliceAll() {
  if (!pages.length) return;
  bottomFirstBox.disabled = true;
  try {
    for (const [i, p] of pages.entries()) {
      setStatus(`re-slicing ${i + 1}/${pages.length}: ${p.fileName}…`);
      const sliced = await slicePage(p.thumbUrl, p.stem);
      p.sliced = sliced;
      p.strips = sliced.strips.map((st, k) => ({
        name: st.name ?? `strip ${k}`,
        canvas: st.image as HTMLCanvasElement,
        geom: sliced.geometry[k]!,
      }));
    }
    setStatus(
      `re-sliced ${pages.length} page(s) — ` +
        (bottomFirstBox.checked ? "OLD placement: ornaments outrank beams" : "back to the shipped placement"),
    );
  } catch (err) {
    setStatus(String(err), true);
  } finally {
    bottomFirstBox.disabled = false;
    render();
  }
}

// ---------------------------------------------------------------------------------------------
// Rendering

autoReadBox.addEventListener("change", () => {
  const p = pages.find((x) => x.id === selectedId);
  if (autoReadBox.checked && p) void readPage(p);
  else render();
});

actualBox.addEventListener("change", () => {
  actualSize = actualBox.checked;
  render();
});

clearBtn.addEventListener("click", () => {
  for (const p of pages) URL.revokeObjectURL(p.thumbUrl);
  pages.length = 0;
  selectedId = null;
  setStatus("");
  render();
});

function removePage(id: number) {
  const i = pages.findIndex((p) => p.id === id);
  if (i < 0) return;
  URL.revokeObjectURL(pages[i]!.thumbUrl);
  pages.splice(i, 1);
  if (selectedId === id) selectedId = pages[0]?.id ?? null;
  render();
}

function removeStrip(pageId: number, name: string) {
  const p = pages.find((x) => x.id === pageId);
  if (!p) return;
  const i = p.strips.findIndex((s) => s.name === name);
  if (i >= 0) p.strips.splice(i, 1);
  render();
}

function render() {
  renderThumbs();
  renderDetail();
}

function renderThumbs() {
  thumbsEl.innerHTML = "";
  for (const p of pages) {
    const el = document.createElement("div");
    el.className = `thumb${p.id === selectedId ? " sel" : ""}`;
    el.title = `${p.fileName} — click to see its slices`;
    const img = document.createElement("img");
    img.src = p.thumbUrl;
    img.alt = p.fileName;
    el.appendChild(img);
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = p.fileName;
    el.appendChild(name);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${p.sliced.nStaves} staves · ${p.strips.length} strips`;
    el.appendChild(meta);
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "remove page";
    del.addEventListener("click", (e) => {
      e.stopPropagation(); // the card itself selects; the button must not
      removePage(p.id);
    });
    el.appendChild(del);
    el.addEventListener("click", () => {
      selectedId = p.id;
      render();
    });
    thumbsEl.appendChild(el);
  }
}

/**
 * The decoded label under a strip: note names first, the model's raw tokens beneath.
 *
 * Both are shown on purpose. The solfège line is the readable one; the raw line is what the model
 * actually emitted and is what any bug report or comparison has to quote — a renamed token cannot
 * be pasted into the stitcher or diffed against Python.
 */
function labelEl(st: StripItem): HTMLElement {
  const el = document.createElement("div");
  if (st.tokens === undefined) {
    el.className = "label none";
    el.textContent = "not read yet";
    return el;
  }
  el.className = "label";

  if (st.minLogprob !== undefined) {
    const conf = document.createElement("span");
    conf.className = "unsure";
    // The −1.0 threshold is the one W1/W3 validated as separating the strips the two runtimes
    // disagree on. It is a hint, not a promise — the pre-registered 10%/60% bar was NOT met.
    conf.textContent =
      st.minLogprob < -1.0
        ? `⚠ unsure (min ${st.minLogprob.toFixed(2)})`
        : `min ${st.minLogprob.toFixed(2)}`;
    el.appendChild(conf);
  }

  const tokens = st.tokens.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    el.appendChild(document.createTextNode("(the model read nothing here)"));
    return el;
  }
  tokens.forEach((tok, i) => {
    const span = document.createElement("span");
    span.className = tok.startsWith("\\") ? "cmd" : "note";
    span.textContent = toSolfegeToken(tok);
    if (i) el.appendChild(document.createTextNode(" "));
    el.appendChild(span);
  });

  const raw = document.createElement("span");
  raw.className = "raw";
  raw.textContent = tokens.join(" ");
  el.appendChild(raw);
  return el;
}

function renderDetail() {
  detailEl.innerHTML = "";
  const p = pages.find((x) => x.id === selectedId);
  if (!p) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = pages.length ? "Pick a page above to see its slices." : "No pages yet.";
    detailEl.appendChild(empty);
    return;
  }

  const stats = document.createElement("div");
  stats.className = "stats";
  const s = p.sliced;
  stats.textContent =
    `${p.fileName} — ${s.pageWidth}×${s.pageHeight} px · ${s.nStaves} staves · ` +
    `${p.strips.length} strips shown · deskew ${s.skewDeg ? `${s.skewDeg.toFixed(2)}°` : "none"} · ` +
    `sliced in ${(s.totalMs / 1000).toFixed(1)} s (angle check ${(s.skewMs / 1000).toFixed(1)} s)`;
  const pending = p.strips.filter((x) => x.tokens === undefined).length;
  const read = document.createElement("button");
  read.style.marginLeft = "10px";
  read.disabled = reading || pending === 0;
  read.textContent = pending
    ? `🔎 Read ${pending} strip${pending > 1 ? "s" : ""} with the model`
    : "✓ all strips read";
  read.title = "Decode these crops — about 1.2 s per strip, and the model loads on first use";
  read.addEventListener("click", () => void readPage(p));
  stats.appendChild(read);
  detailEl.appendChild(stats);

  for (const st of p.strips) {
    const box = document.createElement("div");
    box.className = `strip${actualSize ? "" : " fit"}`;

    const head = document.createElement("header");
    const id = document.createElement("span");
    id.className = "id";
    id.textContent = st.name;
    head.appendChild(id);
    const g = st.geom;
    const meta = document.createElement("span");
    // The slicer's own decisions, not a re-derivation: row/window index, the crop span it chose in
    // row coordinates, the padding either side (right is negative where the shared-edge trim bit),
    // and which measures of the row this crop covers.
    meta.textContent =
      `row ${g.system}, crop ${g.window} · ${st.canvas.width}×${st.canvas.height} px · ` +
      `x ${g.rowX0}–${g.rowX1} · pad ${g.pad[0]}/${g.pad[1]} · ` +
      `measures ${g.measFrom}–${g.measTo} of ${g.rowMeasures}` +
      (g.splitWide ? " · split-wide" : "") +
      (g.isRowStart ? " · row start" : "");
    head.appendChild(meta);

    // Vertical placement, so a crop that lost its beams says WHY rather than just looking wrong.
    // `music` is what the row actually reaches; `frame` is what the 7.2 sp budget gave it.
    const pl = p.sliced.placement.find((x) => x.system === g.system);
    if (pl) {
      const vp = document.createElement("span");
      const bad = pl.clippedBelow || pl.clippedAbove;
      vp.className = bad ? "vplace bad" : "vplace";
      vp.title =
        "The frame holds 7.2 line-spaces of non-staff height. 'music' is how far this row's ink " +
        "actually reaches; 'frame' is what it was given. music > frame on a side = that side is cut.";
      vp.textContent =
        `music ${pl.musicAbove.toFixed(1)}↑/${pl.musicBelow.toFixed(1)}↓ sp, ` +
        `frame ${pl.headSp.toFixed(2)}↑/${pl.belowSp.toFixed(2)}↓` +
        (pl.clippedBelow ? ` — ⚠ CUT AT THE BOTTOM by ${(pl.musicBelow - pl.belowSp).toFixed(1)} sp` : "") +
        (pl.clippedAbove ? ` — ⚠ cut at the top by ${(pl.musicAbove - pl.headSp).toFixed(1)} sp` : "");
      head.appendChild(vp);
    }

    const spacer = document.createElement("span");
    spacer.style.flex = "1";
    head.appendChild(spacer);

    const save = document.createElement("button");
    save.textContent = "⬇ save";
    save.title = "Download this crop as a PNG";
    save.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = st.canvas.toDataURL("image/png");
      a.download = st.name.endsWith(".png") ? st.name : `${st.name}.png`;
      a.click();
    });
    head.appendChild(save);

    const del = document.createElement("button");
    del.textContent = "✖ delete";
    del.title = "Remove this strip from the list (nothing else is affected)";
    del.addEventListener("click", () => removeStrip(p.id, st.name));
    head.appendChild(del);

    box.appendChild(head);
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.appendChild(st.canvas);
    box.appendChild(wrap);
    box.appendChild(labelEl(st));
    detailEl.appendChild(box);
  }

  if (!p.strips.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No strips left for this page.";
    detailEl.appendChild(empty);
  }
}

render();
