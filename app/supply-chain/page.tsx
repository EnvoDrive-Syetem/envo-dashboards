"use client";
import { useState } from "react";
import { Shell, Panel, Tile, Toggle, Fetched, useReload } from "@/components/ui";
import { useData } from "@/components/useData";
import { scoreRow } from "@/components/sections";
import { HBars, LineChart, Columns, Legend, ChartState } from "@/components/charts";
import { money, int, num, monthName, type Row } from "@/lib/format";

const sum = (rows: Row[], k: string) => rows.reduce((a, r) => a + (num(r[k]) || 0), 0);
function group(rows: Row[], key: string) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(String(r[key]), (m.get(String(r[key])) || 0) + (num(r.StockValue) || 0)));
  return [...m.entries()].map(([label, v]) => ({ label, values: [v] })).sort((a, b) => b.values[0] - a.values[0]);
}
const ym = (r: Row) => Date.UTC(Number(r.Y), Number(r.M) - 1, 1);
const fmtYM = (t: number) => { const d = new Date(t); return `${monthName(d.getUTCMonth() + 1)} ${String(d.getUTCFullYear()).slice(2)}`; };
const STATUS: Record<string, string> = { draft: "Draft", open: "Confirmed, not invoiced", partially_invoiced: "Partly invoiced" };

export default function SupplyChainPage() {
  const reload = useReload();
  const inv = useData("ceo_numbers", {}, reload);
  const stock = useData("sc_stock", {}, reload);
  const fulfil = useData("sc_fulfil", {}, reload);
  const returns = useData("sc_returns", {}, reload);
  const backlog = useData("sc_backlog", {}, reload);
  const [age, setAge] = useState("30");

  const iv = scoreRow(inv, 6);
  const s = stock.rows;
  const warehouses = new Set(s.filter((r) => (num(r.OnHand) || 0) > 0).map((r) => String(r.Warehouse))).size;
  const neg = sum(s, "NegativeLines");
  const now = new Date();
  const fullMonths = fulfil.rows.filter((r) => Number(r.Y) * 12 + Number(r.M) < now.getFullYear() * 12 + now.getMonth() + 1);
  const last = fullMonths[fullMonths.length - 1];
  const bl = backlog.rows.filter((r) => (num(r.DaysOpen) || 0) >= Number(age));
  const byStatus = ["draft", "open", "partially_invoiced"].map((k) => {
    const rows = backlog.rows.filter((r) => r.Status === k);
    return { k, n: rows.length, v: sum(rows, "Value") };
  });

  return (
    <Shell>
      <header className="head">
        <h1>Supply chain</h1>
        {stock.status === "ok" && <p className="take">Inventory on the books is <b>{String(iv?.Shown ?? "—")}</b>. Finished products account for <b>{money(sum(s, "StockValue"))}</b> of it, across <b>{warehouses}</b> warehouses.</p>}
        <p className="sub">Owner: Supply Chain and Logistics Manager (Shayan). Inventory value has no goal yet, so it has no colour until a stock plan is set.</p>
      </header>

      <ChartState status={stock.status} error={stock.error} />
      <div className="tiles">
        <Tile label="Inventory value, books" big={String(iv?.Shown ?? "—")} note={String(iv?.Detail ?? "")} />
        <Tile label="Finished units available for sale" big={int(sum(s, "Available"))} note={<>On hand <b>{int(sum(s, "OnHand"))}</b>, incoming <b>{int(sum(s, "Incoming"))}</b></>} />
        <Tile label="Stock lines below zero" big={int(neg)} tone={stock.status !== "ok" ? "" : neg === 0 ? "ok" : neg <= 10 ? "warn" : "bad"}
          note="Item and warehouse pairs where more is committed than is on hand. Usually a receiving or transfer that hasn't been booked." />
        <Tile label="Average days from order to first shipment" big={last && num(last.AvgDays) !== null ? `${num(last.AvgDays)!.toFixed(1)} days` : "—"}
          note={last ? <>Orders placed in {monthName(Number(last.M))} {String(last.Y)}: <b>{int(last.Orders)}</b> orders, <b>{int(last.NotShipped)}</b> not shipped yet</> : "—"} />
        <Tile label="Orders waiting to be invoiced" big={int(backlog.rows.length)} tone={backlog.rows.some((r) => (num(r.DaysOpen) || 0) > 30) ? "warn" : ""}
          note={<><b>{money(sum(backlog.rows, "Value"))}</b> in draft, confirmed or partly invoiced sales orders</>} />
      </div>

      <div className="grid2">
        <Panel title="Finished-product stock value by warehouse">
          {stock.status === "ok" && <HBars label="Finished-product stock value by warehouse" fmt={money}
            parts={[{ name: "Stock value", color: "var(--c1)" }]} rows={group(s, "Warehouse").filter((r) => r.values[0] > 0)} />}
        </Panel>
        <Panel title="Finished-product stock value by product line">
          {stock.status === "ok" && <HBars label="Finished-product stock value by product line" fmt={money}
            parts={[{ name: "Stock value", color: "var(--c2)" }]} rows={group(s, "Line").filter((r) => r.values[0] > 0)} />}
        </Panel>
      </div>

      <div className="grid2">
        <Panel title="Days from order to first shipment, by month of order"
          sub="Orders not yet shipped are left out of the average, so the latest month looks faster than it will end up.">
          <ChartState status={fulfil.status} error={fulfil.error} />
          {fulfil.status === "ok" && <LineChart label="Average days from order to first shipment by month" height={230}
            xFmt={fmtYM} yFmt={(v) => `${v.toFixed(0)} d`}
            series={[{ name: "Average days", color: "var(--c1)", width: 2.5, points: fulfil.rows.map((r) => ({ x: ym(r), y: num(r.AvgDays) })) }]} />}
        </Panel>
        <Panel title="Approved sales returns by month">
          <Legend items={[{ name: "Received back", color: "var(--c1)" }, { name: "Not received yet", color: "var(--warn)" }]} />
          <ChartState status={returns.status} error={returns.error} />
          {returns.status === "ok" && <Columns label="Approved sales returns by month, split by whether the goods are back" height={230}
            parts={[{ name: "Received back", color: "var(--c1)" }, { name: "Not received yet", color: "var(--warn)" }]}
            cols={returns.rows.map((r) => ({ label: fmtYM(ym(r)), values: [(num(r.Returns) || 0) - (num(r.NotReceived) || 0), num(r.NotReceived) || 0] }))} />}
        </Panel>
      </div>

      <Panel id="backlog" title="Sales orders waiting to be invoiced"
        right={<Toggle label="Age" value={age} onChange={setAge} options={[{ value: "0", label: "All" }, { value: "7", label: "7+ days" }, { value: "30", label: "30+ days" }, { value: "90", label: "90+ days" }]} />}
        sub={backlog.status === "ok" ? byStatus.map((b) => `${STATUS[b.k]}: ${b.n} (${money(b.v)})`).join(" · ") : undefined}>
        <ChartState status={backlog.status} error={backlog.error} />
        {backlog.status === "ok" && <div className="scroll">
          <p className="note">{bl.length} order{bl.length === 1 ? "" : "s"} open {age === "0" ? "of any age" : `${age} days or more`}, oldest first. Very old drafts are often orders that should be voided.</p>
          <table className="table">
            <thead><tr><th>Order</th><th>Ordered</th><th>Status</th><th className="num">Value</th><th>Delivery</th><th className="num">Days open</th></tr></thead>
            <tbody>{bl.slice(0, 200).map((r) => <tr key={String(r.SO)}>
              <td>{String(r.SO)}</td><td>{String(r.OrderDate).slice(0, 10)}</td><td>{STATUS[String(r.Status)] || String(r.Status)}</td>
<td className="num">{money(r.Value)}</td><td>{String(r.Delivery ?? "")}</td>
              <td className={`num${(num(r.DaysOpen) || 0) > 30 ? " neg" : ""}`}>{int(r.DaysOpen)}</td></tr>)}</tbody>
          </table>
        </div>}
      </Panel>

      <Panel title="Stock by product line and warehouse">
        {stock.status === "ok" && <div className="scroll"><table className="table">
          <thead><tr><th>Product line</th><th>Warehouse</th><th className="num">On hand</th><th className="num">Available</th><th className="num">Incoming</th><th className="num">Value</th><th className="num">Lines below zero</th></tr></thead>
          <tbody>{s.map((r) => <tr key={`${r.Line}/${r.Warehouse}`}>
            <td>{String(r.Line)}</td><td>{String(r.Warehouse)}</td><td className="num">{int(r.OnHand)}</td>
            <td className={`num${(num(r.Available) || 0) < 0 ? " neg" : ""}`}>{int(r.Available)}</td><td className="num">{int(r.Incoming)}</td>
            <td className="num">{money(r.StockValue)}</td><td className={`num${(num(r.NegativeLines) || 0) > 0 ? " neg" : ""}`}>{int(r.NegativeLines)}</td></tr>)}</tbody>
        </table></div>}
      </Panel>

      <details className="foot">
        <summary>Where these numbers come from, and what is still missing</summary>
        <ul>
          <li>Inventory value: Scorecard 06 Inventory Value (Books stock accounts).</li>
          <li>Finished-product stock: Main Products Stock by Warehouse Qry (Zoho Inventory), valued at unit cost.</li>
          <li>Days to ship: SO Fulfilment Lead Time (Haseeb). Returns and open orders: the Zoho Inventory tables synced into Zoho Analytics.</li>
          <li>Still to add from the org chart: SC1 on-time in-full, SC2 logistics cost as a share of net revenue, SC3 in-stock rate on top sellers.</li>
        </ul>
      </details>
      <Fetched at={stock.fetchedAt} demo={stock.demo} />
    </Shell>
  );
}
