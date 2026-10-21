// Post-deploy check: the LIVE page must match data/news.json and be fresh. Exit code 1 + message on any mismatch.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const URL_ = "https://daily-news-556.pages.dev/";
const MIN_STORIES = 15;      // total stories across all sections (a normal run has ~30-45)
const MAX_AGE_MIN = 20;      // news.json "updated" must be within this many minutes of now
const fail = (m) => { console.log("VERIFY FAILED: " + m); process.exit(1); };

const data = JSON.parse((await readFile(path.join(here, "data", "news.json"), "utf8")).replace(/^\uFEFF/, ""));
const total = Object.values(data.sections || {}).reduce((n, a) => n + (a?.length || 0), 0);
if (total < MIN_STORIES) fail(`only ${total} stories in news.json (min ${MIN_STORIES})`);

const upd = new Date(data.updated);
if (isNaN(upd)) fail("news.json has no valid 'updated'");
const ageMin = Math.abs(Date.now() - upd.getTime()) / 60000;
if (ageMin > MAX_AGE_MIN) fail(`news.json 'updated' is ${Math.round(ageMin)} min away from now (${data.updated})`);

const expected = upd.toLocaleString("de-CH", { timeZone: "Europe/Zurich" });
let live = "";
for (let i = 0; i < 6; i++) {            // Cloudflare can take a few seconds to serve the new deploy
  try {
    const r = await fetch(URL_ + "?v=" + Date.now(), { cache: "no-store" });
    live = await r.text();
    if (live.includes("Aktualisiert: " + expected)) break;
  } catch (e) { live = ""; }
  await new Promise((r) => setTimeout(r, 10000));
}
if (!live) fail("live page not reachable: " + URL_);
if (!live.includes("Aktualisiert: " + expected)) {
  const m = /Aktualisiert: ([^<]+)/.exec(live);
  fail(`live page shows '${m ? m[1] : "no timestamp"}', expected '${expected}'`);
}
const liveStories = (live.match(/<li><a href=/g) || []).length;
if (liveStories < MIN_STORIES) fail(`live page has only ${liveStories} stories`);
console.log(`VERIFY OK: live page '${expected}', ${liveStories} stories`);
