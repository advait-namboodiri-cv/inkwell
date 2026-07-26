"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CensusCard, { type Census } from "./CensusCard";
import ShelfCard, { type ShelfItem } from "./ShelfCard";
import HeatmapCard, { type HeatData } from "./HeatmapCard";
import HighlightsCard, { type HighlightsData } from "./HighlightsCard";
import InkStats from "./InkStats";
import { timeAgo } from "@/lib/format";

const STALE_MS = 5 * 60 * 1000; // auto-sync if older than this; also the poll cadence

type Backfill = {
  running: boolean;
  done: number;
  total: number;
  currentDoc: string | null;
  failed: number;
};

export default function Dashboard({ user }: { user: string }) {
  const [inkOpen, setInkOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [census, setCensus] = useState<Census | null>(null);
  const [shelf, setShelf] = useState<ShelfItem[] | null>(null);
  const [heat, setHeat] = useState<HeatData | null>(null);
  const [hl, setHl] = useState<HighlightsData | null>(null);
  const [backfill, setBackfill] = useState<Backfill | null>(null);
  const syncingRef = useRef(false);
  const backfillWatchRef = useRef(false);

  const loadCards = useCallback(async () => {
    const tz = new Date().getTimezoneOffset();
    const [c, s, h, g] = await Promise.all([
      fetch("/api/census"),
      fetch("/api/shelf"),
      fetch(`/api/heatmap?tz=${tz}`),
      fetch("/api/highlights"),
    ]);
    if (c.ok) setCensus(await c.json());
    if (s.ok) setShelf((await s.json()).shelf);
    if (h.ok) setHeat(await h.json());
    if (g.ok) setHl(await g.json());
  }, []);

  // kick the bundle backfill and watch it until it finishes,
  // refreshing the heatmap as new pages land
  const watchBackfill = useCallback(async () => {
    if (backfillWatchRef.current) return;
    backfillWatchRef.current = true;
    try {
      const res = await fetch("/api/backfill", { method: "POST" });
      if (!res.ok) return;
      let state: Backfill = await res.json();
      setBackfill(state);
      let tick = 0;
      while (state.running) {
        await new Promise((r) => setTimeout(r, 4000));
        state = await (await fetch("/api/backfill")).json();
        setBackfill(state);
        tick += 1;
        if (tick % 4 === 0) {
          const tz = new Date().getTimezoneOffset();
          const h = await fetch(`/api/heatmap?tz=${tz}`);
          if (h.ok) setHeat(await h.json());
          void fetch("/api/highlights", { method: "POST" }); // scan what's landed
        }
      }
      await fetch("/api/highlights", { method: "POST" });
      await loadCards();
    } finally {
      backfillWatchRef.current = false;
    }
  }, [loadCards]);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "sync failed");
      } else {
        setSyncedAt(data.lastSyncedAt);
        await loadCards();
        void watchBackfill();
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [loadCards, watchBackfill]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/sync");
      const state = await res.json();
      if (cancelled) return;
      setSyncedAt(state.lastSyncedAt ?? 0);
      if (state.lastSyncedAt) {
        await loadCards();
        void watchBackfill();
      }
      if (!state.lastSyncedAt || Date.now() - state.lastSyncedAt > STALE_MS) {
        await sync();
      }
    })();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") sync();
    }, STALE_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sync, loadCards, watchBackfill]);

  return (
    <section className="w-full max-w-6xl flex flex-col gap-6">
      <div className="bg-card border border-line rounded-2xl px-6 py-4 shadow-soft flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-accent-deep">
            <span aria-hidden className="w-2 h-2 rounded-full bg-accent inline-block" />
            connected
          </div>
          <p className="mt-0.5 text-graphite text-sm">{user}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-faint">
            {syncing ? "listening to the tablet…" : `synced ${timeAgo(syncedAt)}`}
          </span>
          <button
            onClick={sync}
            disabled={syncing}
            className="text-sm border border-line rounded-full px-4 py-1.5 text-graphite hover:border-accent hover:text-accent-deep transition-colors disabled:opacity-40"
          >
            sync now
          </button>
        </div>
      </div>

      {error && (
        <p className="text-danger text-sm bg-danger-soft rounded-xl px-4 py-3">{error}</p>
      )}

      {census === null && shelf === null ? (
        <p className="text-faint text-center py-8">
          {syncing ? "taking the first census of your library…" : "loading…"}
        </p>
      ) : (
        <>
          {heat && (heat.totals.events > 0 || backfill?.running) && (
            <HeatmapCard data={heat} />
          )}
          {backfill?.running && (
            <p className="text-xs text-faint text-center -mt-2">
              reading your pages… {backfill.done} of {backfill.total} documents
              {backfill.failed > 0 ? ` · ${backfill.failed} skipped` : ""}
            </p>
          )}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {census && <CensusCard census={census} />}
            {shelf && <ShelfCard shelf={shelf} />}
            {hl && <HighlightsCard data={hl} />}
          </div>

          <button
            onClick={() => setInkOpen((v) => !v)}
            aria-expanded={inkOpen}
            className="group w-full text-left bg-card border border-line rounded-2xl px-6 py-5 shadow-soft hover:shadow-lift transition-shadow flex items-center gap-4"
          >
            <span className="ink-bob text-ink" aria-hidden>
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                <path
                  d="M17.2 6.4 C 13.6 10.2 11.9 13.3 12 15.9 C 12.1 18.2 13.8 19.9 16.1 19.9 C 18.4 19.9 20 18.2 20 15.9 C 20 13.4 19.1 10.1 17.2 6.4 Z"
                  fill="currentColor"
                />
                <path
                  d="M9.2 24.6 C 13 26.4 19 26.2 23.4 23.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="flex-1">
              <span className="block text-[15px]">ink stats</span>
              <span className="block text-xs text-faint mt-0.5">
                kilometers of ink · pen strokes · pressure · your pens
              </span>
            </span>
            <span
              className={`text-faint transition-transform duration-500 ${inkOpen ? "rotate-180" : ""}`}
              aria-hidden
            >
              ▾
            </span>
          </button>
          <div
            className={`grid transition-all duration-700 ease-in-out ${
              inkOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 -mt-6"
            }`}
          >
            <div className="overflow-hidden">{inkOpen && <InkStats />}</div>
          </div>
        </>
      )}
    </section>
  );
}
