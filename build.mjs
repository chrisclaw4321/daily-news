// Daily News builder: Bing News RSS per section -> public/index.html -> git push -> Cloudflare Pages deploy
import { writeFile, readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const TOP = 5;
const bing = (q, cc = "us", lang = "en") =>
  `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=${lang}&cc=${cc}&qft=sortbydate%3d%221%22`;
const en = (q) => bing(q);
const de = (q) => bing(q, "ch", "de-CH");

const sections = [
  { id: "global", title: "🌍 Global News", feeds: [en("world politics war Ukraine Gaza USA Trump")] },
  { id: "swiss", title: "🇨🇭 Schweiz", feeds: [de("Schweiz Politik Wirtschaft")] },
  { id: "zurich", title: "🏙️ Zürich", feeds: [de("Stadt Zürich"), de("Kanton Zürich")] },
  { id: "regensdorf", title: "🏡 Regensdorf & Watt", feeds: [de("Regensdorf"), de("Watt Regensdorf")] },
  { id: "events", title: "📅 Events Regensdorf/Watt (nächste 3 Monate)", feeds: [de("Regensdorf Veranstaltung"), de("Regensdorf Konzert OR Fest OR Markt OR Anlass"), de("Watt Regensdorf Anlass")] },
  { id: "poker", title: "♠️ Poker", feeds: [en("poker WSOP OR PokerStars OR GGPoker OR poker tournament")] },
  { id: "ai", title: "🤖 AI & OpenClaw", feeds: [en("OpenClaw"), en("artificial intelligence OpenAI Anthropic LLM")], prefer: /openclaw/i },
  { id: "movies", title: "🎬 Movies & Rumors", feeds: [en("new movie trailer release casting rumor box office")] },
  { id: "axpo", title: "⚡ Axpo", feeds: [en("Axpo"), de("Axpo Group")] },
];

const decode = (s) =>
  s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
   .replace(/&amp;/g, "&");
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>(.*?)</${t}>`, "s")); return m ? decode(m[1]).trim() : ""; };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const realUrl = (l) => { try { return new URL(l).searchParams.get("url") || l; } catch { return l; } };

async function fetchFeed(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 DailyNews" }, signal: AbortSignal.timeout(20000) });
    const xml = await r.text();
    return [...xml.matchAll(/<item>(.*?)<\/item>/gs)].map((m) => {
      const it = m[1];
      let summary = tag(it, "description").replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
      return { title: tag(it, "title"), link: realUrl(tag(it, "link")), summary, date: new Date(tag(it, "pubDate")), source: tag(it, "News:Source") };
    });
  } catch (e) { console.error("feed failed", url, e.message); return []; }
}

const tz = "Europe/Zurich";
const fmt = (d) => isNaN(d) ? "" : d.toLocaleString("de-CH", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9äöüéèà]+/g, " ").trim().slice(0, 45);

let html = "";
for (const s of sections) {
  const all = (await Promise.all(s.feeds.map(fetchFeed))).flat().filter((i) => i.title && i.link);
  const seen = new Set();
  const uniq = all.filter((i) => { const k = norm(i.title); if (seen.has(k)) return false; seen.add(k); return true; });
  uniq.sort((a, b) => ((s.prefer?.test(b.title + b.summary) ? 1 : 0) - (s.prefer?.test(a.title + a.summary) ? 1 : 0)) || (b.date - a.date));
  const items = uniq.slice(0, TOP);
  html += `<section id="${s.id}"><h2>${s.title}</h2><ol>` +
    (items.map((i) => `<li><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a>` +
      (i.summary ? `<p>${esc(i.summary)}</p>` : "") +
      `<small>${esc(i.source)} · ${fmt(i.date)}</small></li>`).join("") || "<li>Keine Meldungen gefunden.</li>") +
    `</ol></section>`;
  console.log(s.id, items.length);
}

const nav = sections.map((s) => `<a href="#${s.id}" title="${esc(s.title)}">${s.title.split(" ")[0]}</a>`).join("");
const page = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Daily News</title>
<style>
:root{--bg:#f4f5f7;--card:#fff;--fg:#1b1f24;--mut:#6b7280;--acc:#d9372b}
@media(prefers-color-scheme:dark){:root{--bg:#111418;--card:#1b2027;--fg:#e8eaed;--mut:#98a2b3;--acc:#ff6b5e}}
*{box-sizing:border-box}body{margin:0;font:16px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header{position:sticky;top:0;background:var(--card);padding:.6rem 1rem;box-shadow:0 1px 4px #0003;z-index:5}
header h1{margin:0;font-size:1.2rem}header small{color:var(--mut);font-weight:400;font-size:.8rem}
nav{display:flex;gap:.8rem;overflow-x:auto;padding-top:.4rem}nav a{text-decoration:none;font-size:1.3rem}
main{display:grid;gap:1rem;padding:1rem;grid-template-columns:1fr;max-width:1500px;margin:auto}
@media(min-width:700px){main{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1100px){main{grid-template-columns:repeat(3,1fr)}}
section{background:var(--card);border-radius:12px;padding:1rem;scroll-margin-top:90px}
h2{margin:0 0 .5rem;font-size:1.1rem;color:var(--acc)}
ol{margin:0;padding:0;list-style:none;counter-reset:n}
li{padding:.7rem 0;border-top:1px solid #8883;counter-increment:n}li:first-child{border:0}
li a{font-weight:600;text-decoration:none;color:inherit}li a:hover{text-decoration:underline}
li a::before{content:counter(n) ". ";color:var(--acc)}
p{margin:.3rem 0;font-size:.92rem;color:var(--fg);opacity:.85}
small{display:block;color:var(--mut);font-size:.78rem}
</style></head><body>
<header><h1>Daily News <small>Aktualisiert: ${new Date().toLocaleString("de-CH", { timeZone: tz })}</small></h1><nav>${nav}</nav></header>
<main>${html}</main></body></html>`;

await writeFile(path.join(here, "public", "index.html"), page);
console.log("written");

// publish: GitHub + Cloudflare Pages
const sh = (cmd, env = {}) => execSync(cmd, { cwd: here, stdio: "inherit", shell: true, env: { ...process.env, ...env } });
try {
  sh("git add -A");
  sh('git -c user.name=chrisclaw4321 -c user.email=chrisclaw4321@users.noreply.github.com commit -m "news update"');
  sh("git push");
} catch (e) { console.log("git: nothing to commit or push failed"); }
try {
  const tok = (await readFile(path.join(process.env.USERPROFILE, ".openclaw", "secrets", "cloudflare-api-token"), "utf8")).trim();
  sh("npx wrangler pages deploy public --project-name daily-news --branch main", { CLOUDFLARE_API_TOKEN: tok });
} catch (e) { console.log("cloudflare deploy failed"); process.exitCode = 1; }
