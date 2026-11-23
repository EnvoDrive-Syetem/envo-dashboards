// File name for one data set + filter values. Keep in sync with scripts/fetch-data.ts.
export function dataKey(id: string, params: Record<string, string>): string {
  const parts = Object.keys(params).sort().map((k) => params[k]);
  return [id, ...parts].map((p) => encodeURIComponent(p).replace(/[^A-Za-z0-9_-]/g, "_")).join("__");
}

/** Period presets for profit by channel, in Vancouver time (same as the data job). */
export function presets(now = new Date()): Record<string, { label: string; start: string; end: string }> {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const y = +p.find((x) => x.type === "year")!.value, m = +p.find((x) => x.type === "month")!.value - 1, d = +p.find((x) => x.type === "day")!.value;
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  const D = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd));
  const q = Math.floor(m / 3), today = D(y, m, d);
  const r = (label: string, a: Date, b: Date) => ({ label, start: iso(a), end: iso(b) });
  return {
    last12: r("Last 12 full months", D(y, m - 12, 1), D(y, m, 0)),
    ytd: r("This year to date", D(y, 0, 1), today),
    thisq: r("This quarter to date", D(y, 3 * q, 1), today),
    lastq: r("Last quarter", D(y, 3 * q - 3, 1), D(y, 3 * q, 0)),
    lastmonth: r("Last full month", D(y, m - 1, 1), D(y, m, 0)),
    lastyear: r("Last year", D(y - 1, 0, 1), D(y - 1, 11, 31)),
  };
}
