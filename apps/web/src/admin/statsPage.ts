/**
 * The owner's dashboard for the visit counter. Draws `admin-stats.html`.
 *
 * ⚠ **Never published.** Vite builds `index.html` and nothing else, so this module is reachable only
 * from the dev server — the page's own comment carries the rule and what would break it. The data
 * behind it is locked separately, by the bearer token `netlify/functions/stats.mts` demands.
 *
 * All the arithmetic lives here rather than in the function, so a new question is a change to a
 * local file instead of a redeploy of the site. The endpoint hands over raw per-device-per-day rows;
 * everything below is folding them.
 *
 * ⚠ **What these numbers cannot say, and the page says so on screen.** A row is a DEVICE for a DAY,
 * not a person: one friend on a phone and a laptop is two rows, and a household behind one address
 * on two browsers is two rows as well. `reads` is the honest signal — a robot opens a page, it does
 * not upload sheet music. docs/features/visit-stats.md is the long version.
 */
import type { VisitorDay } from "../../../../netlify/shared/visits";

/** A row as the endpoint returns it: the stored record plus the per-day anonymous id from its key. */
type Row = VisitorDay & { id: string };

interface StatsReply {
  ok: true;
  generatedAt: number;
  days: number;
  retainDays: number;
  salted: boolean;
  pruned: number;
  rows: Row[];
}

const DEFAULT_SITE = "https://komavision.netlify.app";
const KEY_ENDPOINT = "omrStatsEndpoint";
const KEY_TOKEN = "omrStatsToken";

/**
 * Above this many days the chart buckets by week.
 *
 * A bar thinner than ~3 px is a line, and two of them side by side stop being comparable — which is
 * the one job this chart has. 45 daily pairs is about where that happens in a 1040 px column.
 */
const DAILY_MAX = 45;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`admin-stats.html has no #${id}`);
  return el as T;
};

const els = {
  endpoint: $<HTMLInputElement>("endpoint"),
  token: $<HTMLInputElement>("token"),
  days: $<HTMLSelectElement>("days"),
  load: $<HTMLButtonElement>("load"),
  bots: $<HTMLInputElement>("bots"),
  messages: $<HTMLDivElement>("messages"),
  report: $<HTMLDivElement>("report"),
  tiles: $<HTMLDivElement>("tiles"),
  chart: $<HTMLDivElement>("chart"),
  tip: $<HTMLDivElement>("tip"),
  breaks: $<HTMLDivElement>("breaks"),
  rows: $<HTMLTableElement>("rows"),
  rowsNote: $<HTMLParagraphElement>("rowsNote"),
  freshness: $<HTMLParagraphElement>("freshness"),
};

/** ⚠ Swallows everything — `localStorage` throws outright in some privacy modes (App.tsx's note). */
function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* the dashboard still works, it just forgets */
  }
}
function recall(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/* ── Fetching ────────────────────────────────────────────────────────────────────────────────── */

let latest: StatsReply | null = null;

function message(kind: "err" | "warn", html: string): void {
  const box = document.createElement("div");
  box.className = `msg ${kind}`;
  box.innerHTML = html;
  els.messages.append(box);
}

async function load(): Promise<void> {
  const site = els.endpoint.value.trim().replace(/\/+$/, "") || DEFAULT_SITE;
  const token = els.token.value.trim();
  remember(KEY_ENDPOINT, site);
  remember(KEY_TOKEN, token);

  els.messages.replaceChildren();
  els.load.disabled = true;
  els.load.textContent = "…";

  try {
    if (!token) throw new Error("Okuma anahtarı boş. Netlify'da ayarladığınız STATS_TOKEN gerekiyor.");
    const url = `${site}/.netlify/functions/stats?days=${encodeURIComponent(els.days.value)}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new Error("Anahtar kabul edilmedi (401). STATS_TOKEN'ı kontrol edin.");
    if (res.status === 503)
      throw new Error(
        "Sitede STATS_TOKEN ayarlı değil (503), bu yüzden veri verilmiyor. " +
          "<code>netlify env:set STATS_TOKEN &lt;anahtar&gt;</code> çalıştırıp yeniden dağıtın."
      );
    if (res.status === 404)
      throw new Error(
        "Adreste böyle bir fonksiyon yok (404). Site, <code>--functions</code> ile dağıtıldı mı? " +
          "<code>npm run deploy:app</code> bunu yapar."
      );
    if (!res.ok) throw new Error(`Sunucu ${res.status} döndü.`);
    latest = (await res.json()) as StatsReply;
    if (!latest.salted)
      message(
        "warn",
        "⚠ <b>Sayım kapalı:</b> sitede <code>STATS_SALT</code> ayarlı değil, bu yüzden hiçbir " +
          "ziyaret kaydedilmiyor. Aşağıdaki sayılar yalnızca eski kayıtlardır. " +
          "<code>netlify env:set STATS_SALT $(openssl rand -hex 32)</code> ile açılır."
      );
    render();
  } catch (err) {
    els.report.hidden = true;
    const text = err instanceof Error ? err.message : String(err);
    message(
      "err",
      `${text}<br /><span style="color: var(--ink-faint)">Tarayıcı konsolunda ağ hatası varsa, ` +
        `sunucunun bu adrese izin verip vermediğine bakın (netlify/functions/stats.mts, DEV_ORIGINS).</span>`
    );
  } finally {
    els.load.disabled = false;
    els.load.textContent = "Getir";
  }
}

/* ── Folding ─────────────────────────────────────────────────────────────────────────────────── */

interface Bucket {
  key: string;
  label: string;
  opens: number;
  reads: number;
}

const dayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * Every day in the window, in order, whether or not anybody came.
 *
 * The empty days are the point: a chart drawn only from the days that have rows silently closes the
 * gaps, and "three visits, all on one afternoon" then looks exactly like "three visits over a
 * fortnight". Those are different answers to the owner's question.
 */
function dayRange(days: number): string[] {
  const today = Date.parse(`${dayKey(Date.now())}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => dayKey(today - (days - 1 - i) * 86_400_000));
}

function bucketise(rows: Row[], days: number): Bucket[] {
  const all = dayRange(days);
  const perDay = new Map<string, { opens: number; reads: number }>();
  for (const date of all) perDay.set(date, { opens: 0, reads: 0 });
  for (const row of rows) {
    const slot = perDay.get(row.date);
    if (!slot) continue; // a row from outside the window; the endpoint already filtered, so rare
    slot.opens += row.opens;
    slot.reads += row.reads;
  }

  if (all.length <= DAILY_MAX) {
    return all.map((date) => ({
      key: date,
      label: date.slice(5).replace("-", "."),
      ...(perDay.get(date) ?? { opens: 0, reads: 0 }),
    }));
  }

  const weeks: Bucket[] = [];
  for (let i = 0; i < all.length; i += 7) {
    const chunk = all.slice(i, i + 7);
    const first = chunk[0] ?? "";
    const bucket: Bucket = { key: first, label: first.slice(5).replace("-", "."), opens: 0, reads: 0 };
    for (const date of chunk) {
      const slot = perDay.get(date);
      if (slot) {
        bucket.opens += slot.opens;
        bucket.reads += slot.reads;
      }
    }
    weeks.push(bucket);
  }
  return weeks;
}

function tally(rows: Row[], of: (row: Row) => string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const value of of(row)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/* ── Drawing ─────────────────────────────────────────────────────────────────────────────────── */

const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = <K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

const PAD = { top: 14, right: 8, bottom: 26, left: 34 };
const CHART_H = 220;
/** The 2 px surface gap the mark spec asks for between adjacent fills. */
const BAR_GAP = 2;

function drawChart(buckets: Bucket[]): void {
  const width = Math.max(els.chart.clientWidth, 320);
  const plotW = width - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.opens, b.reads)));

  const svg = svgEl("svg", {
    width,
    height: CHART_H,
    viewBox: `0 0 ${width} ${CHART_H}`,
    role: "img",
    "aria-label": "Günlük açılış ve okunan sayfa sayısı",
  });

  // A recessive grid: four lines, ink only where a number sits beside them.
  const ticks = niceTicks(max);
  for (const value of ticks) {
    const y = PAD.top + plotH - (value / ticks[ticks.length - 1]!) * plotH;
    svg.append(
      svgEl("line", { x1: PAD.left, x2: width - PAD.right, y1: y, y2: y, stroke: "var(--grid)", "stroke-width": 1 })
    );
    const label = svgEl("text", {
      x: PAD.left - 7,
      y: y + 3.5,
      "text-anchor": "end",
      "font-size": 10,
      fill: "var(--ink-faint)",
    });
    label.textContent = String(value);
    svg.append(label);
  }

  const slot = plotW / buckets.length;
  const barW = Math.max(1.5, (slot - BAR_GAP * 2) / 2);
  const scale = (n: number) => (n / (ticks[ticks.length - 1] ?? 1)) * plotH;
  // A bar is only rounded where the data ends; the baseline end stays square, so the mark reads as
  // anchored to zero rather than floating.
  const radius = Math.min(4, barW / 2);

  const peak = { opens: 0, reads: 0 };
  for (const b of buckets) {
    peak.opens = Math.max(peak.opens, b.opens);
    peak.reads = Math.max(peak.reads, b.reads);
  }
  const labelled = { opens: false, reads: false };

  buckets.forEach((bucket, i) => {
    const x0 = PAD.left + i * slot + BAR_GAP / 2;
    const series = [
      { key: "opens" as const, value: bucket.opens, fill: "var(--series-open)", x: x0 },
      { key: "reads" as const, value: bucket.reads, fill: "var(--series-read)", x: x0 + barW + BAR_GAP },
    ];
    for (const s of series) {
      if (s.value <= 0) continue;
      const h = Math.max(2, scale(s.value));
      const y = PAD.top + plotH - h;
      svg.append(
        svgEl("path", { d: barPath(s.x, y, barW, h, radius), fill: s.fill })
      );
      // Selective direct labels: the peak of each series, once. A number on every bar is the
      // anti-pattern; a number on the tallest one is what stops the reader hunting for the axis.
      if (!labelled[s.key] && s.value === peak[s.key] && barW >= 8) {
        labelled[s.key] = true;
        const tag = svgEl("text", {
          x: s.x + barW / 2,
          y: y - 4,
          "text-anchor": "middle",
          "font-size": 10,
          fill: "var(--ink-soft)",
        });
        tag.textContent = String(s.value);
        svg.append(tag);
      }
    }

    // One hover target per bucket, full height: the hit area is bigger than the marks, so a day
    // with one visit is as easy to inspect as a day with twenty.
    const hit = svgEl("rect", {
      x: PAD.left + i * slot,
      y: PAD.top,
      width: slot,
      height: plotH,
      fill: "transparent",
    });
    hit.addEventListener("pointerenter", () => showTip(bucket, PAD.left + i * slot + slot / 2, PAD.top));
    hit.addEventListener("pointerleave", () => {
      els.tip.style.opacity = "0";
    });
    svg.append(hit);
  });

  // At most eight date labels, whatever the range: more than that and they collide or turn sideways.
  const every = Math.max(1, Math.ceil(buckets.length / 8));
  buckets.forEach((bucket, i) => {
    if (i % every !== 0) return;
    const text = svgEl("text", {
      x: PAD.left + i * slot + slot / 2,
      y: CHART_H - 9,
      "text-anchor": "middle",
      "font-size": 10,
      fill: "var(--ink-faint)",
    });
    text.textContent = bucket.label;
    svg.append(text);
  });

  svg.append(
    svgEl("line", {
      x1: PAD.left,
      x2: width - PAD.right,
      y1: PAD.top + plotH,
      y2: PAD.top + plotH,
      stroke: "var(--rule-strong)",
      "stroke-width": 1,
    })
  );

  els.chart.replaceChildren(els.tip, svg);
}

/** A bar rounded at the data end only. */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

/** Axis stops that are round numbers, so the grid can be read without arithmetic. */
function niceTicks(max: number): number[] {
  const step = Math.max(1, Math.ceil(max / 4));
  const rounded = step <= 2 ? step : step <= 5 ? 5 : Math.ceil(step / 10) * 10;
  const out: number[] = [];
  for (let v = rounded; v < max + rounded; v += rounded) out.push(v);
  return out.length ? out : [1];
}

function showTip(bucket: Bucket, x: number, top: number): void {
  els.tip.innerHTML =
    `<b>${bucket.label}</b><br />${bucket.opens} açılış · ${bucket.reads} okunan sayfa`;
  els.tip.style.left = `${x}px`;
  els.tip.style.top = `${top - 6}px`;
  els.tip.style.opacity = "1";
}

function tile(n: string, caption: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "tile";
  const value = document.createElement("div");
  value.className = "n";
  value.textContent = n;
  const cap = document.createElement("div");
  cap.className = "k";
  cap.innerHTML = caption;
  box.append(value, cap);
  return box;
}

function breakdown(title: string, entries: Array<[string, number]>, empty: string): HTMLElement {
  const box = document.createElement("div");
  const head = document.createElement("h2");
  head.textContent = title;
  box.append(head);
  if (!entries.length) {
    const none = document.createElement("p");
    none.className = "note";
    none.textContent = empty;
    box.append(none);
    return box;
  }
  const max = entries[0]?.[1] ?? 1;
  for (const [label, n] of entries.slice(0, 8)) {
    const row = document.createElement("div");
    row.className = "brow";
    const name = document.createElement("span");
    name.className = "label";
    name.textContent = label;
    name.title = label;
    const count = document.createElement("span");
    count.className = "n";
    count.textContent = String(n);
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = `${Math.round((n / max) * 100)}%`;
    bar.append(fill);
    row.append(name, count, bar);
    box.append(row);
  }
  return box;
}

function render(): void {
  if (!latest) return;
  const withBots = els.bots.checked;
  const rows = withBots ? latest.rows : latest.rows.filter((r) => !r.bot);
  const botRows = latest.rows.filter((r) => r.bot);

  const opens = rows.reduce((a, r) => a + r.opens, 0);
  const reads = rows.reduce((a, r) => a + r.reads, 0);
  const devices = new Set(rows.map((r) => r.id)).size;
  const readers = new Set(rows.filter((r) => r.reads > 0).map((r) => r.id)).size;
  const activeDays = new Set(rows.map((r) => r.date)).size;

  els.tiles.replaceChildren(
    tile(String(opens), `uygulama açılışı · <b>${activeDays}</b> ayrı günde`),
    tile(String(devices), `farklı cihaz-gün · aynı cihaz her gün 1 kez sayılır`),
    tile(String(reads), `okunan nota sayfası · <b>gerçek kullanım budur</b>`),
    tile(String(readers), `sayfa okuyan cihaz · sadece bakıp geçmeyenler`),
    tile(String(botRows.length), `robot ziyareti · ${withBots ? "sayıma dahil" : "sayımın dışında"}`)
  );

  // ⚠ Unhide BEFORE drawing. The chart is laid out at its container's MEASURED width, and a hidden
  // element measures 0 — which silently produced a chart drawn at the 320 px floor and then scaled
  // to fit, so it sat as a small block in the middle of a wide card with its direct labels
  // suppressed. Nothing threw; it just looked wrong.
  els.report.hidden = false;

  drawChart(bucketise(rows, latest.days));

  els.breaks.replaceChildren(
    breakdown("Ülke", tally(rows, (r) => [r.country === "??" ? "bilinmiyor" : r.country]), "Kayıt yok."),
    breakdown("Cihaz", tally(rows, (r) => [`${r.device} · ${r.os}`]), "Kayıt yok."),
    breakdown("Tarayıcı", tally(rows, (r) => [r.browser]), "Kayıt yok."),
    breakdown(
      "Geldiği site",
      tally(rows, (r) => r.refs),
      "Hiçbiri bir bağlantıdan gelmemiş — adresi doğrudan yazmışlar."
    )
  );

  drawTable(rows);

  const when = new Date(latest.generatedAt).toLocaleString("tr-TR");
  els.freshness.textContent =
    `${when} itibarıyla · kayıtlar ${latest.retainDays} gün saklanır` +
    (latest.pruned ? ` · bu okumada ${latest.pruned} eski kayıt silindi` : "");
}

function drawTable(rows: Row[]): void {
  const head = document.createElement("tr");
  for (const [label, cls] of [
    ["Gün", ""],
    ["Cihaz", "id"],
    ["Açılış", "num"],
    ["Okuma", "num"],
    ["Ülke", ""],
    ["Tip", ""],
    ["Tarayıcı", ""],
    ["İlk", ""],
    ["Son", ""],
    ["Geldiği yer", ""],
  ] as const) {
    const th = document.createElement("th");
    th.textContent = label;
    if (cls === "num") th.style.textAlign = "right";
    head.append(th);
  }

  const body = document.createElement("tbody");
  const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });

  for (const row of rows.slice(0, 200)) {
    const tr = document.createElement("tr");
    if (row.bot) tr.className = "bot";
    const cells: Array<[string, string]> = [
      [row.date, ""],
      [row.id.slice(0, 8), "id"],
      [String(row.opens), "num"],
      [String(row.reads), "num"],
      [row.country === "??" ? "—" : row.country, ""],
      [row.bot ? `${row.device} (robot)` : row.device, ""],
      [row.browser, ""],
      [clock(row.firstMs), ""],
      [clock(row.lastMs), ""],
      [row.refs.join(", ") || "—", ""],
    ];
    for (const [text, cls] of cells) {
      const td = document.createElement("td");
      td.className = cls;
      td.textContent = text;
      tr.append(td);
    }
    body.append(tr);
  }

  els.rows.replaceChildren(head, body);
  els.rowsNote.textContent = rows.length
    ? `${rows.length} kayıt${rows.length > 200 ? " (ilk 200 gösteriliyor)" : ""} · ` +
      "saatler Istanbul saatidir · cihaz numarası sadece o gün için geçerlidir"
    : "Bu aralıkta hiç ziyaret yok.";
}

/* ── Wiring ──────────────────────────────────────────────────────────────────────────────────── */

els.endpoint.value = recall(KEY_ENDPOINT, DEFAULT_SITE);
els.token.value = recall(KEY_TOKEN, "");
els.load.addEventListener("click", () => void load());
els.bots.addEventListener("change", render);
els.days.addEventListener("change", () => void load());
for (const input of [els.endpoint, els.token]) {
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") void load();
  });
}

// The chart is drawn at the container's measured width, so it has to be redrawn when that changes.
let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (latest) render();
  }, 150);
});

if (els.token.value) void load();
