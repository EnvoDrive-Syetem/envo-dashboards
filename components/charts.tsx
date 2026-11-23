"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { money, smoney, pct, spct, textW, tone, toneColor, num, type Row } from "@/lib/format";

// ---------- helpers ----------
function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) max = min + 1;
  const step0 = (max - min) / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.5; v += step) out.push(+v.toFixed(10));
  return out;
}

function Tip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const left = Math.min(Math.max(0, x - 120), Math.max(0, w - 260));
  return <div className="tip" style={{ left, top: Math.max(0, y - 40) }}>{children}</div>;
}

export function ChartState({ status, error, empty }: { status: string; error?: string; empty?: boolean }) {
  if (status === "loading") return <div className="chart-msg">Loading…</div>;
  if (status === "error") return <div className="chart-msg bad">{error || "Failed to load"}</div>;
  if (empty) return <div className="chart-msg">No data for this selection.</div>;
  return null;
}

// ---------- line chart ----------
export type Series = { name: string; color: string; dash?: string; width?: number; points: { x: number; y: number | null }[] };

export function LineChart({ series, height = 260, xFmt, yFmt = money, label, xLabels }: {
  series: Series[]; height?: number; xFmt: (x: number) => string; yFmt?: (v: number) => string; label: string; xLabels?: number[];
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.points.filter((p) => p.y !== null)) as { x: number; y: number }[];
  if (!all.length) return <div className="chart-msg">No data for this selection.</div>;
  const ys = all.map((p) => p.y), xsAll = all.map((p) => p.x);
  const ticks = niceTicks(Math.min(0, ...ys), Math.max(...ys));
  const ml = Math.max(...ticks.map((t) => textW(yFmt(t)))) + 10, mr = 12, mt = 10, mb = 24;
  const y = scale(ticks[0], ticks[ticks.length - 1], height - mb, mt);
  const x = scale(Math.min(...xsAll), Math.max(...xsAll), ml, w - mr);
  const xs = Array.from(new Set(xsAll)).sort((a, b) => a - b);
  const n = Math.max(2, Math.min(xs.length, Math.floor((w - ml) / 70)));
  const xt = xLabels || xs.filter((_, i) => i % Math.ceil(xs.length / n) === 0);
  const path = (pts: Series["points"]) => {
    let d = "", pen = false;
    for (const p of pts) {
      if (p.y === null) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`; pen = true;
    }
    return d;
  };
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * w;
    setHover(xs.reduce((a, b) => (Math.abs(x(b) - mx) < Math.abs(x(a) - mx) ? b : a), xs[0]));
  };
  const hits = hover === null ? [] : series.map((s) => ({ s, p: s.points.find((q) => q.x === hover && q.y !== null) })).filter((o) => o.p);
  return (
    <div className="chart" ref={ref}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={label}>
        {ticks.map((t) => <g key={t}>
          <line x1={ml} x2={w - mr} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
          <text x={ml - 6} y={y(t) + 4} textAnchor="end">{yFmt(t)}</text>
        </g>)}
        {xt.map((t) => <text key={t} x={x(t)} y={height - 6} textAnchor="middle">{xFmt(t)}</text>)}
        {series.map((s) => <path key={s.name} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={s.width || 2} strokeDasharray={s.dash} strokeLinejoin="round" />)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={mt} y2={height - mb} className="axis" />}
        {hits.map((o) => <circle key={o.s.name} cx={x(hover!)} cy={y(o.p!.y!)} r={3.5} fill={o.s.color} />)}
        <rect x={ml} y={0} width={Math.max(0, w - ml - mr)} height={height} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && <Tip x={x(hover)} y={30} w={w}>
        <b>{xFmt(hover)}</b>{hits.map((o) => <div key={o.s.name}><i style={{ background: o.s.color }} />{o.s.name}: {yFmt(o.p!.y!)}</div>)}
      </Tip>}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; dash?: boolean; tick?: boolean }[] }) {
  return <div className="legend">{items.map((i) =>
    <span key={i.name}><i className={i.tick ? "tick" : i.dash ? "dash" : ""} style={{ borderColor: i.color }} />{i.name}</span>)}</div>;
}

// ---------- bullets: actual bar coloured by status, tick at Commit ----------
export function Bullets({ rows, label }: { rows: Row[]; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(420);
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length) return <div className="chart-msg">Nothing with a plan here.</div>;
  const rh = 34, h = rows.length * rh + 4;
  const lw = Math.max(...rows.map((r) => textW(String(r.Name)))) + 10;
  const vw = Math.max(...rows.map((r) => textW(`${pct(r.Pct)} of Commit`))) + 12;
  const max = Math.max(1, ...rows.map((r) => Math.max(num(r.Actual) || 0, num(r.Commit) || 0)));
  const min = Math.min(0, ...rows.map((r) => num(r.Actual) || 0));
  const x = scale(min, max, lw, w - vw);
  return (
    <div className="chart" ref={ref}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        {rows.map((r, i) => {
          const a = num(r.Actual) || 0, c = num(r.Commit) || 0, cy = i * rh + rh / 2;
          return <g key={String(r.Name)} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <rect x={0} y={i * rh} width={w} height={rh} fill="transparent" />
            <text x={lw - 8} y={cy + 4} textAnchor="end">{String(r.Name)}</text>
            <rect x={lw} y={cy - 9} width={Math.max(0, x(max) - lw)} height={18} rx={2} className="track" />
            <rect x={x(Math.min(0, a))} y={cy - 6} width={Math.max(1, Math.abs(x(a) - x(0)))} height={12} rx={2} fill={toneColor(tone(r.Status))} />
            {c > 0 && <line x1={x(c)} x2={x(c)} y1={cy - 11} y2={cy + 11} className="commit" />}
            <text x={w - vw + 6} y={cy + 4}>{c > 0 ? `${pct(r.Pct)} of Commit` : "No plan"}</text>
          </g>;
        })}
      </svg>
      {hover !== null && (() => { const r = rows[hover]; return <Tip x={x(Math.max(num(r.Actual) || 0, num(r.Commit) || 0))} y={hover * rh + 6} w={w}>
        <b>{String(r.Name)}</b><div>{money(r.Actual)} vs Commit {money(r.Commit)} ({smoney(r.Gap)})</div>
        <div>{r.VsLY !== null ? `${spct(r.VsLY)} vs last year · ` : ""}{String(r.Status)}</div></Tip>; })()}
    </div>
  );
}

// ---------- diverging gap bars ----------
export function GapBars({ rows, label }: { rows: Row[]; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(420);
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length) return <div className="chart-msg">Nothing with a plan here.</div>;
  const rh = 24, h = rows.length * rh + 4;
  const lw = Math.max(...rows.map((r) => textW(String(r.Name)))) + 10;
  const vw = Math.max(...rows.map((r) => textW(smoney(r.Gap)))) + 10;
  const ext = Math.max(1, ...rows.map((r) => Math.abs(num(r.Gap) || 0)));
  const x = scale(-ext, ext, lw + vw, w - vw);
  return (
    <div className="chart" ref={ref}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        <line x1={x(0)} x2={x(0)} y1={0} y2={h} className="axis" />
        {rows.map((r, i) => {
          const g = num(r.Gap) || 0, cy = i * rh + rh / 2;
          return <g key={String(r.Name)} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <rect x={0} y={i * rh} width={w} height={rh} fill="transparent" />
            <text x={lw - 8} y={cy + 4} textAnchor="end">{String(r.Name)}</text>
            <rect x={x(Math.min(0, g))} y={i * rh + 5} width={Math.max(1, Math.abs(x(g) - x(0)))} height={rh - 10} rx={2} fill={g < 0 ? "var(--bad)" : "var(--ok)"} />
            <text x={g < 0 ? x(g) - 6 : x(g) + 6} y={cy + 4} textAnchor={g < 0 ? "end" : "start"}>{smoney(g)}</text>
          </g>;
        })}
      </svg>
      {hover !== null && (() => { const r = rows[hover]; return <Tip x={x(0)} y={hover * rh + 6} w={w}>
        <b>{String(r.Name)}</b> ({String(r.Group)})<div>{money(r.Actual)} vs Commit {money(r.Commit)} · {String(r.Status)}</div></Tip>; })()}
    </div>
  );
}

// ---------- stacked horizontal bars ----------
export type Part = { name: string; color: string };
export function HBars({ rows, parts, label, fmt = (v: number) => String(Math.round(v)), sideNote }: {
  rows: { label: string; values: number[] }[]; parts: Part[]; label: string; fmt?: (v: number) => string; sideNote?: (i: number) => string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>(420);
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length) return <div className="chart-msg">No data for this selection.</div>;
  const rh = 26, h = rows.length * rh + 4;
  const lw = Math.min(220, Math.max(...rows.map((r) => textW(r.label))) + 10);
  const notes = rows.map((r, i) => sideNote ? sideNote(i) : fmt(r.values.reduce((a, b) => a + b, 0)));
  const vw = Math.max(...notes.map(textW)) + 12;
  const max = Math.max(1, ...rows.map((r) => r.values.reduce((a, b) => a + Math.max(0, b), 0)));
  const x = scale(0, max, lw, w - vw);
  return (
    <div className="chart" ref={ref}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        {rows.map((r, i) => {
          let acc = 0; const cy = i * rh + rh / 2;
          return <g key={r.label + i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <rect x={0} y={i * rh} width={w} height={rh} fill="transparent" />
            <text x={lw - 8} y={cy + 4} textAnchor="end">{r.label.length > 32 ? r.label.slice(0, 31) + "…" : r.label}</text>
            {r.values.map((v, j) => { const x0 = x(acc); acc += Math.max(0, v); return v > 0 ?
              <rect key={j} x={x0} y={i * rh + 5} width={Math.max(0, x(acc) - x0 - 1)} height={rh - 10} rx={2} fill={parts[j].color} /> : null; })}
            <text x={x(acc) + 6} y={cy + 4}>{notes[i]}</text>
          </g>;
        })}
      </svg>
      {hover !== null && <Tip x={lw + 40} y={hover * rh + 6} w={w}><b>{rows[hover].label}</b>
        {parts.map((p, j) => <div key={p.name}><i style={{ background: p.color }} />{p.name}: {fmt(rows[hover].values[j])}</div>)}</Tip>}
    </div>
  );
}

// ---------- stacked columns ----------
export function Columns({ cols, parts, label, height = 220, fmt = (v: number) => String(Math.round(v)) }: {
  cols: { label: string; values: number[] }[]; parts: Part[]; label: string; height?: number; fmt?: (v: number) => string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!cols.length) return <div className="chart-msg">No data for this selection.</div>;
  const totals = cols.map((c) => c.values.reduce((a, b) => a + b, 0));
  const lo = Math.min(0, ...cols.flatMap((c) => c.values));
  const ticks = niceTicks(lo, Math.max(1, ...totals), lo < 0 ? 6 : 4);
  const ml = Math.max(...ticks.map((t) => textW(fmt(t)))) + 10, mb = 22, mt = 8;
  const y = scale(ticks[0], ticks[ticks.length - 1], height - mb, mt);
  const bw = (w - ml - 8) / cols.length;
  const every = Math.max(1, Math.ceil(Math.max(...cols.map((c) => textW(c.label))) / (bw * 0.9)));
  return (
    <div className="chart" ref={ref}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={label}>
        {ticks.map((t) => <g key={t}><line x1={ml} x2={w} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
          <text x={ml - 6} y={y(t) + 4} textAnchor="end">{fmt(t)}</text></g>)}
        {cols.map((c, i) => {
          let up = 0, down = 0; const x0 = ml + i * bw + bw * 0.15, cw = bw * 0.7;
          return <g key={c.label + i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <rect x={ml + i * bw} y={0} width={bw} height={height} fill="transparent" />
            {c.values.map((v, j) => {
              if (v >= 0) { const y1 = y(up), y2 = y(up + v); up += v; return <rect key={j} x={x0} y={y2} width={cw} height={Math.max(0, y1 - y2 - (v ? 1 : 0))} fill={parts[j].color} rx={1.5} />; }
              const y1 = y(down), y2 = y(down + v); down += v; return <rect key={j} x={x0} y={y1} width={cw} height={Math.max(0, y2 - y1)} fill={parts[j].color} rx={1.5} />;
            })}
            {i % every === 0 && <text x={x0 + cw / 2} y={height - 6} textAnchor="middle">{c.label}</text>}
          </g>;
        })}
      </svg>
      {hover !== null && <Tip x={ml + hover * bw + bw / 2} y={20} w={w}><b>{cols[hover].label}</b>
        {parts.map((p, j) => <div key={p.name}><i style={{ background: p.color }} />{p.name}: {fmt(cols[hover].values[j])}</div>)}
        {parts.length > 1 && <div>Total: {fmt(totals[hover])}</div>}</Tip>}
    </div>
  );
}
