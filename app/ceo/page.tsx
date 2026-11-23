"use client";
import Link from "next/link";
import { Shell, Fetched, useReload } from "@/components/ui";
import { useData } from "@/components/useData";
import { GmChart, attention } from "@/components/sections";
import { ChartState } from "@/components/charts";
import { tone, type Row } from "@/lib/format";

const RANK: Record<string, number> = { Red: 3, Yellow: 2, Green: 1 };
const CARDS = [
  { no: 1, title: "Sales", link: "/sales" },
  { no: 2, title: "Profit", link: "/coo#gm" },
  { no: 3, title: "Cash & Inventory", link: "/sales#ar" },
];

function Overview() {
  const d = useData("ceo_numbers", {}, useReload());
  const n = attention(d.rows);
  return <>
    <header className="head">
      <h1>Company (CEO)</h1>
      {d.status === "ok" && <p className="take">{n === 0 ? "Every rated number is on track." : <><b>{n}</b> of the rated numbers need attention today.</>}</p>}
      <p className="sub">Each number uses the status rule from Haseeb&apos;s Scorecard tables in Zoho Analytics. Grey means there is no goal or no value yet.</p>
    </header>
    <ChartState status={d.status} error={d.error} />
    {d.status === "ok" && <div className="cards">
      {CARDS.map((c) => {
        const rows = d.rows.filter((r) => Number(r.CardNo) === c.no).sort((a, b) => Number(a.No) - Number(b.No));
        const worst = rows.reduce<string>((w, r) => ((RANK[String(r.Status)] || 0) > (RANK[w] || 0) ? String(r.Status) : w), "");
        return <section key={c.no} className={`card${tone(worst) ? " is-" + tone(worst) : ""}`}>
          <h2>{c.title}</h2>
          {rows.map((r: Row) => <div key={String(r.No)} className="metric">
            <div className="metric-top"><span className="label">{String(r.Number)}</span><span className={`pill ${tone(r.Status)}`}>{String(r.Status || "—")}</span></div>
            <div className="big">{String(r.Shown ?? "—")}</div>
            <div className="note">Goal: {String(r.Goal || "not set")} · {String(r.Period || "")} · Owner: {String(r.Owner || "—")}</div>
            {r.Detail && <div className="note">{String(r.Detail)}</div>}
          </div>)}
          <Link className="more" href={c.link}>Details →</Link>
        </section>;
      })}
    </div>}
    <GmChart />
    <Fetched at={d.fetchedAt} demo={d.demo} />
  </>;
}

export default function CeoPage() {
  return (
    <Shell>
      <Overview />
    </Shell>
  );
}
