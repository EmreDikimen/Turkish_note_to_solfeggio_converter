/**
 * A LOCAL-ONLY proxy that re-spaces scheme H's decode on the way back to the app.
 *
 * WHY IT EXISTS (owner, 2026-09-28: *"sadece localhost'a özel çözüm"*). Scheme H's decoder glues
 * units together — `b''32a''32g''16c'''4` as one run — because a fused pitch token carries no
 * trailing space. `stitch.ts`'s `normalizeTokens` splits only the backslash commands and `|`, so an
 * H page arrives at the stitcher as a handful of unparseable lumps: measured on `meltem1`, 229 notes
 * became **15**, and the page collapsed to 14 near-empty measures.
 *
 * ⛔ **THAT IS THE STITCHER'S GAP, NOT THE MODEL'S READING.** Run the same H decode through
 * `data.canonical_label` first and it stitches to 229 notes / 23 measures — level with the other two
 * arms. So a trial of H without this step would measure the gap and blame the model.
 *
 * ⛔ **NOTHING HERE SHIPS AND NO SHIPPING FILE IS TOUCHED.** `tools/` is dev-only. The real fix, if
 * H is ever adopted, is one splitter inside `normalizeTokens` — deliberately NOT done here, because
 * that is shipping code and the owner asked for a localhost-only answer.
 *
 * ⚠ **THE RULE IS A MIRROR OF `src/vision/data.canonical_label`** — the same function
 * `paired_arm_score.py --score-vocab old` uses, so what the app receives here is what the A/B
 * scored. If that function changes, this must change with it. It is a mirror and not an import
 * because it sits on the Node side of the project; the three regexes below are the whole rule.
 *
 * ⚠ It is a PURE TEXT rewrite of `strips[].tokens`. `ids`, `logprobs`, `hitCap` and the timings are
 * passed through untouched — they are the model's own output, and re-spacing must not be able to
 * launder them.
 *
 * Run (three terminals, or see docs/COMMANDS-PYTHON.md):
 *   MODEL_DIR=apps/server/models-h PORT=8081 npm run dev:server
 *   npx tsx tools/vision/h-respace-proxy.mts --upstream http://localhost:8081 --port 8082
 *   VITE_DECODE_URL=http://localhost:8082 npm run dev:web
 */
import http from "node:http";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}
const UPSTREAM = arg("upstream", "http://localhost:8081").replace(/\/$/, "");
const PORT = Number(arg("port", "8082"));

/** `\command` tokens, longest first so `\sigend` matches before `\sig` — the same ordering rule
 *  `stitch.ts` uses for its own splitter. Kept as a literal list: this file must not import from
 *  `apps/` (it is a dev tool standing outside the product), and the set is frozen anyway
 *  (ids are append-only). */
const CMDS = [
  "\\komaFlat", "\\bakiyeFlat", "\\kucukFlat", "\\buyukFlat",
  "\\komaSharp", "\\bakiyeSharp", "\\kucukSharp", "\\buyukSharp",
  "\\natural", "\\sigend", "\\sig", "\\repstart", "\\repend", "\\volta1", "\\volta2",
  "\\segno", "\\coda", "\\dacapo", "\\dalsegno", "\\fine", "\\tupend", "\\tup3", "\\tup5",
  "\\tup7", "\\grace", "\\tie",
].sort((a, b) => b.length - a.length);

// mirrors data.py: _LABEL_GLUE_RE, _LABEL_SPACED_32_RE, _LABEL_UNIT_RE
const GLUE = /(?<=[a-gr',])\s+(?=['\d])/g;
const SPACED_32 = /(?<=\S)\s+32\b/g;
const UNIT = new RegExp(
  CMDS.map((t) => t.replace(/\\/g, "\\\\")).join("|") +
    String.raw`|\||[a-g][',]*(?:\d+\.*)?|r\d+\.*|\d+\.*|\S`,
  "g",
);

/** One space between label units, whatever the decoder glued. */
export function canonicalLabel(text: string): string {
  const glued = (text ?? "").replace(SPACED_32, "32").replace(GLUE, "");
  return (glued.match(UNIT) ?? []).join(" ");
}

let rewritten = 0;
let seen = 0;

const server = http.createServer((req, res) => {
  const origin = req.headers.origin ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") return void res.writeHead(204).end();

  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    try {
      const body = Buffer.concat(chunks);
      const up = await fetch(UPSTREAM + req.url, {
        method: req.method,
        headers: { "content-type": req.headers["content-type"] ?? "application/json" },
        body: req.method === "POST" ? body : undefined,
      });
      const text = await up.text();
      let out = text;
      if (up.headers.get("content-type")?.includes("json")) {
        try {
          const j = JSON.parse(text);
          if (Array.isArray(j?.strips)) {
            for (const s of j.strips) {
              if (typeof s?.tokens !== "string") continue;
              seen++;
              const fixed = canonicalLabel(s.tokens);
              if (fixed !== s.tokens) rewritten++;
              s.tokens = fixed; // ⚠ tokens ONLY — ids/logprobs/hitCap pass through untouched
            }
            out = JSON.stringify(j);
          }
        } catch {
          /* not our shape — pass the body through verbatim */
        }
      }
      res.writeHead(up.status, { "content-type": up.headers.get("content-type") ?? "application/json" });
      res.end(out);
      if (req.url?.startsWith("/decode")) {
        console.log(`  /decode → ${up.status}, re-spaced ${rewritten}/${seen} strips so far`);
      }
    } catch (e) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `upstream unreachable: ${(e as Error).message}` }));
    }
  });
});

// Only listen when this file is RUN, not when `canonicalLabel` is imported — the re-spacing rule is
// checked against Python's `canonical_label` by a test that imports it, and a module that binds a
// port on import cannot be checked.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) {
  server.listen(PORT, () => {
    console.log(`H re-spacing proxy on :${PORT} → ${UPSTREAM}`);
    console.log(`  point the app at it:  VITE_DECODE_URL=http://localhost:${PORT} npm run dev:web`);
    console.log(`  ⚠ local trial only — it rewrites tokens text, nothing else, and nothing here ships`);
  });
}
