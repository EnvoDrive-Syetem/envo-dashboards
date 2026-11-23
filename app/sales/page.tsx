"use client";
import { Shell } from "@/components/ui";
import { SalesHealth } from "@/components/SalesHealth";
import { SalesTrend, ArAging } from "@/components/sections";

export default function SalesPage() {
  return (
    <Shell>
      <header className="head">
        <h1>Sales</h1>
        <p className="sub">Net sales against the FY27 Commit and Stretch plans, by channel, product line and product; the monthly trend; and dealer receivables.</p>
      </header>
      <SalesHealth showProducts />
      <div className="grid2">
        <SalesTrend />
        <ArAging />
      </div>
    </Shell>
  );
}
