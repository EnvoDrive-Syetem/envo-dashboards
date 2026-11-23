// Fetches every dashboard data set from Zoho Analytics and writes public/data/*.json.
// Run by the GitHub Actions workflow before building the site:
//   node --experimental-strip-types scripts/fetch-data.ts            (live, needs ZOHO_* secrets)
//   node --experimental-strip-types scripts/fetch-data.ts --fixtures (sample data, no Zoho)
import fs from "node:fs";
import { QUERIES } from "../lib/queries.ts";
import { PARAM_RULES, fillSql } from "../lib/params.ts";
import { presets } from "../lib/datakey.ts";
import { query, parseCsv } from "../lib/zoho.ts";

const FIXTURES = process.argv.includes("--fixtures");
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

// The employee and board lists decide which productivity files to build.
{
  const sql = QUERIES.ep_options.sql;
  const rows = FIXTURES ? parseCsv(fs.readFileSync(new URL("../lib/fixtures/ep_options.csv", import.meta.url), "utf8")).rows : (await query(sql)).rows;
  names = rows.map((r) => ({ Kind: String(r.Kind), Name: String(r.Name) }));
}
const jobs = Object.keys(QUERIES).filter((id) => !SKIP(id)).flatMap((id) => combos(id).map((values) => ({ id, values })));
console.log(`${jobs.length} data files to build${FIXTURES ? " (sample data)" : ""}`);

let ok = 0, failed = 0;
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
        const sql = fillSql(QUERIES[job.id].sql, job.values);
        for (let attempt = 1; ; attempt++) {
          try { rows = (await query(sql)).rows; break; }
          catch (e) {
            if (attempt >= 4) throw e;
            console.log(`retry ${attempt} ${job.id}: ${(e as Error).message.slice(0, 80)}`);
            await new Promise((r) => setTimeout(r, 20_000 * attempt));
          }
        }
      }
      for (const col of STRIP[job.id] || []) rows.forEach((r) => delete r[col]);
      fs.writeFileSync(new URL(`${dataKey(job.id, job.values)}.json`, OUT), JSON.stringify({ rows, fetchedAt, demo: FIXTURES || undefined }));
      ok++;
    } catch (e) {
      failed++;
      console.error(`FAILED ${job.id} ${JSON.stringify(job.values)}: ${(e as Error).message}`);
    }
  }
}
await Promise.all([lane(), lane()]); // 2 at a time: Zoho allows only a few exports at once per organization
console.log(`done: ${ok} written, ${failed} failed`);
if (ok === 0) process.exit(1);
