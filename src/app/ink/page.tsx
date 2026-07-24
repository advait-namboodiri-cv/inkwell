"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

type Report = {
  totals: { strokes: number; points: number; mm: number; pressure: number; docs: number };
  tools: { name: string; n: number }[];
  topDocs: { name: string; strokes: number; distance_mm: number }[];
  scan: { running: boolean; done: number; total: number };
};

function distanceLabel(mm: number): string {
  if (mm >= 1_000_000) return `${(mm / 1_000_000).toFixed(2)} km`;
  if (mm >= 1_000) return `${(mm / 1_000).toFixed(1)} m`;
  return `${Math.round(mm)} mm`;
}

export default function InkPage() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    let stop = false;
    void (async () => {
      // kick a scan for anything unscanned, then poll while it runs
      await fetch("/api/ink", { method: "POST" });
      while (!stop) {
        const res = await fetch("/api/ink");
        if (res.ok) {
          const r: Report = await res.json();
          setReport(r);
          if (!r.scan.running) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  const maxTool = report?.tools[0]?.n ?? 1;

  return (
    <main className="page-fade flex-1 flex flex-col items-center px-6 py-16">
      <Header />
      <section className="w-full max-w-4xl flex flex-col gap-6">
        {!report ? (
          <p className="text-faint text-center py-8">measuring your ink…</p>
        ) : (
          <>
            {report.scan.running && (
              <p className="text-xs text-faint text-center">
                reading strokes… {report.scan.done} of {report.scan.total} documents
              </p>
            )}
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft text-center">
                <div className="text-3xl font-semibold">
                  {distanceLabel(report.totals.mm)}
                </div>
                <div className="text-sm text-graphite mt-1">of ink laid down</div>
              </div>
              <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft text-center">
                <div className="text-3xl font-semibold">
                  {report.totals.strokes.toLocaleString()}
                </div>
                <div className="text-sm text-graphite mt-1">
                  pen strokes across {report.totals.docs} docs
                </div>
              </div>
              <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft text-center">
                <div className="text-3xl font-semibold">
                  {Math.round(report.totals.pressure * 100)}%
                </div>
                <div className="text-sm text-graphite mt-1">average pen pressure</div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 items-start">
              <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft">
                <h2 className="text-sm text-graphite mb-4">your pens</h2>
                {report.tools.length === 0 ? (
                  <p className="text-sm text-faint">no strokes scanned yet</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {report.tools.map((t) => (
                      <li key={t.name} className="flex flex-col gap-1">
                        <div className="flex justify-between text-sm">
                          <span>{t.name}</span>
                          <span className="text-faint">{t.n.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-accent-soft overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${Math.max(3, (t.n / maxTool) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft">
                <h2 className="text-sm text-graphite mb-4">inkiest documents</h2>
                {report.topDocs.length === 0 ? (
                  <p className="text-sm text-faint">nothing yet</p>
                ) : (
                  <ul className="flex flex-col">
                    {report.topDocs.map((d) => (
                      <li
                        key={d.name}
                        className="flex items-baseline justify-between gap-3 py-2 border-b border-line last:border-0"
                      >
                        <span className="text-[15px] truncate">{d.name}</span>
                        <span className="text-xs text-graphite shrink-0">
                          {distanceLabel(d.distance_mm)} · {d.strokes.toLocaleString()} strokes
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <details className="bg-card border border-line rounded-2xl px-6 py-4 shadow-soft text-graphite">
              <summary className="text-sm cursor-pointer select-none marker:text-faint">
                how this is measured
              </summary>
              <div className="text-sm text-graphite leading-relaxed mt-3 flex flex-col gap-2.5">
                <p>
                  every page you draw on is stored in reMarkable&apos;s own binary
                  format. as you write, the tablet samples your pen many times a
                  second and records its position, pressure, speed and tilt into
                  that file. these numbers are read straight from that data, not
                  estimated.
                </p>
                <p>
                  inkwell parses those files with a custom engine written in rust,
                  validated stroke for stroke against the reference implementation.
                  it pulls out every pen stroke and every sample point.
                </p>
                <ul className="flex flex-col gap-1.5 text-[13px] text-graphite">
                  <li>
                    <span className="text-ink">strokes</span> — one continuous
                    pen-down motion each; counted across every page.
                  </li>
                  <li>
                    <span className="text-ink">distance</span> — the straight-line
                    gap between consecutive sample points, summed over every
                    stroke, then converted to real length using the screen&apos;s
                    226 dpi (1 unit ≈ 0.112 mm). it is the path your pen actually
                    traced, ink on the page.
                  </li>
                  <li>
                    <span className="text-ink">pressure</span> — each sample carries
                    a 0 to 255 pressure reading from the digitizer; this is their
                    average as a percent.
                  </li>
                  <li>
                    <span className="text-ink">pens</span> — each stroke records which
                    tool drew it, so the counts are your genuine pen usage.
                  </li>
                </ul>
              </div>
            </details>
          </>
        )}
      </section>
    </main>
  );
}
