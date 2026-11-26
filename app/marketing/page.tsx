"use client";
import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/ui";

// The weekly marketing report is a self-contained page in public/marketing-report/.
// It is a weekly snapshot (Shopify, Google/Meta/TikTok ads, GA4, Klaviyo, Zoho CRM),
// not part of the hourly Zoho Analytics update. Replace report-data.js each week.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function MarketingPage() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(1200);
  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    let ro: ResizeObserver | null = null;
    const fit = () => {
      const doc = f.contentDocument;
      if (!doc?.body) return;
      setH(doc.documentElement.scrollHeight + 4);
      if (!ro) { ro = new ResizeObserver(() => setH(doc.documentElement.scrollHeight + 4)); ro.observe(doc.body); }
    };
    f.addEventListener("load", fit);
    fit();
    return () => { f.removeEventListener("load", fit); ro?.disconnect(); };
  }, []);
  return (
    <Shell>
      <iframe
        ref={ref}
        src={`${BASE}/marketing-report/`}
        title="Weekly marketing report"
        style={{ width: "100%", height: h, border: 0, display: "block", background: "transparent" }}
      />
    </Shell>
  );
}
