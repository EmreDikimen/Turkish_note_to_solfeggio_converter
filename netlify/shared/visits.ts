/**
 * What a "visit" is, in one place — shared by the two Netlify Functions.
 *
 * The counter exists because docs/METRICS-USAGE.md had to answer "is anyone using it?" from Cloud
 * Run's raw request log, and that log cannot do the job: it counts robots as people and every
 * sharpening of its numbers came from the owner supplying what the log could not. This replaces the
 * guessing with a counter built for the question — and it stays anonymous, because the owner ruled
 * on 2026-09-05 that names are not wanted (docs/features/visit-stats.md).
 *
 * ⭐ **SINCE 2026-10-14 THERE IS NO IDENTIFIER AND NO LOCATION AT ALL** (owner: *"konum ve cihaz
 * kimliğinin tutulmasına çok gerek yok"*). The store used to hold one row per DEVICE per day, keyed by
 * a salted daily hash of the IP, with the visitor's country beside it. Now a row is a BUCKET: every
 * visit that arrived on one day from one kind of browser (device type · OS · browser · robot or not),
 * summed. Nothing in a bucket points at a person, and nothing from the request's address or location
 * is read at all — which is what lets the Play Store's Data safety form declare app interactions
 * only. The price, accepted: "how many different people" can no longer be answered, only "how many
 * openings and reads". ⚠ Old `d/` rows (hash + country) are deleted by `stats.mts` on its next read.
 *
 * ⚠ `STATS_SALT` IS NOW ONLY AN ON-SWITCH. Its value is never used; its PRESENCE is what lets
 * `visit.mts` record, so turning the counter off is still the one command it always was.
 */

/** Where the rows live. One Netlify Blobs store, nothing else in it. */
export const STORE = "visits";

/**
 * How long a row is kept. Pruned lazily by `stats.mts`, so the store cannot grow forever and the
 * retention period is a number in the code rather than a promise nobody enforces.
 */
export const RETAIN_DAYS = 180;

/** Every visit on ONE day from ONE kind of browser, summed. This is the whole record; there is no other. */
export interface VisitBucket {
  /** `YYYY-MM-DD` in Europe/Istanbul — the owner's day, not UTC's. */
  date: string;
  /** App openings. Robots do this constantly; a human does it once per tab. */
  opens: number;
  /** Pages actually decoded. This is the only number that means a person read music. */
  reads: number;
  device: "phone" | "tablet" | "desktop" | "?";
  /** Family plus major version, e.g. `Chrome 151`. */
  browser: string;
  os: string;
  bot: boolean;
  /** Referrer HOST → how many visits came from it (never a path, which can carry a query). At most 10. */
  refs: Record<string, number>;
}

/** What the browser sends. Everything else is derived here, from headers the browser cannot set. */
export interface VisitBody {
  kind: "open" | "read";
  ref?: string;
}

export const KEY_PREFIX = "b/";
/** The pre-2026-10-14 per-device rows (hashed id + country). Never written now; swept on read. */
export const LEGACY_PREFIX = "d/";

/** The coarse user-agent facts a bucket is made of — never more than these four. */
export type UAFacts = Pick<VisitBucket, "device" | "browser" | "os" | "bot">;

/** One bucket per day per kind of browser: `b/2026-10-14/phone%7CAndroid%7CChrome%20151%7C0`. */
export function bucketKey(date: string, ua: UAFacts): string {
  return `${KEY_PREFIX}${date}/${encodeURIComponent(`${ua.device}|${ua.os}|${ua.browser}|${ua.bot ? 1 : 0}`)}`;
}

/** `b/2026-09-05/…` → `2026-09-05`. Returns null for anything that is not one of our keys. */
export function dateOfKey(key: string): string | null {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const date = key.slice(KEY_PREFIX.length, KEY_PREFIX.length + 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/**
 * The day in Istanbul, as `YYYY-MM-DD`.
 *
 * `en-CA` is the shortest way to get ISO order out of `Intl` without assembling the parts by hand.
 * The timezone matters at the edges of the day: a visit at 01:00 Istanbul time is yesterday in UTC,
 * and the owner reading "dün 3 ziyaret" means his own yesterday.
 */
export function istanbulDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** `2026-09-05` → epoch ms at midnight UTC. Only ever used to compare two dates, so UTC is fine. */
export function dayMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Anything that announces itself as automated. Deliberately generous — see `readUA`. */
const BOT_RE =
  /bot|crawl|spider|slurp|headless|preview|monitor|scrape|fetcher|curl|wget|python-requests|facebookexternalhit|lighthouse|pagespeed|uptime|semrush|ahrefs|bingpreview/i;

/** family plus version, in the order they must be tried: the impostors first. */
const BROWSERS: ReadonlyArray<readonly [string, RegExp]> = [
  // Edge and Opera both put "Chrome/…" in their UA as well, so they have to be recognised BEFORE
  // Chrome or every one of them reads as Chrome. Same for Samsung Internet on Android phones,
  // which is common in Turkey and would otherwise disappear into the Chrome column.
  ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /OPR\/(\d+)/],
  ["Samsung Internet", /SamsungBrowser\/(\d+)/],
  ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
  // Safari's own version lives in `Version/…`; the `Safari/…` token is a build number every
  // WebKit browser copies, so it is useless as a version and only good as a last-resort family.
  ["Safari", /Version\/(\d+)[^)]*Safari/],
];

/**
 * Read a user-agent string into the four coarse facts worth keeping.
 *
 * ⚠ **The browser VERSION is not decoration — it is the only evidence this data holds that two
 * visits came from two machines.** docs/METRICS-USAGE.md established "at least one real stranger"
 * exactly this way: the owner's phone was on Chrome/150 while an upload came from Chrome/151, and
 * browsers never downgrade. Android's UA is frozen to `Android 10; K`, so nothing else in the
 * string discriminates. Keep the number.
 *
 * ⚠ **An `X11; Linux x86_64` UA does NOT mean a Linux machine.** It is what Chrome for Android
 * sends under "Request desktop site", and mistaking it already cost one wrong entry in
 * METRICS-USAGE.md. So `device` reads DESKTOP for such a visit and it may well be a phone; the
 * dashboard labels the column "tarayıcının söylediği" rather than pretending otherwise.
 *
 * ⚠ **Bot detection is one-way.** Everything it catches really is automated; plenty of automation
 * says nothing at all and lands in the human column. That is why the dashboard leads with `reads`
 * (a decoded page) and not with openings — a robot loads the page, it does not upload sheet music.
 */
export function readUA(ua: string): UAFacts {
  const bot = BOT_RE.test(ua);

  const device: VisitBucket["device"] = /iPad|Tablet|PlayBook|Silk/i.test(ua)
    ? "tablet"
    : /Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)
      ? "phone"
      : ua
        ? "desktop"
        : "?";

  let browser = "?";
  for (const [family, re] of BROWSERS) {
    const m = re.exec(ua);
    if (m) {
      browser = `${family} ${m[1]}`;
      break;
    }
  }

  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Mac OS X/i.test(ua)
        ? "macOS"
        : /Windows NT/i.test(ua)
          ? "Windows"
          : /Linux|X11/i.test(ua)
            ? "Linux"
            : "?";

  return { device, browser, os, bot };
}

/**
 * The referrer reduced to a bare host — `https://x.com/a/b?q=secret` becomes `x.com`.
 *
 * The path is thrown away on purpose: it is the part that carries search terms and private URLs,
 * and "where did they come from" is answered by the host alone.
 */
export function refHost(ref: string | undefined): string | null {
  if (!ref) return null;
  try {
    const { hostname } = new URL(ref);
    return hostname ? hostname.replace(/^www\./, "").slice(0, 80) : null;
  } catch {
    return null;
  }
}

/** Fold one new visit into its day's bucket (or start that bucket). */
export function foldVisit(
  prev: VisitBucket | null,
  date: string,
  kind: VisitBody["kind"],
  ua: UAFacts,
  ref: string | null
): VisitBucket {
  const row: VisitBucket = prev ?? { date, opens: 0, reads: 0, ...ua, refs: {} };
  if (kind === "read") row.reads += 1;
  else row.opens += 1;
  if (ref && (ref in row.refs || Object.keys(row.refs).length < 10)) row.refs[ref] = (row.refs[ref] ?? 0) + 1;
  return row;
}
