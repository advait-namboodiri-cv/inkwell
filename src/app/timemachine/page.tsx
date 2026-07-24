"use client";

import { useRef, useState } from "react";
import Header from "@/components/Header";
import { formatBytes, timeAgo } from "@/lib/format";

type Doc = { id: string; name: string; path: string; page_count: number };
type Version = {
  hash: string;
  capturedAt: number;
  sizeBytes: number;
  pageCount: number;
  added: number;
  removed: number;
  changed: number;
  changedPages: { id: string; index: number }[];
};

export default function TimeMachinePage() {
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onQuery(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    if (value.trim().length < 2) {
      setDocs([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/docs?q=${encodeURIComponent(value.trim())}`);
      if (res.ok) setDocs((await res.json()).docs);
    }, 250);
  }

  async function open(d: Doc) {
    setDoc(d);
    setDocs([]);
    setQ("");
    setVersions(null);
    setPreview(null);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/timemachine?docId=${d.id}`);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "something went wrong");
      else setVersions(data.versions);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-fade flex-1 flex flex-col items-center px-6 py-16">
      <Header />
      <section className="w-full max-w-4xl flex flex-col gap-6">
        <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
          <div>
            <h2 className="text-sm text-graphite">time machine</h2>
            <p className="text-xs text-faint mt-1">git for handwriting</p>
          </div>
          <div className="relative">
            <input
              value={q}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="pick a notebook…"
              spellCheck={false}
              className="w-full bg-paper border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors placeholder:text-faint"
            />
            {docs.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 bg-card border border-line rounded-xl shadow-lift overflow-hidden">
                {docs.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => open(d)}
                      className="w-full text-left px-4 py-2.5 hover:bg-accent-mist transition-colors"
                    >
                      <span className="text-sm block truncate">{d.name}</span>
                      <span className="text-xs text-faint block truncate">
                        {d.path} · {d.page_count} pg
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {busy && doc && <p className="text-sm text-faint">reading {doc.name}&apos;s history…</p>}
          {error && <p className="text-danger text-sm">{error}</p>}
        </div>

        {doc && versions && (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm text-graphite truncate">{doc.name}</h2>
                <span className="text-xs text-faint shrink-0">
                  {versions.length} snapshot{versions.length === 1 ? "" : "s"}
                </span>
              </div>
              {versions.length === 0 ? (
                <p className="text-sm text-faint">
                  no snapshots yet, sync once and this doc&apos;s history starts recording
                </p>
              ) : (
                <ul className="flex flex-col">
                  {versions.map((v, i) => (
                    <li
                      key={v.hash}
                      className="py-3 border-b border-line last:border-0 flex flex-col gap-1.5"
                    >
                      <div className="flex items-baseline gap-3">
                        <code className="text-xs text-accent-deep bg-accent-mist rounded px-1.5 py-0.5">
                          {v.hash.slice(0, 7)}
                        </code>
                        <span className="text-sm">{timeAgo(v.capturedAt)}</span>
                        <span className="text-xs text-faint ml-auto shrink-0">
                          {v.pageCount} pg · {formatBytes(v.sizeBytes)}
                        </span>
                      </div>
                      <div className="text-xs text-graphite">
                        {i === versions.length - 1
                          ? "first snapshot"
                          : [
                              v.added > 0 ? `+${v.added} page${v.added === 1 ? "" : "s"}` : "",
                              v.removed > 0 ? `−${v.removed}` : "",
                              v.changed > 0 ? `${v.changed} changed` : "",
                            ]
                              .filter(Boolean)
                              .join(" · ") || "no page changes"}
                      </div>
                      {v.changedPages.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {v.changedPages.map((p) => (
                            <button
                              key={p.id}
                              onClick={() =>
                                setPreview({
                                  src: `/api/page-svg?docId=${doc.id}&hash=${v.hash}&pageId=${p.id}`,
                                  label: `p. ${p.index} at ${v.hash.slice(0, 7)}`,
                                })
                              }
                              className="text-xs border border-line rounded-full px-2.5 py-1 text-graphite hover:border-accent hover:text-accent-deep transition-colors"
                            >
                              p. {p.index}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft md:sticky md:top-6">
              <h2 className="text-sm text-graphite mb-3">
                {preview ? preview.label : "page preview"}
              </h2>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.src}
                  alt={preview.label}
                  className="w-full h-auto border border-line rounded-xl bg-white"
                />
              ) : (
                <p className="text-sm text-faint">
                  click a changed page to see the ink as it was in that snapshot
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
