"use client";
import { Shell, Tile, Fetched, useReload } from "@/components/ui";
import { useData } from "@/components/useData";
import { GmChart, ChannelProfit, scoreRow, detail, attention } from "@/components/sections";
import { SalesHealth } from "@/components/SalesHealth";
import { ChartState } from "@/components/charts";
import { tone } from "@/lib/format";

function Overview() {
  const d = useData("ceo_numbers", {}, useReload());
  const rows = d.rows.filter((r) => [1, 2, 4, 6].includes(Number(r.No)));
  const n = attention(rows);
  const tile = (no: number, label: string, href: string) => {
    const r = scoreRow(d, no);
    return <Tile label={label} big={String(r?.Shown ?? "—")} note={detail(r)} tone={tone(r?.Status)} href={href} />;
  };
  return <>
    <header className="head">
      <h1>Operations (COO)</h1>
      {d.status === "ok" && <p className="take">{n === 0 ? "Every rated area under the COO is on track." : <><b>{n}</b> of the rated areas under the COO need attention today.</>}</p>}
      <p className="sub">Owner: Chief Operating Officer (Haseeb). Each tile uses the status rule from Haseeb&apos;s Scorecard tables.</p>
    </header>
    <ChartState status={d.status} error={d.error} />
    {d.status === "ok" && <div className="tiles">
      {tile(1, "Sales: net sales this month vs Commit", "/sales")}
      {tile(2, "Gross margin, last full month", "#gm")}
      {tile(4, "Receivables over 60 days past due", "/sales#ar")}
      {tile(6, "Inventory value", "")}
    </div>}
    <SalesHealth />
    <GmChart />
    <ChannelProfit />
    <details className="foot">
      <summary>COO KPIs from the org chart that are not on this page yet</summary>
      <ul>
        <li>COO1 perfect order rate and COO3 customer satisfaction: no reliable source yet.</li>
        <li>COO2 cost to serve as a share of net revenue: 3PL and shipping costs sit in static tables that aren&apos;t kept current.</li>
      </ul>
    </details>
    <Fetched at={d.fetchedAt} demo={d.demo} />
  </>;
}

export default function CooPage() {
  return (
    <Shell>
      <Overview />
    </Shell>
  );
}
