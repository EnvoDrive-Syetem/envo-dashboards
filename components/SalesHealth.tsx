"use client";
import { useState } from "react";
import { useData } from "./useData";
import { Panel, Select, Tile, opts, useReload } from "./ui";
import { LineChart, Legend, Bullets, GapBars, ChartState } from "./charts";
import { money, smoney, pct, spct, tone, num, parseDate, fmtDay, type Row } from "@/lib/format";

const C = { a: "var(--c1)", c: "var(--c2)", s: "var(--c3)", m: "var(--muted-mark)" };

export function SalesHealth({ showProducts = false }: { showProducts?: boolean }) {
  const reload = useReload();
  const [p, setP] = useState({ hperiod: "Month to date", hchannel: "All channels", hline: "All lines" });
  const summary = useData("hx_summary", p, reload);
  const health = useData("hx_health", p, reload);
  const traj = useData("hx_traj", p, reload);

  const v = summary.rows.find((r) => Number(r.LineOrder) === 1);
  const t = v ? tone(v.Status) : "";
  const empty = summary.status === "ok" && !summary.rows.length;
  const level = (l: string) => health.rows.filter((r) => r.Level === l);
  const k = (key: string) => (v ? v[key] : null);

  const trajRows = traj.rows.map((r) => ({ ...r, x: parseDate(r.Date)?.getTime() })).filter((r) => r.x) as (Row & { x: number })[];
  const s = (name: string, key: string, color: string, dash?: string, width?: number) =>
    ({ name, color, dash, width, points: trajRows.map((r) => ({ x: r.x, y: num(r[key]) })) });

  return (
    <Panel id="sales-health" title="Sales vs plan, FY27"
      sub="The same numbers as Haseeb's Sales Health FY27 – Executive dashboard in Zoho Analytics. Green, orange and red follow its On track, At risk and Off track rules.">
      <div className="filters">
        <Select label="Period" value={p.hperiod} options={opts(["Month to date", "Quarter to date", "FY to date"])} onChange={(x) => setP({ ...p, hperiod: x })} />
        <Select label="Focus channel" value={p.hchannel} options={opts(["All channels", "B2B", "B2C", "Costco"])} onChange={(x) => setP({ ...p, hchannel: x })} />
        <Select label="Focus line" value={p.hline} options={opts(["All lines", "E-Bikes", "LEV", "Parts, shipping and other", "UPT"])} onChange={(x) => setP({ ...p, hline: x })} />
      </div>
      <ChartState status={summary.status} error={summary.error} />
      {empty && <p className="note">There is no plan for this channel and product line together. Pick another combination.</p>}
      {v && <>
        <p className="verdict">{String(v.Verdict)}</p>
        <p className="sub">Days counted: {String(k("Counted") ?? "—")} (to yesterday, Vancouver time).</p>
        <div className="tiles">
          <Tile label="Net sales" big={money(k("Actual"))} tone={t} note={<>Commit for the same days: <b>{money(k("Commit"))}</b></>} />
          <Tile label="% of Commit" big={pct(k("Pct"))} tone={t} note={<>Gap: <b>{smoney(k("Gap"))}</b></>} />
          <Tile label="Landing at this pace" big={money(k("Landing"))} note={<>Full-period Commit: <b>{money(k("FullCommit"))}</b></>} />
          <Tile label="vs last year, same days" big={spct(k("VsLY"))} note={<>Last year: <b>{money(k("LastYear"))}</b></>} />
          <Tile label="Stretch score" big={pct(k("StretchScore"))} note="70% of Stretch counts as success" />
          <Tile label="Commit still ahead" big={money(k("Ahead"))} note={<><b>{String(k("DaysLeft") ?? "—")}</b> days left in the period</>} />
          <Tile label="On plan" big={<span className="onplan">
            <span><b>{String(k("ChOn") ?? "—")}</b> of {String(k("ChWith") ?? "—")} channels</span>
            <span><b>{String(k("LnOn") ?? "—")}</b> of {String(k("LnWith") ?? "—")} product lines</span>
            <span><b>{String(k("PrOn") ?? "—")}</b> of {String(k("PrWith") ?? "—")} products</span></span>} />
        </div>

        <div className="block">
          <h3>Cumulative net sales against plan</h3>
          <Legend items={[{ name: "Actual", color: C.a }, { name: "At this pace", color: C.a, dash: true }, { name: "Commit plan", color: C.c },
            { name: "Stretch plan", color: C.s, dash: true }, { name: "Last year", color: C.m, dash: true }]} />
          <ChartState status={traj.status} error={traj.error} />
          {traj.status === "ok" && <LineChart height={280} label="Cumulative net sales against the Commit and Stretch plans, last year and the current pace"
            xFmt={(x) => fmtDay(new Date(x))}
            series={[s("Last year", "LastYear", C.m, "2 3", 1.5), s("Stretch plan", "StretchPlan", C.s, "6 4", 1.5), s("Commit plan", "CommitPlan", C.c, undefined, 2),
              s("At this pace", "Pace", C.a, "4 3", 2), s("Actual", "Actual", C.a, undefined, 3)]} />}
        </div>

        <div className="grid2">
          {(["Channel", "Product line"] as const).map((l) => (
            <div key={l}>
              <h3>{l === "Channel" ? "Channels" : "Product lines"}: are they on track?</h3>
              <Legend items={[{ name: "Commit for the same days", color: "var(--fg)", tick: true }]} />
              <ChartState status={health.status} error={health.error} />
              {health.status === "ok" && <Bullets label={`Net sales against Commit by ${l.toLowerCase()}`}
                rows={level(l).filter((r) => num(r.HasPlan) || num(r.Actual)).sort((a, b) => (num(b.Actual) || 0) - (num(a.Actual) || 0))} />}
            </div>
          ))}
        </div>

        {showProducts && health.status === "ok" && <ProductGaps rows={level("Product")} />}

        <div className="block">
          <h3>Why, in words</h3>
          <ol className="why">{summary.rows.filter((r) => r.Verdict && Number(r.LineOrder) > 1).map((r) => <li key={String(r.Line)}>{String(r.Verdict)}</li>)}</ol>
        </div>
      </>}
    </Panel>
  );
}

function ProductGaps({ rows }: { rows: Row[] }) {
  const sorted = rows.slice().sort((a, b) => (num(a.Gap) || 0) - (num(b.Gap) || 0));
  return <>
    <div className="block">
      <h3>Products: gap to Commit, biggest shortfall first</h3>
      <GapBars label="Gap to Commit by product, biggest shortfall first" rows={sorted.filter((r) => num(r.Gap))} />
    </div>
    <div className="block scroll">
      <table className="table">
        <thead><tr><th>Product</th><th>Line</th><th className="num">Net sales</th><th className="num">Commit</th><th className="num">Gap</th><th className="num">% of Commit</th><th className="num">vs last year</th><th>Status</th></tr></thead>
        <tbody>{sorted.map((r) => <tr key={String(r.Name)}>
          <td>{String(r.Name)}</td><td>{String(r.Group)}</td><td className="num">{money(r.Actual)}</td><td className="num">{money(r.Commit)}</td>
          <td className={`num${(num(r.Gap) || 0) < 0 ? " neg" : ""}`}>{smoney(r.Gap)}</td><td className="num">{pct(r.Pct)}</td><td className="num">{spct(r.VsLY)}</td>
          <td><span className={`pill ${tone(r.Status)}`}>{String(r.Status)}</span></td></tr>)}</tbody>
      </table>
    </div>
  </>;
}
