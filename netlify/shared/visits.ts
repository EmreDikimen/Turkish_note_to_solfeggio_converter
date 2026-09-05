/**
 * What a "visit" is, in one place — shared by the two Netlify Functions.
 *
 * The counter exists because docs/METRICS-USAGE.md had to answer "is anyone using it?" from Cloud
 * Run's raw request log, and that log cannot do the job: it counts robots as people, it cannot tell
 * two visits by one phone from one visit by two people, and every sharpening of its numbers came
 * from the owner supplying what the log could not. This replaces the guessing with a counter built
 * for the question — and it stays anonymous, because the owner ruled on 2026-09-05 that names are
 * not wanted (docs/features/visit-stats.md).
 *
 * ⚠ THE RAW IP IS NEVER WRITTEN DOWN. It is mixed with a secret (`STATS_SALT`) and TODAY'S DATE and
 * hashed; only the hash is stored. So the same phone is one row for one day, and tomorrow the same
 * phone hashes to something else — which is the point. Nobody, including the owner, can take a row
 * from last week and an IP from today and show they are the same person, and there is nothing in
 * the store to hand over if anyone ever asks for one.
 *
 * ⚠ NO SALT MEANS NO COUNTING. `visit.mts` refuses to record when `STATS_SALT` is unset rather than
 * falling back to something weaker: a fallback would keep the numbers flowing while quietly making
 * the identifier stable forever, which is the exact thing this design exists to prevent. The
 * dashboard says so out loud instead of letting the feature die silently.
 */

/** Where the rows live. One Netlify Blobs store, nothing else in it. */
export const STORE = "visits";

/**
 * How long a row is kept. Pruned lazily by `stats.mts`, so the store cannot grow forever and the
 * retention period is a number in the code rather than a promise nobody enforces.
 */
export const RETAIN_DAYS = 180;

/** The visits of ONE anonymous device on ONE day. This is the whole record; there is no other. */
export interface VisitorDay {
  /** `YYYY-MM-DD` in Europe/Istanbul — the owner's day, not UTC's. */
  date: string;
  /** App openings. Robots do this constantly; a human does it once per tab. */
  opens: number;
  /** Pages actually decoded. This is the only number that means a person read music. */
  reads: number;
  firstMs: number;
  lastMs: number;
  /** Two-letter country from Netlify's edge geo, or `??` when it does not know. */
  country: string;
  device: "phone" | "tablet" | "desktop" | "?";
  /** Family plus major version, e.g. `Chrome 151`. The version is load-bearing — see `readUA`. */
  browser: string;
  os: string;
  bot: boolean;
  /** Referrer HOSTS only (never a path, which can carry a search query). At most 5. */
  refs: string[];
}

/** What the browser sends. Everything else is derived here, from headers the browser cannot set. */
export interface VisitBody {
  kind: "open" | "read";
  ref?: string;
}

const KEY_PREFIX = "d/";

export function keyFor(date: string, id: string): string {
  return `${KEY_PREFIX}${date}/${id}`;
}

/** `d/2026-09-05/ab12…` → `2026-09-05`. Returns null for anything that is not one of our keys. */
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

/**
 * The per-day anonymous id: `sha256(salt + date + ip + user-agent)`, first 16 hex characters.
 *
 * The date is INSIDE the hash, which is what makes the id expire — see the file header. The
 * user-agent joins the IP because a household or a campus shares one address: without it, the owner
 * and his brother on the same wifi are one "device", which is exactly the confusion
 * docs/METRICS-USAGE.md had to untangle by hand.
 *
 * 16 hex characters (64 bits) is plenty: it separates a handful of visitors a day, and it is short
 * enough to read in the dashboard's table.
 */
export async function visitorId(salt: string, date: string, ip: string, ua: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt} ${date} ${ip} ${ua}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
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
export function readUA(ua: string): Pick<VisitorDay, "device" | "browser" | "os" | "bot"> {
  const bot = BOT_RE.test(ua);

  const device: VisitorDay["device"] = /iPad|Tablet|PlayBook|Silk/i.test(ua)
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

/** Fold one new visit into the row this device already has today (or start that row). */
export function foldVisit(
  prev: VisitorDay | null,
  now: number,
  date: string,
  kind: VisitBody["kind"],
  ua: Pick<VisitorDay, "device" | "browser" | "os" | "bot">,
  country: string,
  ref: string | null
): VisitorDay {
  const row: VisitorDay = prev ?? {
    date,
    opens: 0,
    reads: 0,
    firstMs: now,
    lastMs: now,
    country,
    ...ua,
    refs: [],
  };
  if (kind === "read") row.reads += 1;
  else row.opens += 1;
  row.lastMs = now;
  // A device that opened the app on mobile data and read a page on wifi keeps the country it
  // arrived with; the later value is not more true, and letting it flip would make the country
  // column depend on which request happened to be last.
  if (row.country === "??" && country !== "??") row.country = country;
  if (ref && !row.refs.includes(ref) && row.refs.length < 5) row.refs.push(ref);
  return row;
}
