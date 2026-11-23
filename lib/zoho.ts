// Server-only: runs a SQL query against Zoho Analytics and returns rows.
// Uses a Zoho "self client" refresh token kept in Vercel environment variables.

const ACCOUNTS = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";
const API = process.env.ZOHO_ANALYTICS_API_URL || "https://analyticsapi.zoho.com";
const ORG = process.env.ZOHO_ANALYTICS_ORG_ID || "712029089";
const WORKSPACE = process.env.ZOHO_ANALYTICS_WORKSPACE_ID || "2350577000000005001";
const CACHE_MINUTES = Number(process.env.CACHE_MINUTES || 15);
const MAX_PARALLEL = 4; // Zoho allows 5 export jobs per org at once; leave one for others.
const MAX_STALE_HOURS = 24; // older results are still shown instantly while a fresh copy loads

export type Row = Record<string, string | number | null>;
export type Result = { columns: string[]; rows: Row[]; fetchedAt: string };

// ---- access token -------------------------------------------------------
// Shared on globalThis so every copy of this file uses one token. Zoho limits
// how often a token can be refreshed, so refreshing per copy can get blocked.
const T = ((globalThis as unknown as { __envoToken?: { token: { value: string; expires: number } | null; promise: Promise<string> | null } })
  .__envoToken ||= { token: null, promise: null });

async function accessToken(): Promise<string> {
  if (T.token && T.token.expires > Date.now() + 60_000) return T.token.value;
  if (T.promise) return T.promise;
  T.promise = (async () => {
    const body = new URLSearchParams({
      refresh_token: need("ZOHO_REFRESH_TOKEN"),
      client_id: need("ZOHO_CLIENT_ID"),
      client_secret: need("ZOHO_CLIENT_SECRET"),
      grant_type: "refresh_token",
    });
    const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, { method: "POST", body });
    const json = await res.json();
    if (!json.access_token) throw new Error(`Zoho token refresh failed: ${json.error || res.status}`);
    T.token = { value: json.access_token, expires: Date.now() + (json.expires_in || 3600) * 1000 };
    return T.token.value;
  })().finally(() => { T.promise = null; });
  return T.promise;
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

async function zget(path: string): Promise<Response> {
  return fetch(`${API}/restapi/v2${path}`, {
    headers: { Authorization: `Zoho-oauthtoken ${await accessToken()}`, "ZANALYTICS-ORGID": ORG },
    cache: "no-store",
  });
}

// ---- shared state -------------------------------------------------------
// Next.js loads this file more than once (for pages and for the start-up hook),
// so the limiter and cache live on globalThis to be shared by all copies.
type State = {
  running: number; waiting: (() => void)[];
  cache: Map<string, { at: number; result: Result }>; inflight: Map<string, Promise<Result>>;
};
const G = globalThis as unknown as { __envoZoho?: State };
const S: State = (G.__envoZoho ||= { running: 0, waiting: [], cache: new Map(), inflight: new Map() });

// ---- concurrency limit --------------------------------------------------
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  while (S.running >= MAX_PARALLEL) await new Promise<void>((r) => S.waiting.push(r));
  S.running++;
  try { return await fn(); } finally { S.running--; S.waiting.shift()?.(); }
}

// ---- export job ---------------------------------------------------------
async function runExport(sql: string): Promise<string> {
  const config = encodeURIComponent(JSON.stringify({ sqlQuery: sql, responseFormat: "csv" }));
  // Zoho refuses new jobs while 5 are running for the organization (anyone's),
  // so try again a few times with growing pauses before giving up.
  let jobId: string | undefined, why = "";
  for (let attempt = 0; attempt < 5 && !jobId; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, [0, 1000, 2000, 4000, 6000][attempt]));
    const start = await zget(`/bulk/workspaces/${WORKSPACE}/data?CONFIG=${config}`);
    const startJson = await start.json().catch(() => ({}));
    jobId = startJson?.data?.jobId;
    why = startJson?.data?.errorMessage || `HTTP ${start.status}`;
    if (!jobId && start.status === 401) break;
  }
  if (!jobId) throw new Error(`Zoho did not start the export: ${why}`);

  // Check often at first (most jobs finish in 1-3 s), then back off a little.
  // The hourly GitHub job can wait longer: giving up early leaves the job running
  // in Zoho, where it keeps one of the organization's few export slots busy.
  const maxWait = process.env.GITHUB_ACTIONS ? 600_000 : 55_000;
  for (let i = 0, waited = 0; waited < maxWait; i++) {
    const pause = i < 10 ? 400 : 1000;
    await new Promise((r) => setTimeout(r, pause));
    waited += pause;
    const st = await zget(`/bulk/workspaces/${WORKSPACE}/exportjobs/${jobId}`);
    const code = String((await st.json())?.data?.jobCode || "");
    if (code === "1004") {
      const dl = await zget(`/bulk/workspaces/${WORKSPACE}/exportjobs/${jobId}/data`);
      // Zoho answers 400 instead of an empty file when a query has no rows
      // (e.g. an employee with no cards in the period): treat that as empty.
      if (dl.status === 400) return "";
      if (!dl.ok) throw new Error(`Zoho download failed: ${dl.status}`);
      return await dl.text();
    }
    if (code === "1003" || code === "1005") throw new Error("Zoho reported an error running this query");
  }
  throw new Error("Zoho export did not finish in time");
}

// ---- CSV ---------------------------------------------------------------
export function parseCsv(text: string): { columns: string[]; rows: Row[] } {
  text = text.replace(/^﻿/, "");
  const table: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); table.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f !== "" || row.length) { row.push(f); table.push(row); }
  const columns = table[0] || [];
  const rows = table.slice(1).filter((r) => r.length === columns.length).map((r) => {
    const o: Row = {};
    columns.forEach((k, j) => {
      const v = r[j];
      o[k] = v === "" ? null : /^-?[\d,]*\.?\d+(e[-+]?\d+)?$/i.test(v) && !/^0\d/.test(v) ? Number(v.replace(/,/g, "")) : v;
    });
    return o;
  });
  return { columns, rows };
}

// ---- cache --------------------------------------------------------------
// Fresh results (younger than CACHE_MINUTES) are returned as they are.
// Older ones are still returned straight away, and a fresh copy is fetched in
// the background for the next viewer, so nobody waits on Zoho for a stale page.
const cache = S.cache;
const inflight = S.inflight;
const MAX_ENTRIES = 400;

function refresh(sql: string): Promise<Result> {
  const pending = inflight.get(sql);
  if (pending) return pending;
  const p = slot(async () => {
    const csv = await runExport(sql);
    const result = { ...parseCsv(csv), fetchedAt: new Date().toISOString() };
    cache.delete(sql);
    cache.set(sql, { at: Date.now(), result });
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    return result;
  }).finally(() => inflight.delete(sql));
  inflight.set(sql, p);
  return p;
}

export async function query(sql: string, fresh = false): Promise<Result> {
  const hit = cache.get(sql);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (!fresh && hit && age < CACHE_MINUTES * 60_000) return hit.result;
  if (!fresh && hit && age < MAX_STALE_HOURS * 3_600_000) {
    refresh(sql).catch((e) => console.error("[background refresh]", e));
    return hit.result;
  }
  return refresh(sql);
}

/** Fetch a query only if it isn't fresh in the cache (used by the warm-up). */
export async function warmOne(sql: string): Promise<"cached" | "loaded"> {
  const hit = cache.get(sql);
  if (hit && Date.now() - hit.at < (CACHE_MINUTES - 3) * 60_000) return "cached";
  await refresh(sql);
  return "loaded";
}
