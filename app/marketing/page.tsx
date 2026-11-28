"use client";
import { useEffect } from "react";
import { Shell } from "@/components/ui";

// Marketing lives in the marketing team's own "Weekly Marketing Report" on claude.ai,
// so whatever they publish there is what people see. This page just forwards to it.
const REPORT = "https://claude.ai/artifact/H5eKMCj8Tx3cNa2wzefHyL";

export default function MarketingPage() {
  useEffect(() => { window.location.replace(REPORT); }, []);
  return (
    <Shell>
      <p className="sub">Opening the Weekly Marketing Report… If nothing happens, <a href={REPORT}>open it here</a>.</p>
    </Shell>
  );
}
