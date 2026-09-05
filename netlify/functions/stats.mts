/**
 * Hand the owner his rows. The whole read side of the counter, and the only door to the data.
 *
 * `GET /.netlify/functions/stats?days=30` with `Authorization: Bearer <STATS_TOKEN>`. It returns the
 * raw per-device-per-day rows and does no arithmetic: the dashboard slices them (totals, unique
 * devices, countries, robots), and keeping the aggregation on the reading side means a new question
 * is a change to a local page rather than a redeploy of the site.
 *
 * ⚠ **No token configured means no data, not open data.** An unset `STATS_TOKEN` answers 503. The
 * failure mode of the other choice — a stats endpoint that serves everyone while the owner believes
 * it is private — is the one that must not be reachable by forgetting to set a variable.
 *
 * ⚠ **This endpoint is why the dashboard can live outside the site.** The page that draws these
 * numbers is `apps/web/admin-stats.html`, which vite never builds into `dist/` (only `index.html` is
 * an entry), so it is served by the dev server and nowhere else. Visitors cannot reach a page that
 * was never published, and this door needs the token wherever it is knocked on — which is what lets
 * the CORS allowlist below open for `localhost` without opening the data.
 */
import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";
import { dateOfKey, dayMs, RETAIN_DAYS, STORE, type VisitorDay } from "../shared/visits";

/**
 * Where the dashboard is allowed to be read from.
 *
 * Only the dev server's own origins, plus whatever `STATS_ORIGIN` names if the owner ever wants the
 * page somewhere else. The deployed site is deliberately NOT on this list: nothing published from
 * `dist/` ever asks for these numbers, so an origin entry for it would be a door with nothing
 * behind it.
 */
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

/** How many blobs to fetch at once. Small — a day is a handful of rows, and this is not a hot path. */
const FETCH_BATCH = 24;

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const extra = process.env.STATS_ORIGIN;
  return DEV_ORIGINS.includes(origin) || (extra && origin === extra) ? origin : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = allowedOrigin(origin);
  return {
    ...(allow ? { "access-control-allow-origin": allow } : {}),
    vary: "Origin",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
  };
}

/**
 * Compare without leaking the answer through how long it took.
 *
 * The token is a long random string, so a timing attack over the public internet is not a realistic
 * way in; this costs two lines and removes the question.
 */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() ?? "";
}

/** Run `work` over `items` a batch at a time, so a long history does not open hundreds of sockets. */
async function inBatches<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  }
  return out;
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "GET only" });

  const token = process.env.STATS_TOKEN;
  if (!token)
    return json(503, {
      error: "STATS_TOKEN is not set on the site, so there is no way to authorise a read",
    });
  if (!sameSecret(bearer(req), token)) return json(401, { error: "bad token" });

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30) || 30, 1), RETAIN_DAYS);

  const store = getStore(STORE);
  const { blobs } = await store.list({ prefix: "d/" });

  const todayMs = dayMs(new Date().toISOString().slice(0, 10));
  const windowFrom = todayMs - (days - 1) * 86_400_000;
  const retainFrom = todayMs - RETAIN_DAYS * 86_400_000;

  const wanted: string[] = [];
  const expired: string[] = [];
  for (const blob of blobs) {
    const date = dateOfKey(blob.key);
    if (!date) continue;
    const ms = dayMs(date);
    if (ms < retainFrom) expired.push(blob.key);
    else if (ms >= windowFrom) wanted.push(blob.key);
  }

  const rows = (
    await inBatches(wanted, FETCH_BATCH, async (key) => {
      const row = (await store.get(key, { type: "json" })) as VisitorDay | null;
      // The id is the last path segment; it is already anonymous and already per-day, and the
      // dashboard needs it to count DEVICES rather than visits.
      return row ? { ...row, id: key.slice(key.lastIndexOf("/") + 1) } : null;
    })
  ).filter((row): row is VisitorDay & { id: string } => row !== null);

  rows.sort((a, b) => b.lastMs - a.lastMs);

  // Retention, enforced rather than promised (netlify/shared/visits.ts). Doing it on a read is what
  // keeps it free: the owner opens the dashboard far more often than the store needs sweeping, and
  // there is no scheduled function to keep alive.
  if (expired.length) await inBatches(expired, FETCH_BATCH, (key) => store.delete(key));

  return json(200, {
    ok: true,
    generatedAt: Date.now(),
    days,
    retainDays: RETAIN_DAYS,
    // The dashboard shows a loud warning on `false`: rows stop arriving the moment the salt goes
    // missing, and an empty chart otherwise looks like "nobody came".
    salted: Boolean(process.env.STATS_SALT),
    pruned: expired.length,
    rows,
  });
};
