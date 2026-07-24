"use client";

import { useRef, useState } from "react";

type Doc = { id: string; name: string; path: string; page_count: number; file_type: string };
type Result = {
  summary: string;
  provider: string;
  model: string;
  cached: boolean;
  costCents: number;
};

export default function SummarizeCard() {
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [picked, setPicked] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  async function run(doc: Doc) {
    setPicked(doc);
    setDocs([]);
    setQ("");
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.id }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "something went wrong");
      else setResult(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
      <div>
        <h2 className="text-sm text-graphite">summarize a document</h2>
        <p className="text-xs text-faint mt-1 leading-relaxed">
          a short, grounded ai summary of any text based doc
        </p>
      </div>
      <div className="relative">
        <input
          value={q}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="search your library…"
          spellCheck={false}
          className="w-full bg-paper border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors placeholder:text-faint"
        />
        {docs.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-card border border-line rounded-xl shadow-lift overflow-hidden">
            {docs.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => run(d)}
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

      {busy && picked && (
        <p className="text-sm text-faint">reading “{picked.name}” and writing a summary…</p>
      )}
      {error && <p className="text-danger text-sm">{error}</p>}
      {result && picked && !busy && (
        <div className="flex flex-col gap-2">
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap border-l-2 border-accent pl-4">
            {result.summary}
          </div>
          <p className="text-xs text-faint">
            {picked.name} · {result.provider === "local" ? "local model, free" : `${result.model}, ${result.costCents < 1 ? "<1¢" : `${result.costCents.toFixed(1)}¢`}`}
            {result.cached ? " · from cache" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
