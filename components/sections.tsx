"use client";
import { useMemo, useState } from "react";
import { useData, type DataState } from "./useData";
import { Panel, Select, Tile, Toggle, useReload } from "./ui";
import { LineChart, Legend, Columns, HBars, ChartState } from "./charts";
import { money, pct1, num, tone, parseDate, fmtMonth, monthName, int, type Row } from "@/lib/format";

// ---------- scorecard rows (Haseeb's Scorecard 01–06) ----------
export const scoreRow = (d: DataState, no: number) => d.rows.find((r) => Number(r.No) === no) || null;
export const attention = (rows: Row[]) => rows.filter((r) => r.Status === "Red" || r.Status === "Yellow").length;
export function detail(r: Row | null) {
  if (!r) return "—";
  return `${r.Status ? r.Status + ". " : ""}Goal: ${r.Goal || "not set"}. Owner: ${r.Owner || "—"}.`;
}

// ---------- gross margin by month ----------
export function GmChart() {
  const d = useData("gm_month", {}, useReload());
  const pts = d.rows.map((r) => ({ x: parseDate(r.Month)?.getTime(), y: num(r.GM) })).filter((p) => p.x && p.y !== null) as { x: number; y: number }[];
  pts.sort((a, b) => a.x - b.x);
  return (
    <Panel id="gm" title="Gross margin by month">
      <Legend items={[{ name: "Gross margin %", color: "var(--c1)" }, { name: "40% goal", color: "var(--muted-mark)", dash: true }]} />
      <ChartState status={d.status} error={d.error} />
      {d.status === "ok" && <LineChart label="Gross margin percent by month against the 40% goal" height={240}
        xFmt={(x) => fmtMonth(new Date(x))} yFmt={(v) => `${Math.round(v)}%`}
        series={[{ name: "40% goal", color: "var(--muted-mark)", dash: "4 4", width: 1.5, points: pts.map((p) => ({ x: p.x, y: 40 })) },
          { name: "Gross margin", color: "var(--c1)", width: 2.5, points: pts }]} />}
      <p className="note">From the Books ledger. The latest month is not locked and can still move.</p>
    </Panel>
  );
}

// ---------- profit by sales channel ----------
const NAMES: Record<string, string> = { B2B: "B2B", Retail: "B2C", Costco: "Costco", Unallocated: "Unallocated", "All channels": "All channels" };
import { presets } from "@/lib/datakey";
const fmtLong = (s: string) => { const d = parseDate(s); return d ? d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—"; };

export function ChannelProfit() {
  const reload = useReload();
  const pr = useMemo(presets, []);
  const [range, setRange] = useState({ start: pr.last12.start, end: pr.last12.end });
  const [preset, setPreset] = useState("last12");
  const [channel, setChannel] = useState("");
  const [measure, setMeasure] = useState("Revenue");
  const d = useData("ch_profit_period", range, reload);
  const yoy = useData("ch_sales_yoy", {}, reload);

  const row = (ch: string) => d.rows.find((r) => r.Channel === ch) || null;
  const all = row("All channels");
  const lead = d.rows.filter((r) => ["B2B", "Retail", "Costco"].includes(String(r.Channel)) && num(r.NetProfit) !== null)
    .reduce<Row | null>((a, b) => (!a || (num(b.NetProfit)! > num(a.NetProfit)!) ? b : a), null);
  const tableRows = channel ? d.rows.filter((r) => r.Channel === channel) : d.rows;
  const y = new Date().getFullYear(), years = [y - 2, y - 1, y];
  const yearColor = ["var(--muted-mark)", "var(--c2)", "var(--c1)"];
  const chans = (channel ? [channel] : ["B2B", "Retail", "Costco"]);


  return (
    <Panel id="channel-profit" title="Profit by sales channel" sub={`${fmtLong(range.start)} to ${fmtLong(range.end)}`}>
      <div className="filters">
        <Select label="Channel" value={channel} onChange={setChannel}
          options={[{ value: "", label: "All channels" }, { value: "B2B", label: "B2B" }, { value: "Retail", label: "B2C" }, { value: "Costco", label: "Costco" }]} />
        <Select label="Period" value={preset} onChange={(k) => { setPreset(k); if (pr[k]) setRange({ start: pr[k].start, end: pr[k].end }); }}
          options={Object.entries(pr).map(([k, v]) => ({ value: k, label: v.label }))} />
      </div>
      <ChartState status={d.status} error={d.error} />
      {d.status === "ok" && <>
        {!channel && all && <p className="take">All channels together made <b>{money(all.NetProfit)}</b> net profit on <b>{money(all.Revenue)}</b> of revenue in this period. <b>{lead ? NAMES[String(lead.Channel)] : "—"}</b> made the most net profit.</p>}
        <div className="tiles">
          {chans.map((ch) => { const r = row(ch); const np = num(r?.NetProfit);
            return <Tile key={ch} label={`${NAMES[ch]} net profit`} big={money(np)} tone={np === null ? "" : np >= 0 ? "ok" : "bad"}
              note={<><b>{pct1(r?.NetMargin)}</b> net margin · <b>{money(r?.Revenue)}</b> revenue · <b>{pct1(r?.GM)}</b> gross margin</>} />; })}
        </div>
        <div className="scroll">
          <table className="table">
            <thead><tr><th>Channel</th><th className="num">Revenue</th><th className="num">Gross profit</th><th className="num">Gross margin</th><th className="num">Operating expense</th><th className="num">Other (non-operating)</th><th className="num">Net profit</th><th className="num">Net margin</th></tr></thead>
            <tbody>{tableRows.map((r) => <tr key={String(r.Channel)} className={r.Channel === "All channels" ? "total" : r.Channel === "Unallocated" ? "muted" : ""}>
              <td>{NAMES[String(r.Channel)] || String(r.Channel)}</td><td className="num">{money(r.Revenue)}</td><td className="num">{money(r.GrossProfit)}</td>
              <td className="num">{pct1(r.GM)}</td><td className="num">{money(r.OpEx)}</td><td className="num">{money(r.Other)}</td>
              <td className={`num${(num(r.NetProfit) || 0) < 0 ? " neg" : ""}`}>{money(r.NetProfit)}</td>
              <td className={`num${(num(r.NetMargin) || 0) < 0 ? " neg" : ""}`}>{pct1(r.NetMargin)}</td></tr>)}</tbody>
          </table>
        </div>
      </>}

      <div className="panel-head sub-head">
        <h2>By month: this year vs the last two</h2>
        <Toggle label="Measure" value={measure} onChange={setMeasure}
          options={[{ value: "Revenue", label: "Sales" }, { value: "GrossProfit", label: "Gross profit" }, { value: "NetProfit", label: "Net profit" }]} />
      </div>
      <Legend items={years.map((yr, i) => ({ name: String(yr) + (i === 2 ? " (through last full month)" : ""), color: yearColor[i] }))} />
      <ChartState status={yoy.status} error={yoy.error} />
      {yoy.status === "ok" && <div className="grid3">
        {chans.map((ch) => <div key={ch}>
          <h3>{NAMES[ch]}</h3>
          <LineChart height={220} label={`${measure} by month for ${NAMES[ch]}, ${years.join(", ")} compared`} xFmt={(m) => monthName(m)}
            xLabels={[1, 3, 5, 7, 9, 11]}
            series={years.map((yr, i) => ({ name: String(yr), color: yearColor[i], width: i === 2 ? 2.5 : 1.75,
              points: yoy.rows.filter((r) => r.Channel === ch && Number(r.Yr) === yr && num(r[measure]) !== null)
                .map((r) => ({ x: Number(r.Mo), y: num(r[measure]) })).sort((a, b) => a.x - b.x) })).filter((s) => s.points.length)} />
        </div>)}
      </div>}
      <p className="note">The monthly charts compare whole calendar years through the last full month, so the period filter doesn&apos;t change them; the channel filter does. B2C is the channel the model calls Retail. Figures come from Haseeb&apos;s Channel Profitability model in Zoho Analytics (Channel PL Qry): operating expense is spread across channels by its allocation rules, and costs it doesn&apos;t assign to a channel, mostly non-operating items such as interest and exchange losses, sit in Unallocated. Sales here are booked income in that model, so they can differ from the Commit tracker. The latest month is not locked and can still move.</p>
    </Panel>
  );
}

// ---------- net sales trend by channel ----------
export function SalesTrend() {
  const d = useData("sales_trend", {}, useReload());
  const months = Array.from(new Set(d.rows.map((r) => `${r.Y}-${String(r.M).padStart(2, "0")}`))).sort();
  const val = (ym: string, ch: string) => num(d.rows.find((r) => `${r.Y}-${String(r.M).padStart(2, "0")}` === ym && r.Channel === ch)?.NetSales) || 0;
  const parts = [{ name: "B2C", color: "var(--c1)" }, { name: "B2B", color: "var(--c2)" }, { name: "Costco", color: "var(--c3)" }];
  return (
    <Panel id="trend" title="Net sales by channel, by month">
      <Legend items={parts} />
      <ChartState status={d.status} error={d.error} empty={d.status === "ok" && !d.rows.length} />
      {d.status === "ok" && d.rows.length > 0 && <Columns label="Net sales by channel by month" height={260} fmt={money}
        parts={parts} cols={months.map((ym) => ({ label: `${monthName(+ym.slice(5))} ${ym.slice(2, 4)}`, values: parts.map((p) => val(ym, p.name)) }))} />}
      <p className="note">Net revenue from the Monthly Net Revenue by Channel query. The current month runs to yesterday; returns can make a month negative for a channel.</p>
    </Panel>
  );
}

// ---------- receivables by age ----------
export function ArAging() {
  const d = useData("ar_aging", {}, useReload());
  const total = d.rows.reduce((a, r) => a + (num(r.Open) || 0), 0);
  const past = d.rows.reduce((a, r) => a + (num(r.PastDue) || 0), 0);
  return (
    <Panel id="ar" title="Dealer receivables by age">
      <ChartState status={d.status} error={d.error} />
      {d.status === "ok" && <>
        <p className="take"><b>{money(total)}</b> open, of which <b>{money(past)}</b> is past due.</p>
        <HBars label="Open receivables by age bucket" fmt={money}
          parts={[{ name: "Open balance", color: "var(--c1)" }]}
          sideNote={(i) => `${money(d.rows[i].Open)} · ${int(d.rows[i].Invoices)} invoices`}
          rows={d.rows.map((r) => ({ label: String(r.Bucket).replace(/^\d /, ""), values: [num(r.Open) || 0] }))} />
      </>}
      <p className="note">From the AR Aging Summary query. Goal on the CEO page: under $150k over 60 days.</p>
    </Panel>
  );
}

export { tone };
