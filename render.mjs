// Renders data/news.json (written by the agent) to public/index.html, then publishes to GitHub + Cloudflare Pages.
import { writeFile, readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : "#");
const defs = JSON.parse(await readFile(path.join(here, "sections.json"), "utf8")).sections;
const data = JSON.parse(await readFile(path.join(here, "data", "news.json"), "utf8"));
const tz = "Europe/Zurich";
let html = "";
for (const s of defs) {
  const items = (data.sections?.[s.id] || []).slice(0, 5);
  html += `<section id="${s.id}"><h2>${esc(s.title)}</h2><ol>` +
    (items.map((i) => `<li><a href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener">${esc(i.title)}</a><p>${esc(i.summary)}</p><small>${esc(i.source)}${i.date ? " · " + esc(i.date) : ""}</small></li>`).join("") || "<li>Keine Meldungen.</li>") +
    `</ol></section>`;
}
const nav = defs.map((s) => `<a href="#${s.id}" title="${esc(s.title)}">${[...s.title][0]}${""}</a>`).join("");
const upd = data.updated ? new Date(data.updated).toLocaleString("de-CH", { timeZone: tz }) : "?";
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
p{margin:.3rem 0;font-size:.93rem;opacity:.9}
small{display:block;color:var(--mut);font-size:.78rem}
</style></head><body>
<header><h1>Daily News <small>Aktualisiert: ${esc(upd)}</small></h1><nav>${nav}</nav></header>
<main>${html}</main></body></html>`;
await writeFile(path.join(here, "public", "index.html"), page);
console.log("rendered", defs.map((s) => (data.sections?.[s.id] || []).length).join(","));
if (process.argv.includes("--no-publish")) process.exit(0);
const sh = (cmd, env = {}) => execSync(cmd, { cwd: here, stdio: "inherit", shell: true, env: { ...process.env, ...env } });
try { sh("git add -A"); sh('git -c user.name=chrisclaw4321 -c user.email=chrisclaw4321@users.noreply.github.com commit -m "news update"'); sh("git push"); } catch { console.log("git: nothing to commit or push failed"); }
try {
  const tok = (await readFile(path.join(process.env.USERPROFILE, ".openclaw", "secrets", "cloudflare-api-token"), "utf8")).trim();
  sh("npx wrangler pages deploy public --project-name daily-news --branch main", { CLOUDFLARE_API_TOKEN: tok });
} catch { console.log("cloudflare deploy failed"); process.exitCode = 1; }
