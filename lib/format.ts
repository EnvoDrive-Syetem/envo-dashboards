export type Row = Record<string, string | number | null>;

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/^[A-Z]{3}\s*/, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function money(v: unknown): string {
  const n = num(v);
  if (n === null) return "—";
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e5) return `${s}$${Math.round(a / 1e3)}k`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}k`;
  return `${s}$${Math.round(a)}`;
}
export const smoney = (v: unknown) => { const n = num(v); return n === null ? "—" : (n > 0 ? "+" : "") + money(n); };
export const pct = (v: unknown) => { const n = num(v); return n === null ? "—" : `${Math.round(n)}%`; };
export const pct1 = (v: unknown) => { const n = num(v); return n === null ? "—" : `${n.toFixed(1)}%`; };
export const spct = (v: unknown) => { const n = num(v); return n === null ? "—" : (n > 0 ? "+" : "") + `${Math.round(n)}%`; };
export const int = (v: unknown) => { const n = num(v); return n === null ? "—" : Math.round(n).toLocaleString("en-CA"); };

export type Tone = "ok" | "warn" | "bad" | "";
export function tone(status: unknown): Tone {
  const s = String(status || "").toLowerCase();
  if (s === "on track" || s === "green") return "ok";
  if (s === "at risk" || s === "yellow" || s === "orange") return "warn";
  if (s === "off track" || s === "red") return "bad";
  return "";
}
export const toneColor = (t: Tone) => (t ? `var(--${t})` : "var(--muted-mark)");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m: number) => MONTHS[m - 1] || String(m);

/** Zoho dates come as "25 May, 2026 00:00:00", "2026/11/01" or "2026-11-12 00:00:00.0". */
export function parseDate(v: unknown): Date | null {
  const s = String(v || "").trim();
  let m = s.match(/^(\d{1,2}) ([A-Za-z]{3}), (\d{4})/);
  if (m) { const mo = MONTHS.indexOf(m[2]); return mo < 0 ? null : new Date(Date.UTC(+m[3], mo, +m[1])); }
  m = s.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return null;
}
export const fmtDay = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
export const fmtMonth = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
export const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Rough text width in px for 12px system UI text (good enough for label gutters). */
export const textW = (s: string) => Math.ceil(s.length * 6.4);
