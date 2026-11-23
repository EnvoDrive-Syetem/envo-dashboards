"use client";
import { useEffect, useState } from "react";
import type { Row } from "@/lib/format";
import { dataKey } from "@/lib/datakey";

export type DataState = { status: "loading" | "ok" | "error"; rows: Row[]; error?: string; fetchedAt?: string; demo?: boolean };

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Reads one pre-built data file (made by the scheduled GitHub job). */
export function useData(id: string, params: Record<string, string> = {}, reload = 0): DataState {
  const [state, setState] = useState<DataState>({ status: "loading", rows: [] });
  const key = dataKey(id, params);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, status: "loading" }));
    fetch(`${BASE}/data/${key}.json?r=${reload}`, { cache: reload ? "reload" : "default" })
      .then(async (r) => {
        if (!live) return;
        if (!r.ok) { setState({ status: "error", rows: [], error: "No data for this selection yet." }); return; }
        const j = await r.json();
        setState({ status: "ok", rows: j.rows || [], fetchedAt: j.fetchedAt, demo: j.demo });
      })
      .catch(() => live && setState({ status: "error", rows: [], error: "Could not load the data." }));
    return () => { live = false; };
  }, [key, reload]);
  return state;
}
