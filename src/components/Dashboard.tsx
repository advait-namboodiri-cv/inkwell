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
          <InkStats />
        </>
      )}
    </section>
  );
}
