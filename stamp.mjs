import fs from "node:fs";
const p = "data/news.json";
let t = fs.readFileSync(p, "utf8").replace("__NOW__", new Date().toISOString());
const j = JSON.parse(t);
fs.writeFileSync(p, t, "utf8");
console.log(j.updated);
