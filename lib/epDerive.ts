// Employee productivity: Zoho's "EP Card Metrics" table is slow to query, so the
// hourly job reads it twice in total (ep_base and ep_base_week below) and works out
// every employee and board view here, instead of sending Zoho ~85 queries an hour.
// The results match the ep_people, ep_week, ep_board and ep_options queries in
// lib/queries.ts row for row.

type Row = Record<string, string | number | null>;

const SUMS = ["Completed", "Completed Last 4 Weeks", "Completed This Week", "On Time", "Late", "No Due Date", "Scored On Time",
  "On Time Last 4 Weeks", "Late Last 4 Weeks", "Open", "Not Overdue", "Overdue Up To 7 Days", "Overdue Over 7 Days",
  "Very Old Overdue", "All Overdue", "Stale"];

const q = (c: string) => `"${c}"`;

/** One row per employee and board, with every total the views need. */
export const EP_BASE_SQL = `SELECT "Employee" AS "Employee", "Board" AS "Board", COUNT(*) AS "Cards", ${SUMS.map((c) => `SUM(${q(c)}) AS ${q(c)}`).join(", ")}, SUM("Days To Close") AS "DaysSum", COUNT("Days To Close") AS "DaysN", MAX("Data As Of") AS "AsOf" FROM "EP Card Metrics" GROUP BY "Employee", "Board"`;

/** Completed cards per employee, board and week, last 12 weeks. */
export const EP_BASE_WEEK_SQL = `SELECT "Employee" AS "Employee", "Board" AS "Board", "Week Starting" AS "Week", SUM("On Time") AS "OnTime", SUM("Late") AS "Late", SUM("No Due Date") AS "NoDue", SUM("Completed") AS "Completed" FROM "EP Card Metrics" WHERE "Completed" = 1 AND "Week Starting" >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK) GROUP BY "Employee", "Board", "Week Starting"`;

const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
const time = (v: unknown) => { const t = Date.parse(String(v ?? "").replace(/,/g, "")); return Number.isNaN(t) ? -Infinity : t; };
const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);

function filter<T extends Row>(rows: T[], emp: string, board: string): T[] {
  return rows.filter((r) => (!emp || r.Employee === emp) && (!board || r.Board === board));
}

function personRow(ord: number, name: string, rows: Row[]): Row {
  const s = (c: string) => rows.reduce((t, r) => t + n(r[c]), 0);
  if (!rows.length) { // like SQL: totals over no cards are empty, not zero
    const empty: Row = { Ord: ord, Employee: name };
    for (const k of ["Completed", "L4W", "ThisWeek", "OnTime", "Late", "NoDue", "OnTimePct", "OnTimeL4W", "LateL4W", "NoDueL4W", "OnTimeL4WPct",
      "Open", "NotOverdue", "Over0to7", "Over7", "VeryOld", "Overdue", "Stale", "AvgDays", "AsOf"]) empty[k] = null;
    return empty;
  }
  const days = s("DaysSum"), daysN = s("DaysN");
  const asOf = rows.reduce<Row[string]>((m, r) => (time(r.AsOf) > time(m) ? r.AsOf : m), null);
  const l4w = s("Completed Last 4 Weeks"), onL4w = s("On Time Last 4 Weeks"), lateL4w = s("Late Last 4 Weeks");
  return {
    Ord: ord, Employee: name, Completed: s("Completed"), L4W: l4w, ThisWeek: s("Completed This Week"),
    OnTime: s("On Time"), Late: s("Late"), NoDue: s("No Due Date"), OnTimePct: pct(s("On Time"), s("Scored On Time")),
    OnTimeL4W: onL4w, LateL4W: lateL4w, NoDueL4W: l4w - onL4w - lateL4w, OnTimeL4WPct: pct(onL4w, onL4w + lateL4w),
    Open: s("Open"), NotOverdue: s("Not Overdue"), Over0to7: s("Overdue Up To 7 Days"), Over7: s("Overdue Over 7 Days"),
    VeryOld: s("Very Old Overdue"), Overdue: s("All Overdue"), Stale: s("Stale"),
    AvgDays: daysN > 0 ? Math.round((10 * days) / daysN) / 10 : null, AsOf: asOf,
  };
}

function groupBy(rows: Row[], key: string): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of rows) { const k = String(r[key] ?? ""); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
  return m;
}

export function epPeople(base: Row[], emp: string, board: string): Row[] {
  const rows = filter(base, emp, board);
  const people = [...groupBy(rows, "Employee")].map(([name, rs]) => personRow(1, name, rs))
    .sort((a, b) => n(b.Completed) - n(a.Completed));
  return [personRow(0, "All employees", rows), ...people];
}

export function epBoard(base: Row[], emp: string, board: string): Row[] {
  return [...groupBy(filter(base, emp, board), "Board")].map(([name, rs]) => ({
    Board: name, Open: rs.reduce((t, r) => t + n(r.Open), 0),
    Overdue: rs.reduce((t, r) => t + n(r["All Overdue"]), 0), NotOverdue: rs.reduce((t, r) => t + n(r["Not Overdue"]), 0),
  })).sort((a, b) => b.Open - a.Open);
}

export function epWeek(weeks: Row[], emp: string, board: string): Row[] {
  return [...groupBy(filter(weeks, emp, board), "Week")].map(([wk, rs]) => ({
    Week: wk, OnTime: rs.reduce((t, r) => t + n(r.OnTime), 0), Late: rs.reduce((t, r) => t + n(r.Late), 0),
    NoDue: rs.reduce((t, r) => t + n(r.NoDue), 0), Completed: rs.reduce((t, r) => t + n(r.Completed), 0),
  })).sort((a, b) => time(a.Week) - time(b.Week));
}

export function epOptions(base: Row[]): Row[] {
  const count = (key: string) => [...groupBy(base, key)].map(([name, rs]) => ({ Name: name, Cards: rs.reduce((t, r) => t + n(r.Cards), 0) }));
  const sort = (a: { Name: string }, b: { Name: string }) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0);
  return [
    ...count("Board").sort(sort).map((r) => ({ Kind: "Board", ...r })),
    ...count("Employee").sort(sort).map((r) => ({ Kind: "Employee", ...r })),
  ];
}
