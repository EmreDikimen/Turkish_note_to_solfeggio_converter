/**
 * The safety limits, in one file so the checklist in docs/mvp/deploy.md can be read against code.
 *
 * An open inference endpoint with usage billing is the standard way to get a surprise bill — one
 * script, or one bad crawler. Everything here is cheap and none of it is clever; the expensive
 * protections (a hard billing cap, a max-instances ceiling) live in the Cloud Run config, because
 * they are the only ones that hold when this process is the thing being abused.
 */

export interface Limits {
  maxBodyBytes: number;
  maxStrips: number;
  maxPixelBytes: number;
  rateRequests: number;
  rateWindowMs: number;
}

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/**
 * Defaults sized against a real page: ~16–21 strips, each a 409×583 PNG of a few tens of KB, so a
 * page arrives as roughly 1–2 MB of base64. 12 MB leaves an honest margin without letting anyone
 * post a film.
 */
export function limits(): Limits {
  return {
    maxBodyBytes: num("MAX_BODY_BYTES", 12 * 1024 * 1024),
    maxStrips: num("MAX_STRIPS", 40),
    maxPixelBytes: num("MAX_PIXEL_BYTES", 4 * 1024 * 1024),
    rateRequests: num("RATE_REQUESTS", 20),
    rateWindowMs: num("RATE_WINDOW_S", 60) * 1000,
  };
}

/**
 * Fixed-window request counter, per client IP.
 *
 * In-process on purpose: with `--max-instances` small and container concurrency 1, per-instance
 * counting is close enough to per-service, and a shared store (Redis, Firestore) would be a
 * dependency, a cost and an outage source for a two-friend release. It is a speed bump against
 * scripts, not an authorization system — the billing cap is what actually bounds the damage.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  /** Returns null when allowed, or the seconds until the window resets when not. */
  check(key: string, now = Date.now()): number | null {
    const cur = this.hits.get(key);
    if (!cur || now >= cur.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.sweep(now);
      return null;
    }
    if (cur.count >= this.max) return Math.ceil((cur.resetAt - now) / 1000);
    cur.count += 1;
    return null;
  }

  /** Drop expired entries so a crawler cycling IPs cannot grow the map without bound. */
  private sweep(now: number): void {
    for (const [k, v] of this.hits) if (now >= v.resetAt) this.hits.delete(k);
  }
}

/**
 * Client IP as Cloud Run reports it: the LEFTMOST `X-Forwarded-For` entry.
 *
 * Google's load balancer appends the caller's address and its own, so the left entry is the client
 * and the right ones are infrastructure. It is caller-supplied and therefore spoofable — which is
 * why the rate limit is a speed bump and the billing cap is the real limit.
 */
export function clientIp(xff: string | string[] | undefined, socket: string | undefined): string {
  const raw = Array.isArray(xff) ? xff[0] : xff;
  const first = raw?.split(",")[0]?.trim();
  return first || socket || "unknown";
}
