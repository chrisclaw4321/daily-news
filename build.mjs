// Daily News builder: fetches Google News RSS per section and writes public/index.html
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const gn = (q, hl = "en", gl = "US", ceid = "US:en") =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
const de = (q) => gn(q, "de", "CH", "CH:de");

const sections = [
  { id: "global", title: "🌍 Global News", feeds: [gn("politics OR war OR Ukraine OR Gaza OR USA OR Trump when:1d")], max: 10 },
  { id: "swiss", title: "🇨🇭 Schweiz", feeds: [de("Schweiz Politik OR Wirtschaft when:1d")], max: 8 },
  { id: "zurich", title: "🏙️ Zürich", feeds: [de("Stadt Zürich OR Kanton Zürich when:2d")], max: 8 },
  { id: "regensdorf", title: "🏡 Regensdorf & Watt", feeds: [de("Regensdorf when:14d"), de("Watt Regensdorf when:14d")], max: 6 },
  { id: "events", title: "📅 Events Regensdorf/Watt (nächste 3 Monate)", feeds: [de("Regensdorf Veranstaltung OR Anlass OR Konzert OR Markt OR Fest when:30d"), de("Watt Regensdorf Veranstaltung OR Fest OR Anlass when:30d")], max: 8 },
  { id: "poker", title: "♠️ Poker", feeds: [gn("poker WSOP OR PokerStars OR GGPoker OR \"poker tournament\" when:3d")], max: 8 },
  { id: "ai", title: "🤖 AI & OpenClaw", feeds: [gn("OpenClaw when:7d"), gn("artificial intelligence OR OpenAI OR Anthropic OR LLM when:1d")], max: 10 },
  { id: "movies", title: "🎬 Movies & Rumors", feeds: [gn("new movie trailer OR release OR casting rumor OR box office when:3d")], max: 8 },
  { id: "axpo", title: "⚡ Axpo", feeds: [gn("Axpo when:14d"), de("Axpo Group OR \"Axpo Holding\" when:14d")], max: 8 },
];

const decode = (s) =>
  s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>(.*?)</${t}>`, "s")); return m ? decode(m[1]).trim() : ""; };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function fetchFeed(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 DailyNews" }, signal: AbortSignal.timeout(20000) });
    const xml = await r.text();
    return [...xml.matchAll(/<item>(.*?)<\/item>/gs)].map((m) => {
      const it = m[1];
      return { title: tag(it, "title"), link: tag(it, "link"), date: new Date(tag(it, "pubDate")), source: tag(it, "source") };
    });
  } catch (e) { console.error("feed failed", url, e.message); return []; }
}

const tz = "Europe/Zurich";
const fmt = (d) => isNaN(d) ? "" : d.toLocaleString("de-CH", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

let html = "";
for (const s of sections) {
  const all = (await Promise.all(s.feeds.map(fetchFeed))).flat();
  const seen = new Set();
  const items = all.filter((i) => i.title && !seen.has(i.title) && seen.add(i.title))
    .sort((a, b) => b.date - a.date).slice(0, s.max);
  html += `<section id="${s.id}"><h2>${s.title}</h2><ul>` +
    (items.map((i) => `<li><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a><small>${esc(i.source)} · ${fmt(i.date)}</small></li>`).join("") || "<li>Keine Meldungen gefunden.</li>") +
    `</ul></section>`;
  console.log(s.id, items.length);
}

const nav = sections.map((s) => `<a href="#${s.id}">${s.title.split(" ")[0]}</a>`).join("");
const page = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Daily News</title>
<style>
:root{--bg:#f4f5f7;--card:#fff;--fg:#1b1f24;--mut:#6b7280;--acc:#d9372b}
@media(prefers-color-scheme:dark){:root{--bg:#111418;--card:#1b2027;--fg:#e8eaed;--mut:#98a2b3;--acc:#ff6b5e}}
*{box-sizing:border-box}body{margin:0;font:16px/1.4 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header{position:sticky;top:0;background:var(--card);padding:.6rem 1rem;box-shadow:0 1px 4px #0003;z-index:5}
header h1{margin:0;font-size:1.2rem}header small{color:var(--mut)}
nav{display:flex;gap:.6rem;overflow-x:auto;padding-top:.4rem}nav a{text-decoration:none;font-size:1.3rem}
main{display:grid;gap:1rem;padding:1rem;grid-template-columns:1fr;max-width:1500px;margin:auto}
@media(min-width:700px){main{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1100px){main{grid-template-columns:repeat(3,1fr)}}
section{background:var(--card);border-radius:12px;padding:1rem;scroll-margin-top:90px}
h2{margin:0 0 .5rem;font-size:1.1rem;color:var(--acc)}
ul{list-style:none;margin:0;padding:0}li{padding:.5rem 0;border-top:1px solid #8883}li:first-child{border:0}
a{color:inherit}li a{font-weight:600;text-decoration:none}li a:hover{text-decoration:underline}
small{display:block;color:var(--mut);font-size:.8rem}
</style></head><body>
<header><h1>Daily News <small>Aktualisiert: ${new Date().toLocaleString("de-CH", { timeZone: tz })}</small></h1><nav>${nav}</nav></header>
<main>${html}</main></body></html>`;

await writeFile(path.join(here, "public", "index.html"), page);
console.log("written");

import { execSync } from 'node:child_process';
try { const o={cwd:here,stdio:'inherit'}; execSync('git add -A',o); execSync('git -c user.name=chrisclaw4321 -c user.email=chrisclaw4321@users.noreply.github.com commit -m \"news update\"',o); execSync('git push',o); } catch(e){ console.log('git: nothing to push or failed', e.message); }
