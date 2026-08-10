"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";

// fetches the page svg, inlines it, and redraws every stroke in the exact
// order it was written — rmc emits strokes in drawing order, so document
// order IS the order your hand moved. pacing scales with total ink length
// so any page replays in about eight seconds.
function StrokeReplay({ src, runId, onFail }: { src: string; runId: number; onFail: () => void }) {
  const holder = useRef<HTMLDivElement>(null);

  const run = useCallback(() => {
    const root = holder.current?.querySelector("svg");
    if (!root) return;
    root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    const marks = [...root.querySelectorAll<SVGGeometryElement>("path, polyline, line")];
    const lens = marks.map((el) => {
      try {
        return el.getTotalLength();
      } catch {
        return 0;
      }
    });
    const total = lens.reduce((a, b) => a + b, 0) || 1;
    const speed = Math.max(total / 8, 900); // svg units per second
    let at = 0;
    marks.forEach((el, i) => {
      const len = lens[i];
      const dur = Math.max((len / speed) * 1000, 30);
      const stroked = el.getAttribute("stroke") && el.getAttribute("stroke") !== "none";
      if (stroked && len > 0) {
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
        el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
          delay: at,
          duration: dur,
          easing: "linear",
          fill: "forwards",
        });
      } else {
        // filled marks (highlighter blocks) fade in at their moment instead
        el.style.opacity = "0";
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          delay: at,
          duration: Math.max(dur, 200),
          easing: "ease-out",
          fill: "forwards",
        });
      }
      at += dur;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error();
        const text = await res.text();
        const svg = new DOMParser()
          .parseFromString(text, "image/svg+xml")
          .querySelector("svg");
        if (!svg) throw new Error();
        if (!alive || !holder.current) return;
        svg.querySelectorAll("script").forEach((s) => s.remove());
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.style.width = "100%";
        svg.style.height = "auto";
        holder.current.replaceChildren(svg);
        run();
      } catch {
        if (alive) onFail();
      }
    })();
    return () => {
      alive = false;
    };
    // runId re-triggers the whole fetch-and-draw for "replay again"
  }, [src, runId, run, onFail]);

  return (
    <div
      ref={holder}
      className="w-full border border-line rounded-xl bg-white overflow-hidden"
    />
  );
}

type Day = { day: string; docs: number; pages: number };
type DayDoc = {
  id: string;
  name: string;
  path: string;
  hash: string;
  current: boolean;
  pages: { id: string; index: number }[];
};

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toLowerCase();
}

export default function TimeMachinePage() {
  const [days, setDays] = useState<Day[] | null>(null);
  const [picked, setPicked] = useState<string>("");
  const [docs, setDocs] = useState<DayDoc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; label: string; note: string } | null>(
    null
  );
  const [previewFailed, setPreviewFailed] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayRun, setReplayRun] = useState(0);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const tz = new Date().getTimezoneOffset();
      const res = await fetch(`/api/days?tz=${tz}`);
      if (res.ok) setDays((await res.json()).days);
    })();
    // arriving from a heatmap dot: ?day=YYYY-MM-DD opens that day right away
    const day = new URLSearchParams(window.location.search).get("day");
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) void openDay(day);
  }, []);

  async function openDay(day: string) {
    if (!day) return;
    setPicked(day);
    setDocs(null);
    setPreview(null);
    setPreviewFailed(false);
    setRestored(null);
    setError(null);
    setBusy(true);
    try {
      const tz = new Date().getTimezoneOffset();
      const res = await fetch(`/api/day?date=${day}&tz=${tz}`);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "something went wrong");
      else setDocs(data.docs);
    } finally {
      setBusy(false);
    }
  }

  async function restore(doc: DayDoc) {
    setRestoring(doc.id);
    setRestored(null);
    setError(null);
    try {
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.id, hash: doc.hash, dayLabel: dayLabel(picked) }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "restore failed");
      else
        setRestored(
          `“${data.name}” (${data.pages} pages) sent to the ${data.folder} folder on your tablet`
        );
    } finally {
      setRestoring(null);
    }
  }

  return (
    <main className="page-fade flex-1 flex flex-col items-center px-6 py-16">
      <Header />
      <section className="w-full max-w-5xl flex flex-col gap-6">
        <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm text-graphite">time machine</h2>
              <p className="text-xs text-faint mt-1">
                git for handwriting. pick a day, see everything you wrote.
              </p>
            </div>
            <input
              type="date"
              value={picked}
              onChange={(e) => openDay(e.target.value)}
              className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>
          {days === null ? (
            <p className="text-faint text-sm">loading your writing days…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {days.slice(0, 21).map((d) => (
                <button
                  key={d.day}
                  onClick={() => openDay(d.day)}
                  className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                    picked === d.day
                      ? "bg-accent-mist border-accent text-accent-deep"
                      : "border-line text-graphite hover:border-accent hover:text-accent-deep"
                  }`}
                >
                  {dayLabel(d.day)}
                  <span className="opacity-60 ml-1.5">{d.pages} pg</span>
                </button>
              ))}
            </div>
          )}
          {busy && <p className="text-sm text-faint">reading {dayLabel(picked)}…</p>}
          {error && <p className="text-danger text-sm">{error}</p>}
          {restored && (
            <p className="text-sm text-accent-deep bg-accent-mist rounded-xl px-4 py-3">
              {restored}
            </p>
          )}
        </div>

        {docs && (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="flex flex-col gap-6">
              {docs.length === 0 && (
                <p className="text-faint text-sm text-center py-6">
                  no writing recorded on {dayLabel(picked)}
                </p>
              )}
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] truncate">{doc.name}</h3>
                      <p className="text-xs text-faint truncate">{doc.path}</p>
                    </div>
                    <span className="text-xs text-graphite shrink-0">
                      {doc.pages.length} page{doc.pages.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.pages.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPreview({
                            src: `/api/page-svg?docId=${doc.id}&hash=${doc.hash}&pageId=${p.id}`,
                            label: `${doc.name} · p. ${p.index}`,
                            note: doc.current
                              ? "as it looks today (no snapshot existed back then)"
                              : "from the snapshot closest to that day",
                          });
                          setPreviewFailed(false);
                          setReplaying(false);
                        }}
                        className="text-xs border border-line rounded-full px-2.5 py-1 text-graphite hover:border-accent hover:text-accent-deep transition-colors"
                      >
                        p. {p.index || "?"}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-faint">
                      {doc.current
                        ? "previews show today's ink"
                        : `previews from snapshot ${doc.hash.slice(0, 7)}`}
                    </span>
                    <button
                      onClick={() => restore(doc)}
                      disabled={restoring === doc.id}
                      className="text-xs border border-line rounded-full px-3 py-1.5 text-graphite hover:border-accent hover:text-accent-deep transition-colors disabled:opacity-40"
                    >
                      {restoring === doc.id
                        ? "rebuilding…"
                        : "send this version to tablet as pdf"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft md:sticky md:top-6">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-sm text-graphite">
                  {preview ? preview.label : "page preview"}
                </h2>
                {preview && !previewFailed && (
                  <button
                    onClick={() => {
                      setReplaying(true);
                      setReplayRun((n) => n + 1);
                    }}
                    className="shrink-0 flex items-center gap-1.5 text-xs bg-accent text-white rounded-full px-3 py-1.5 hover:bg-accent-deep transition-colors"
                  >
                    <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
                      <path d="M1 1 L8 5 L1 9 Z" fill="currentColor" />
                    </svg>
                    {replaying ? "replay again" : "replay the strokes"}
                  </button>
                )}
              </div>
              {preview && !previewFailed && (
                <p className="text-xs text-faint mb-3">
                  {replaying ? "in the exact order your hand drew them" : preview.note}
                </p>
              )}
              {!preview && <p className="text-sm text-faint mt-2">click a page to see its ink</p>}
              {preview && previewFailed && (
                <p className="text-sm text-faint mt-2">
                  nothing to render, this page has no ink strokes
                </p>
              )}
              {preview &&
                !previewFailed &&
                (replaying ? (
                  <StrokeReplay
                    src={preview.src}
                    runId={replayRun}
                    onFail={() => setPreviewFailed(true)}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={preview.src}
                    src={preview.src}
                    alt={preview.label}
                    onError={() => setPreviewFailed(true)}
                    className="w-full h-auto border border-line rounded-xl bg-white"
                  />
                ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
