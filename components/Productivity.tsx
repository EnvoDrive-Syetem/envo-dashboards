"use client";
import { useState } from "react";
import { useData } from "./useData";
import { Select, Tile, useReload } from "./ui";
import { HBars, Columns, Legend, ChartState } from "./charts";
import { int, pct, num, parseDate, fmtDay } from "@/lib/format";

const ON = "var(--c1)", LATE = "var(--warn)", NODUE = "var(--muted-mark)";

export function Productivity() {
  const reload = useReload();
  const [p, setP] = useState({ ep_emp: "", ep_board: "" });
  const people = useData("ep_people", p, reload);
  const week = useData("ep_week", p, reload);
  const board = useData("ep_board", p, reload);
  const options = useData("ep_options", {}, reload);


  const all = people.rows.find((r) => r.Employee === "All employees");
  const persons = people.rows.filter((r) => r.Employee !== "All employees");
  const k = (key: string) => (all ? all[key] : null);
  const names = (kind: string) => options.rows.filter((r) => r.Kind === kind).map((r) => String(r.Name));
  const asOf = all?.AsOf ? String(all.AsOf).slice(0, 10) : "—";

  return (
    <section className="panel">
      <h2>Employee productivity</h2>
      <p className="sub">Cards on the Zoho Connect team boards, the same data as the Employee Productivity dashboard in Zoho Analytics. Data as of <b>{asOf}</b>; it refreshes when the task upload runs.</p>
      <div className="filters">
        <Select label="Employee" value={p.ep_emp} onChange={(x) => setP({ ep_emp: x, ep_board: "" })}
          options={[{ value: "", label: "All employees" }, ...names("Employee").map((n) => ({ value: n, label: n }))]} />
        <Select label="Board" value={p.ep_board} onChange={(x) => setP({ ep_emp: "", ep_board: x })}
          options={[{ value: "", label: "All boards" }, ...names("Board").map((n) => ({ value: n, label: n }))]} />
      </div>
      <ChartState status={people.status} error={people.error} />
      <div className="tiles">
        <Tile label="Cards completed, last 4 weeks" big={int(k("L4W"))} note={<><b>{int(k("ThisWeek"))}</b> this week · <b>{int(k("Completed"))}</b> all time</>} />
        <Tile label="On time, last 4 weeks" big={pct(k("OnTimeL4WPct"))} note={<><b>{pct(k("OnTimePct"))}</b> all time. Cards with a due date only.</>} />
        <Tile label="Open cards" big={int(k("Open"))} note={<><b>{int(k("Stale"))}</b> stale</>} />
        <Tile label="Overdue cards" big={int(k("Overdue"))} tone={(num(k("Overdue")) || 0) > 0 ? "warn" : ""} note={<><b>{int(k("Over7"))}</b> over 7 days late · <b>{int(k("VeryOld"))}</b> very old</>} />
        <Tile label="Average time to close" big={num(k("AvgDays")) === null ? "—" : `${num(k("AvgDays"))!.toFixed(1)} days`} note="From received to completed" />
      </div>

      <div className="block">
        <h3>Cards completed per week</h3>
        <Legend items={[{ name: "On time", color: ON }, { name: "Late", color: LATE }, { name: "No due date", color: NODUE }]} />
        <ChartState status={week.status} error={week.error} empty={week.status === "ok" && !week.rows.length} />
        {week.status === "ok" && week.rows.length > 0 && <Columns label="Cards completed per week, split into on time, late and no due date"
          parts={[{ name: "On time", color: ON }, { name: "Late", color: LATE }, { name: "No due date", color: NODUE }]}
          cols={week.rows.map((r) => ({ label: (() => { const d = parseDate(r.Week); return d ? fmtDay(d) : String(r.Week); })(), values: [num(r.OnTime) || 0, num(r.Late) || 0, num(r.NoDue) || 0] }))} />}
      </div>

      <div className="grid2">
        <div className="block">
          <h3>Completed per employee, last 4 weeks</h3>
          <Legend items={[{ name: "On time", color: ON }, { name: "Late", color: LATE }, { name: "No due date", color: NODUE }]} />
          {people.status === "ok" && <HBars label="Cards each employee completed in the last 4 weeks"
            parts={[{ name: "On time", color: ON }, { name: "Late", color: LATE }, { name: "No due date", color: NODUE }]}
            rows={persons.filter((r) => num(r.L4W)).sort((a, b) => (num(b.L4W) || 0) - (num(a.L4W) || 0))
              .map((r) => ({ label: String(r.Employee), values: [num(r.OnTimeL4W) || 0, num(r.LateL4W) || 0, num(r.NoDueL4W) || 0] }))} />}
        </div>
        <div className="block">
          <h3>Workload now: open cards per employee</h3>
          <Legend items={[{ name: "Not overdue", color: "var(--ok)" }, { name: "Up to 7 days late", color: "var(--warn)" }, { name: "Over 7 days late", color: "var(--bad)" }, { name: "Very old", color: "var(--old)" }]} />
          {people.status === "ok" && <HBars label="Open cards per employee by how late they are"
            parts={[{ name: "Not overdue", color: "var(--ok)" }, { name: "Up to 7 days late", color: "var(--warn)" }, { name: "Over 7 days late", color: "var(--bad)" }, { name: "Very old", color: "var(--old)" }]}
            rows={persons.filter((r) => num(r.Open)).sort((a, b) => (num(b.Open) || 0) - (num(a.Open) || 0))
              .map((r) => ({ label: String(r.Employee), values: [num(r.NotOverdue) || 0, num(r.Over0to7) || 0, num(r.Over7) || 0, num(r.VeryOld) || 0] }))} />}
        </div>
      </div>

      <div className="block">
        <h3>Open cards by team board</h3>
        <Legend items={[{ name: "Overdue", color: "var(--bad)" }, { name: "Not overdue", color: "var(--ok)" }]} />
        <ChartState status={board.status} error={board.error} />
        {board.status === "ok" && <HBars label="Open cards per team board, overdue part first"
          parts={[{ name: "Overdue", color: "var(--bad)" }, { name: "Not overdue", color: "var(--ok)" }]}
          rows={board.rows.filter((r) => num(r.Open)).map((r) => ({ label: String(r.Board), values: [num(r.Overdue) || 0, num(r.NotOverdue) || 0] }))} />}
      </div>

      <div className="block scroll">
        <h3>Employee scorecard</h3>
        <table className="table">
          <thead><tr><th>Employee</th><th className="num">Done, 4 wks</th><th className="num">On time, 4 wks</th><th className="num">Done, all time</th><th className="num">On time, all time</th><th className="num">Open</th><th className="num">Overdue</th><th className="num">Stale</th><th className="num">Avg days to close</th></tr></thead>
          <tbody>{[...(all ? [all] : []), ...persons].map((r) => <tr key={String(r.Employee)} className={r === all ? "total" : ""}>
            <td>{String(r.Employee)}</td><td className="num">{int(r.L4W)}</td><td className="num">{pct(r.OnTimeL4WPct)}</td><td className="num">{int(r.Completed)}</td>
            <td className="num">{pct(r.OnTimePct)}</td><td className="num">{int(r.Open)}</td><td className="num">{int(r.Overdue)}</td><td className="num">{int(r.Stale)}</td>
            <td className="num">{num(r.AvgDays) === null ? "—" : num(r.AvgDays)!.toFixed(1)}</td></tr>)}</tbody>
        </table>
      </div>

      <details className="foot">
        <summary>How these are counted</summary>
        <ul>
          <li>Source: EP Card Metrics in Zoho Analytics, one row per card per employee from the Employee Tasks (Connect API) table. A card shared by two people counts once for each.</li>
          <li>On time, late, overdue, very old and stale follow the EP Card Metrics definitions. Cards with no due date count as completed but are left out of the on-time rate.</li>
        </ul>
      </details>
    </section>
  );
}
