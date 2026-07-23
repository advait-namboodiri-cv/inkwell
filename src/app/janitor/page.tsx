"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { formatBytes, timeAgo } from "@/lib/format";

type JDoc = {
  id: string;
  name: string;
  path: string;
  last_modified: number;
  size_bytes: number;
  page_count: number;
};
type Report = {
  stale: JDoc[];
  staleTotal: number;
  dupes: { name: string; docs: JDoc[] }[];
  orphans: JDoc[];
};

function Row({
  doc,
  checked,
  onToggle,
}: {
  doc: JDoc;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2 border-b border-line last:border-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-[var(--accent)] w-4 h-4 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] truncate">{doc.name}</div>
        <div className="text-xs text-faint truncate">{doc.path}</div>
      </div>
      <div className="text-xs text-graphite text-right shrink-0">
        <div>{timeAgo(doc.last_modified)}</div>
        <div className="text-faint">
          {doc.page_count} pg · {formatBytes(doc.size_bytes)}
        </div>
      </div>
    </li>
  );
}

export default function JanitorPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sort, setSort] = useState<"oldest" | "largest">("oldest");

  const load = useCallback(async () => {
    const res = await fetch(`/api/janitor?sort=${sort}`);
    if (res.ok) setReport(await res.json());
  }, [sort]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const count = selected.size;
  const selectedBytes = useMemo(() => {
    if (!report) return 0;
    const all = [
      ...report.stale,
      ...report.orphans,
      ...report.dupes.flatMap((g) => g.docs),
    ];
    const seen = new Set<string>();
    let sum = 0;
    for (const d of all) {
      if (selected.has(d.id) && !seen.has(d.id)) {
        seen.add(d.id);
        sum += d.size_bytes;
      }
    }
    return sum;
  }, [report, selected]);

  async function remove() {
    setRemoving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/janitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error ?? "something went wrong");
      } else {
        const ok = data.results.filter((r: { ok: boolean }) => r.ok).length;
        const failed = data.results.length - ok;
        setNotice(
          `${ok} archived to the vault and removed${failed ? ` · ${failed} failed` : ""}`
        );
        setSelected(new Set());
        await load();
      }
    } finally {
      setRemoving(false);
      setConfirming(false);
    }
  }

  return (
    <main className="page-fade flex-1 flex flex-col items-center px-6 py-16">
      <Header />
      <section className="w-full max-w-2xl flex flex-col gap-6">
        {!report ? (
          <p className="text-faint text-center">surveying the library…</p>
        ) : (
          <>
            <div className="bg-card border border-line rounded-2xl px-6 py-4 shadow-soft flex items-center justify-between gap-4">
              <p className="text-sm text-graphite">
                everything removed here is first archived to a local vault, nothing
                is ever unrecoverable
              </p>
              {count > 0 &&
                (confirming ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={remove}
                      disabled={removing}
                      className="bg-danger text-paper text-sm rounded-full px-4 py-2 disabled:opacity-40"
                    >
                      {removing ? "removing…" : `yes, remove ${count}`}
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      disabled={removing}
                      className="text-sm text-graphite px-2"
                    >
                      cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    className="bg-ink text-paper text-sm rounded-full px-4 py-2 shrink-0"
                  >
                    archive &amp; remove {count} ({formatBytes(selectedBytes)})
                  </button>
                ))}
            </div>
            {notice && (
              <p className="text-sm text-accent-deep bg-accent-mist rounded-xl px-4 py-3">
                {notice}
              </p>
            )}

            <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft">
              <div className="flex items-baseline justify-between mb-2 gap-3">
                <h2 className="text-sm text-graphite">stale · untouched 6+ months</h2>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-faint">{report.staleTotal} total · top 100 by</span>
                  {(["oldest", "largest"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSort(s)}
                      className={`rounded-full px-2.5 py-1 transition-colors ${
                        sort === s
                          ? "bg-accent-mist text-accent-deep"
                          : "text-graphite hover:text-ink"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <ul>
                {report.stale.map((d) => (
                  <Row
                    key={d.id}
                    doc={d}
                    checked={selected.has(d.id)}
                    onToggle={() => toggle(d.id)}
                  />
                ))}
              </ul>
            </div>

            <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft">
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm text-graphite">duplicate names</h2>
                <span className="text-xs text-faint">{report.dupes.length} groups</span>
              </div>
              {report.dupes.length === 0 ? (
                <p className="text-sm text-faint">none, tidy library</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {report.dupes.map((g) => (
                    <div key={g.name}>
                      <div className="text-xs text-accent-deep mb-1">{g.name}</div>
                      <ul>
                        {g.docs.map((d) => (
                          <Row
                            key={d.id}
                            doc={d}
                            checked={selected.has(d.id)}
                            onToggle={() => toggle(d.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft">
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm text-graphite">orphans · folder no longer exists</h2>
                <span className="text-xs text-faint">{report.orphans.length}</span>
              </div>
              {report.orphans.length === 0 ? (
                <p className="text-sm text-faint">none, every doc has a home</p>
              ) : (
                <ul>
                  {report.orphans.map((d) => (
                    <Row
                      key={d.id}
                      doc={d}
                      checked={selected.has(d.id)}
                      onToggle={() => toggle(d.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
