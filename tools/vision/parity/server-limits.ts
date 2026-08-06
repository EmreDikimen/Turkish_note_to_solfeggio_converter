/**
 * The safety checklist, as a command (MVP W9, build step 4).
 *
 * `docs/mvp/deploy.md` lists four things that must be true before the URL leaves the two friends.
 * Three of them are code and are checked here against a RUNNING server; the fourth — the hard
 * billing cap and the max-instances ceiling — lives in the Cloud Run config and cannot be asserted
 * from here, so it is printed as an owed item rather than quietly counted as passing.
 *
 *   npm run check:limits                       # against localhost:8080
 *   npm run check:limits -- --url https://…    # against the deployed service
 *
 * The rate-limit case needs its own throwaway server (a low `RATE_REQUESTS`), so it is opt-in:
 *
 *   RATE_REQUESTS=3 MODEL_DIR=/nonexistent PORT=8081 npx tsx apps/server/src/index.ts &
 *   npm run check:limits -- --rate-url http://localhost:8081 --rate-max 3
 */
import { PNG } from "pngjs";

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

function pngOf(width: number, height: number): string {
  const png = new PNG({ width, height });
  png.data.fill(0);
  return PNG.sync.write(png).toString("base64");
}

async function post(url: string, body: string): Promise<{ status: number; text: string }> {
  const res = await fetch(`${url}/decode`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  return { status: res.status, text: (await res.text()).slice(0, 160) };
}

interface Case {
  name: string;
  want: number;
  run: () => Promise<{ status: number; text: string }>;
}

async function main() {
  const url = arg("--url", "http://localhost:8080").replace(/\/$/, "");
  const rateUrl = arg("--rate-url");
  const rateMax = Number(arg("--rate-max", "3"));

  const health = (await (await fetch(`${url}/health`)).json()) as {
    ready: boolean;
    limits: { maxBodyBytes: number; maxStrips: number; rateRequests: number; rateWindowMs: number };
  };
  if (!health.ready) {
    console.error(`server at ${url} is not ready`);
    process.exit(2);
  }
  const { maxStrips, maxBodyBytes } = health.limits;
  console.log(
    `limits check — ${url}\n` +
      `  server reports: ${maxStrips} strips max, ${(maxBodyBytes / 1024 / 1024).toFixed(0)} MB body max, ` +
      `${health.limits.rateRequests} requests / ${health.limits.rateWindowMs / 1000} s per IP\n`
  );

  const good = pngOf(409, 583);
  const cases: Case[] = [
    {
      name: "a non-image payload is refused",
      want: 400,
      run: () =>
        post(url, JSON.stringify({ strips: [{ system: 0, window: 0, png: Buffer.from("<html>not an image</html>").toString("base64") }] })),
    },
    {
      name: "a PNG that is not the preprocessed size is refused",
      want: 400,
      run: () => post(url, JSON.stringify({ strips: [{ system: 0, window: 0, png: pngOf(64, 64) }] })),
    },
    {
      name: "a body that is not JSON is refused",
      want: 400,
      run: () => post(url, "this is not json"),
    },
    {
      name: "an empty strip list is refused",
      want: 400,
      run: () => post(url, JSON.stringify({ strips: [] })),
    },
    {
      name: `more than ${maxStrips} strips is refused`,
      want: 400,
      run: () =>
        post(
          url,
          JSON.stringify({
            // Tiny PNGs: this case is about the COUNT, and the count is checked before any pixels
            // are looked at — which is the property worth having.
            strips: Array.from({ length: maxStrips + 1 }, (_, i) => ({
              system: 0,
              window: i,
              png: pngOf(8, 8),
            })),
          })
        ),
    },
    {
      name: "a body over the size cap is refused",
      want: 413,
      run: () => {
        // One strip, padded past the cap with a long name — the cap must be about BYTES SEEN, not
        // about how plausible the JSON looks.
        const filler = "x".repeat(maxBodyBytes + 1024);
        return post(url, JSON.stringify({ strips: [{ system: 0, window: 0, name: filler, png: good }] }));
      },
    },
  ];

  let pass = 0;
  for (const c of cases) {
    let got: { status: number; text: string };
    try {
      got = await c.run();
    } catch (err) {
      // A destroyed socket is an acceptable way to refuse an oversized body: the point is that the
      // process never buffers it.
      got = { status: c.want === 413 ? 413 : 0, text: `connection: ${String(err)}` };
    }
    const ok = got.status === c.want;
    if (ok) pass++;
    console.log(`  ${ok ? "✓" : "✗"} ${c.name.padEnd(52)} want ${c.want}, got ${got.status}`);
    if (!ok) console.log(`      ${got.text}`);
  }

  let rateOk: boolean | null = null;
  if (rateUrl) {
    const body = JSON.stringify({ strips: [{ system: 0, window: 0, png: pngOf(8, 8) }] });
    const seen: number[] = [];
    for (let i = 0; i < rateMax + 2; i++) seen.push((await post(rateUrl.replace(/\/$/, ""), body)).status);
    rateOk = seen.slice(rateMax).every((s) => s === 429);
    console.log(
      `  ${rateOk ? "✓" : "✗"} ${`per-IP rate limit at ${rateMax} requests`.padEnd(52)} statuses ${seen.join(",")}`
    );
  } else {
    console.log(`  – per-IP rate limit                                  not checked (see --rate-url)`);
  }

  console.log(
    `\n  OWED, and not checkable from here: the Cloud Run hard billing cap, the billing alert and\n` +
      `  --max-instances. They are the only limits that bound the bill when this process is the\n` +
      `  thing being abused. deploy.md carries them as checkboxes.`
  );

  const ok = pass === cases.length && rateOk !== false;
  console.log(`\n== ${ok ? "PASS" : "FAIL"} — ${pass}/${cases.length} payload cases`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
