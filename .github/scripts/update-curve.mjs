// Self-contained: refresh curve.json (monthly history, last complete row per month) from FRED.
import { readFileSync, writeFileSync } from "node:fs";
const FILE = "curve.json";
const ids = [["y2","DGS2"],["y5","DGS5"],["y7","DGS7"],["y10","DGS10"],["y30","DGS30"]];
const start = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
async function series(id) {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`);
  if (!res.ok) throw new Error(`${id} ${res.status}`);
  const m = new Map();
  for (const line of (await res.text()).trim().split(/\n/).slice(1)) {
    const [d, raw] = line.split(","); const v = Number(raw);
    if (d && raw !== "." && raw !== "" && Number.isFinite(v)) m.set(d, v);
  }
  return m;
}
const old = JSON.parse(readFileSync(FILE, "utf8"));
const maps = await Promise.all(ids.map(async ([k, id]) => [k, await series(id)]));
const dates = [...new Set(maps.flatMap(([, m]) => [...m.keys()]))].sort();
const months = new Map(old.history.map((p) => [p.d.slice(0, 7), p]));
for (const d of dates) {
  if (maps.some(([, m]) => !m.has(d))) continue;
  const p = { d }; for (const [k, m] of maps) p[k] = m.get(d);
  const prev = months.get(d.slice(0, 7));
  if (!prev || prev.d <= d) months.set(d.slice(0, 7), p);
}
const history = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, p]) => p);
if (history.length < old.history.length) throw new Error("history shrank");
const spot = history.at(-1);
if (JSON.stringify(history) === JSON.stringify(old.history)) { console.log(`unchanged ${spot.d}`); process.exit(0); }
writeFileSync(FILE, JSON.stringify({ history, spot, source: "FRED", fetchedAt: Date.now() }));
console.log(`curve ${spot.d} 10y ${spot.y10} (${history.length} rows)`);
