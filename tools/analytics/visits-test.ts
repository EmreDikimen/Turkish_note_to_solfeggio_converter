/**
 * The visit counter's arithmetic, pinned (Node-only) for `netlify/shared/visits.ts`. Four parts:
 *
 *  1. **The anonymous id really is anonymous, and it really does expire.** The same device on two
 *     days must hash to two different ids, and a different secret must give a different id again.
 *     This is the whole privacy claim of the feature, so it is a test and not a comment.
 *  2. **The user-agent lessons docs/METRICS-USAGE.md paid for in wrong entries.** Edge and Opera
 *     must not read as Chrome, Samsung Internet must not disappear into it, and the browser VERSION
 *     must survive — it is the only evidence the data holds that two visits came from two machines.
 *  3. **The referrer keeps its host and loses its path**, which is where a search query would hide.
 *  4. **Folding**, including the two rules that are easy to get backwards: a country already known
 *     is never overwritten, and the referrer list neither duplicates nor grows without bound.
 *
 * Run: npx --yes tsx tools/analytics/visits-test.ts
 */

import {
  dateOfKey,
  dayMs,
  foldVisit,
  istanbulDate,
  keyFor,
  readUA,
  refHost,
  visitorId,
  type VisitorDay,
} from "../../netlify/shared/visits";

let failures = 0;

function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}\n    want: ${w}\n    got : ${g}`);
  }
}


async function main(): Promise<void> {
  // ---------------------------------------------------------------------------------------------
  // 1. The id: anonymous, and it expires
  // ---------------------------------------------------------------------------------------------
  console.log("the anonymous per-day id");

  const IP = "88.240.41.208";
  const UA_ANDROID =
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36";

  const idToday = await visitorId("secret", "2026-09-05", IP, UA_ANDROID);
  const idTomorrow = await visitorId("secret", "2026-09-06", IP, UA_ANDROID);
  const idOtherSalt = await visitorId("other", "2026-09-05", IP, UA_ANDROID);
  const idAgain = await visitorId("secret", "2026-09-05", IP, UA_ANDROID);

  check("16 hex characters", /^[0-9a-f]{16}$/.test(idToday), true);
  check("the same device, the same day, the same id", idAgain, idToday);
  check("⭐ THE SAME DEVICE TOMORROW IS A DIFFERENT ID", idTomorrow === idToday, false);
  check("a different secret is a different id", idOtherSalt === idToday, false);
  check(
    "two browsers behind ONE address are two devices (the household case)",
    (await visitorId("secret", "2026-09-05", IP, "Mozilla/5.0 (Macintosh) Firefox/143.0")) === idToday,
    false
  );
  check("the id contains nothing of the address", idToday.includes("88"), false);

  // ---------------------------------------------------------------------------------------------
  // 2. Reading a user-agent — every case here is one METRICS-USAGE.md had to reason about by hand
  // ---------------------------------------------------------------------------------------------
  console.log("\nuser-agent");

  check("Android Chrome is a phone", readUA(UA_ANDROID), {
    device: "phone",
    browser: "Chrome 151",
    os: "Android",
    bot: false,
  });
  check(
    "⚠ 'Request desktop site' on a phone reads as a Linux DESKTOP — unfixable, so it is documented",
    readUA(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
    ),
    { device: "desktop", browser: "Chrome 151", os: "Linux", bot: false }
  );
  check(
    "Edge is not Chrome, even though its UA says Chrome",
    readUA(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0"
    ).browser,
    "Edge 151"
  );
  check(
    "Opera is not Chrome either",
    readUA(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 OPR/117.0.0.0"
    ).browser,
    "Opera 117"
  );
  check(
    "Samsung Internet keeps its own name (common in Turkey)",
    readUA(
      "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/151.0.0.0 Mobile Safari/537.36"
    ).browser,
    "Samsung Internet 25"
  );
  check(
    "iPhone Safari reads its Version/, not the Safari/ build number",
    readUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1"
    ),
    { device: "phone", browser: "Safari 18", os: "iOS", bot: false }
  );
  check("an iPad is a tablet", readUA("Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X)").device, "tablet");
  check(
    "⭐ THE VERSION SURVIVES — it is the only proof two visits are two machines",
    [readUA(UA_ANDROID).browser, readUA(UA_ANDROID.replace("151.0", "150.0")).browser],
    ["Chrome 151", "Chrome 150"]
  );
  check(
    "the post-deploy crawler is a robot",
    readUA("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/131.0.0.0 Safari/537.36").bot,
    true
  );
  check("so is a plain curl", readUA("curl/8.7.1").bot, true);
  check("an empty user-agent is unknown, not a desktop", readUA("").device, "?");

  // ---------------------------------------------------------------------------------------------
  // 3. The referrer keeps its host and nothing else
  // ---------------------------------------------------------------------------------------------
  console.log("\nreferrer");

  check("host only, www stripped", refHost("https://www.google.com/search?q=nota+okuma"), "google.com");
  check("the path, which could carry a query, is gone", refHost("https://x.com/a/b?q=secret"), "x.com");
  check("no referrer is null", refHost(undefined), null);
  check("a referrer we cannot parse is null, not a crash", refHost("about:blank"), null);

  // ---------------------------------------------------------------------------------------------
  // 4. Keys, days and folding
  // ---------------------------------------------------------------------------------------------
  console.log("\nkeys and folding");

  check("a key carries its date", dateOfKey(keyFor("2026-09-05", idToday)), "2026-09-05");
  check("anything else is not one of ours", dateOfKey("visits/whatever"), null);
  check("days compare", dayMs("2026-09-06") - dayMs("2026-09-05"), 86_400_000);
  check(
    "⚠ 01:00 in Istanbul is still that day, not UTC's yesterday",
    istanbulDate(Date.parse("2026-09-05T22:30:00Z")),
    "2026-09-06"
  );

  const UA = readUA(UA_ANDROID);
  let row = foldVisit(null, 1_000, "2026-09-05", "open", UA, "TR", "google.com");
  check("a first visit opens the row", [row.opens, row.reads, row.refs], [1, 0, ["google.com"]]);

  row = foldVisit(row, 2_000, "2026-09-05", "read", UA, "TR", "google.com");
  check("a read is counted apart from an opening", [row.opens, row.reads], [1, 1]);
  check("the same referrer is not listed twice", row.refs, ["google.com"]);
  check("first and last move independently", [row.firstMs, row.lastMs], [1_000, 2_000]);

  let unknown = foldVisit(null, 1_000, "2026-09-05", "open", UA, "??", null);
  unknown = foldVisit(unknown, 2_000, "2026-09-05", "open", UA, "TR", null);
  check("a country learned later fills an unknown", unknown.country, "TR");

  let known = foldVisit(null, 1_000, "2026-09-05", "open", UA, "TR", null);
  known = foldVisit(known, 2_000, "2026-09-05", "open", UA, "DE", null);
  check(
    "⚠ but a country already known is NEVER overwritten — else the column depends on request order",
    known.country,
    "TR"
  );

  let many: VisitorDay | null = null;
  for (const host of ["a.com", "b.com", "c.com", "d.com", "e.com", "f.com", "g.com"]) {
    many = foldVisit(many, 1_000, "2026-09-05", "open", UA, "TR", host);
  }
  check("the referrer list is capped at five", many?.refs.length, 5);
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

// tsx runs this file as CommonJS (the repo root declares no `"type": "module"`), which has no
// top-level await — hence the wrapper rather than a flat script like the other tools/ tests.
void main();
