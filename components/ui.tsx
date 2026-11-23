"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Tone } from "@/lib/format";

// A page-wide "reload" counter: bumping it makes every useData call fetch fresh from Zoho.
const ReloadCtx = createContext<{ n: number; bump: () => void }>({ n: 0, bump: () => {} });
export const useReload = () => useContext(ReloadCtx).n;

const PAGES = [
  { href: "/ceo", label: "CEO" },
  { href: "/coo", label: "COO" },
  { href: "/sales", label: "Sales" },
  { href: "/supply-chain", label: "Supply chain" },
  { href: "/productivity", label: "Productivity" },
];

export function Shell({ children }: { children: ReactNode }) {
  const [n, setN] = useState(0);
  const path = usePathname();
  return (
    <ReloadCtx.Provider value={{ n, bump: () => setN((x) => x + 1) }}>
      <div className="topbar">
        <div className="brand">ENVO <span>dashboards</span></div>
        <nav aria-label="Dashboards">
          {PAGES.map((p) => <Link key={p.href} href={p.href} aria-current={(path === p.href || path === p.href + "/") ? "page" : undefined}>{p.label}</Link>)}
        </nav>
        <div className="who">
          <button type="button" className="ghost" onClick={() => setN((x) => x + 1)} title="Load the latest published numbers">Refresh</button>
        </div>
      </div>
      <main className="page">{children}</main>
    </ReloadCtx.Provider>
  );
}

export function Tile({ label, big, note, tone, children, href }: {
  label: string; big: ReactNode; note?: ReactNode; tone?: Tone; children?: ReactNode; href?: string;
}) {
  return (
    <div className={`tile${tone ? " is-" + tone : ""}`}>
      <div className="label">{label}</div>
      <div className="big">{big}</div>
      {note && <div className="note">{note}</div>}
      {children}
      {href && (href.startsWith("#") ? <a className="more" href={href}>Details ↓</a> : <Link className="more" href={href}>Open →</Link>)}
    </div>
  );
}

export function Select({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <label className="field"><span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
export const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return <div className="tabs" role="tablist">{tabs.map((t) =>
    <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}>{t.label}</button>)}</div>;
}

export function Toggle({ value, options, onChange, label }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; label: string }) {
  return <div className="toggle" role="group" aria-label={label}>{options.map((o) =>
    <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>;
}

export function Panel({ id, title, sub, children, right }: { id?: string; title: string; sub?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="panel" id={id}>
      <div className="panel-head"><h2>{title}</h2>{right}</div>
      {sub && <p className="sub">{sub}</p>}
      {children}
    </section>
  );
}

export function Fetched({ at, demo }: { at?: string; demo?: boolean }) {
  if (!at) return null;
  const d = new Date(at);
  return <p className="fetched">{demo ? "Sample data. " : ""}Numbers from Zoho Analytics as of {d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}. They update about every hour on weekdays.</p>;
}
