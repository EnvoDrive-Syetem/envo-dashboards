// Fetches every dashboard data set from Zoho Analytics and writes public/data/*.json.
// Run by the GitHub Actions workflow before building the site:
//   node --experimental-strip-types scripts/fetch-data.ts            (live, needs ZOHO_* secrets)
//   node --experimental-strip-types scripts/fetch-data.ts --fixtures (sample data, no Zoho)
import fs from "node:fs";
import { QUERIES } from "../lib/queries.ts";
import { PARAM_RULES, fillSql } from "../lib/params.ts";
import { presets } from "../lib/datakey.ts";
import { query, parseCsv } from "../lib/zoho.ts";
import { EP_BASE_SQL, EP_BASE_WEEK_SQL, epPeople, epWeek, epBoard, epOptions } from "../lib/epDerive.ts";

const FIXTURES = process.argv.includes("--fixtures");
// A commit whose message contains [skip data] republishes the site with the numbers
// already on it (for code fixes), without asking Zoho for anything.
let QUICK = false;
try { QUICK = /\[skip data\]/i.test(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH || "", "utf8"))?.head_commit?.message || ""); } catch {}
// Stop asking Zoho after this long and keep the previous numbers for the rest,
// so a slow Zoho never holds up the site (or overlaps the next hourly run).
const STARTED = Date.now(), BUDGET_MS = 40 * 60_000;
const OUT = new URL("../public/data/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

// Kept off the public site: open-card titles (they name customers and internal matters).
const SKIP = (id: string) => id === "ep_open_cards";
// Columns removed before publishing.
const STRIP: Record<string, string[]> = { sc_backlog: ["Customer"] };

function dataKey(id: string, params: Record<string, string>): string {
  const parts = Object.keys(params).sort().map((k) => params[k]);
  return [id, ...parts].map((p) => encodeURIComponent(p).replace(/[^A-Za-z0-9_-]/g, "_")).join("__");
}

// The site as currently published, e.g. https://envodrive-syetem.github.io/envo-dashboards/
const [owner, repo] = (process.env.GITHUB_REPOSITORY || "/").split("/");
const LIVE = process.env.LIVE_DATA_URL || (owner && repo ? `https://${owner.toLowerCase()}.github.io/${repo}/data/` : "");
async function previous(name: string): Promise<string | null> {
  if (!LIVE) return null;
  try { const r = await fetch(LIVE + name); return r.ok ? await r.text() : null; } catch { return null; }
}
let names: { Kind: string; Name: string }[] = [];
function combos(id: string): Record<string, string>[] {
  const ps = QUERIES[id].params;
  if (ps.includes("ep_emp")) return [
    { ep_emp: "", ep_board: "" },
    ...names.filter((n) => n.Kind === "Employee").map((n) => ({ ep_emp: n.Name, ep_board: "" })),
    ...names.filter((n) => n.Kind === "Board").map((n) => ({ ep_emp: "", ep_board: n.Name })),
  ].filter((v) => !/['\\]/.test(v.ep_emp + v.ep_board)); // a quote would break the SQL
  if (ps.length === 0) return [{}];
  if (ps.includes("start")) return Object.values(presets()).map((p) => ({ start: p.start, end: p.end }));
  if (ps.includes("hperiod")) {
    const out: Record<string, string>[] = [];
    // One focus at a time (a channel OR a product line), to keep Zoho's load low.
    for (const hperiod of PARAM_RULES.hperiod.enum!) {
      for (const hchannel of PARAM_RULES.hchannel.enum!) out.push({ hperiod, hchannel, hline: "All lines" });
      for (const hline of PARAM_RULES.hline.enum!.slice(1)) out.push({ hperiod, hchannel: "All channels", hline });
    }
    return out;
  }
  throw new Error(`No combinations defined for ${id}`);
}

// Productivity: two reads of "EP Card Metrics", then every employee and board view
// is worked out here (lib/epDerive.ts) instead of one slow Zoho query per view.
const EP_IDS = ["ep_people", "ep_week", "ep_board", "ep_options"];
const DERIVED = !FIXTURES && !QUICK;
let ep: { base: Record<string, unknown>[]; weeks: Record<string, unknown>[] } | null = null;
let limitHit = false, limitStrikes = 0;

// Ask Zoho, retrying when it is busy, slow or briefly over its per-minute call limit.
async function ask(id: string, sql: string) {
  for (let attempt = 1; ; attempt++) {
    try { return (await query(sql)).rows; }
    catch (e) {
      const msg = (e as Error).message;
      const limit = /API call limit/.test(msg);
      // A per-minute limit clears after a minute; if it keeps happening it is the daily cap.
      if (limit && ++limitStrikes >= 5) limitHit = true;
      if (attempt >= 3 || limitHit || Date.now() - STARTED > BUDGET_MS) throw e;
      console.log(`retry ${attempt} ${id}: ${msg.slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, limit ? 65_000 : 20_000 * attempt));
    }
  }
}

// The employee and board lists decide which productivity files to build.
{
  let rows;
  if (FIXTURES) rows = parseCsv(fs.readFileSync(new URL("../lib/fixtures/ep_options.csv", import.meta.url), "utf8")).rows;
  else if (DERIVED) {
    try {
      const [base, weeks] = await Promise.all([ask("ep_base", EP_BASE_SQL), ask("ep_base_week", EP_BASE_WEEK_SQL)]);
      ep = { base, weeks };
      rows = epOptions(base);
    } catch (e) {
      console.error(`FAILED productivity base tables: ${(e as Error).message} (keeping the previous productivity numbers)`);
    }
  }
  if (!rows) rows = JSON.parse((await previous(`${dataKey("ep_options", {})}.json`)) || '{"rows":[]}').rows;
  names = rows.map((r: Record<string, unknown>) => ({ Kind: String(r.Kind), Name: String(r.Name) }));
}
const jobs = Object.keys(QUERIES).filter((id) => !SKIP(id) && !(DERIVED && EP_IDS.includes(id))).flatMap((id) => combos(id).map((values) => ({ id, values })));
console.log(`${jobs.length} data files to build${FIXTURES ? " (sample data)" : ""}`);

// Oldest (or missing) numbers first, so that when a run hits its time cap the next
// run carries on where it stopped, instead of always redoing the same ones.
const prev = new Map<string, string | null>();
if (!FIXTURES && LIVE) {
  const todo = jobs.slice();
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let j = todo.shift(); j; j = todo.shift()) { const n = `${dataKey(j.id, j.values)}.json`; prev.set(n, await previous(n)); }
  }));
  const age = (j: { id: string; values: Record<string, string> }) => {
    try { return Date.parse(JSON.parse(prev.get(`${dataKey(j.id, j.values)}.json`) || "").fetchedAt) || 0; } catch { return 0; }
  };
  jobs.sort((a, b) => age(a) - age(b));
}

let ok = 0, failed = 0, reused = 0;
const fetchedAt = new Date().toISOString();
async function lane() {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    try {
      let rows;
      if (FIXTURES) {
        const f = new URL(`../lib/fixtures/${job.id}.csv`, import.meta.url);
        rows = fs.existsSync(f) ? parseCsv(fs.readFileSync(f, "utf8")).rows : [];
      } else {
        // Zoho sometimes is busy ("Async export limit reached") or slow; wait and try again.
        // When the account's API call limit is hit, stop asking and keep last hour's files.
        if (limitHit) throw new Error("skipped: Zoho API call limit reached earlier in this run");
        if (QUICK) throw new Error("skipped: [skip data] commit");
        if (Date.now() - STARTED > BUDGET_MS) throw new Error("skipped: this run's 40 minutes are up");
        rows = await ask(job.id, fillSql(QUERIES[job.id].sql, job.values));
      }
      for (const col of STRIP[job.id] || []) rows.forEach((r) => delete r[col]);
      fs.writeFileSync(new URL(`${dataKey(job.id, job.values)}.json`, OUT), JSON.stringify({ rows, fetchedAt, demo: FIXTURES || undefined }));
      ok++;
    } catch (e) {
      failed++;
      const name = `${dataKey(job.id, job.values)}.json`;
      // Keep the copy that is on the live site now, so a failed query never blanks a chart.
      const kept = prev.has(name) ? prev.get(name)! : await previous(name);
      if (kept) { fs.writeFileSync(new URL(name, OUT), kept); reused++; }
      console.error(`FAILED ${job.id} ${JSON.stringify(job.values)}: ${(e as Error).message}${kept ? " (kept the previous numbers)" : ""}`);
    }
  }
}
// Write every productivity view from the two base tables (or keep the previous ones).
if (DERIVED) {
  for (const id of EP_IDS) for (const values of id === "ep_options" ? [{}] : combos(id)) {
    const name = `${dataKey(id, values)}.json`;
    if (ep) {
      const e = (values as Record<string, string>).ep_emp || "", b = (values as Record<string, string>).ep_board || "";
      const rows = id === "ep_people" ? epPeople(ep.base as never, e, b) : id === "ep_week" ? epWeek(ep.weeks as never, e, b)
        : id === "ep_board" ? epBoard(ep.base as never, e, b) : epOptions(ep.base as never);
      fs.writeFileSync(new URL(name, OUT), JSON.stringify({ rows, fetchedAt }));
      ok++;
    } else {
      failed++;
      const kept = await previous(name);
      if (kept) { fs.writeFileSync(new URL(name, OUT), kept); reused++; }
    }
  }
  console.log(ep ? "productivity: all views worked out from 2 Zoho reads" : "productivity: kept the previous numbers");
}

await Promise.all([lane(), lane(), lane()]); // 3 at a time: Zoho allows 5 exports at once per organization; API calls are paced in lib/zoho.ts
console.log(`done: ${ok} written, ${failed} failed (${reused} kept from the previous update)`);

// Health report for monitoring: how old and how big every published data file is.
{
  const files: Record<string, { rows: number; fetchedAt: string | null }> = {};
  for (const f of fs.readdirSync(OUT)) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue;
    try { const d = JSON.parse(fs.readFileSync(new URL(f, OUT), "utf8")); files[f] = { rows: (d.rows || []).length, fetchedAt: d.fetchedAt || null }; }
    catch { files[f] = { rows: -1, fetchedAt: null }; }
  }
  fs.writeFileSync(new URL("_health.json", OUT), JSON.stringify({
    runAt: fetchedAt, finishedAt: new Date().toISOString(), quick: QUICK, written: ok, failed, kept: reused,
    productivity: DERIVED ? (ep ? "fresh" : "kept previous") : "not refreshed", files,
  }));
}
if (ok + reused === 0) process.exit(1);
