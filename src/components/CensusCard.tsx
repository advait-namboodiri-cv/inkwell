"use client";

import { formatBytes, timeAgo } from "@/lib/format";

export type Census = {
  totals: { docs: number; folders: number; trashed: number; bytes: number };
  typeMix: { kind: string; n: number }[];
  biggestFolders: { name: string; n: number }[];
  staleCount: number;
  activeWeek: number;
  oldest: { name: string; last_modified: number } | null;
};

export default function CensusCard({ census }: { census: Census }) {
  const { totals } = census;
  return (
    <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-5">
      <h2 className="text-sm text-graphite">library census</h2>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-2xl font-semibold">{totals.docs}</div>
          <div className="text-xs text-graphite mt-0.5">documents</div>
        </div>
        <div>
          <div className="text-2xl font-semibold">{totals.folders}</div>
          <div className="text-xs text-graphite mt-0.5">folders</div>
        </div>
        <div>
          <div className="text-2xl font-semibold">{formatBytes(totals.bytes)}</div>
          <div className="text-xs text-graphite mt-0.5">in the well</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {census.typeMix.map((t) => (
          <span
            key={t.kind}
            className="text-xs bg-accent-mist text-accent-deep rounded-full px-3 py-1"
          >
            {t.n} {t.kind}
            {t.n === 1 ? "" : "s"}
          </span>
        ))}
        {census.totals.trashed > 0 && (
          <span className="text-xs bg-danger-soft text-danger rounded-full px-3 py-1">
            {census.totals.trashed} in trash
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-xs text-faint">busiest folders</h3>
        {census.biggestFolders.map((f) => (
          <div key={f.name} className="flex items-center justify-between text-sm">
            <span className="truncate">{f.name}</span>
            <span className="text-graphite shrink-0 ml-3">{f.n}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-3 flex flex-col gap-1 text-sm text-graphite">
        <p>
          <span className="text-ink font-medium">{census.activeWeek}</span> docs touched this
          week · <span className="text-ink font-medium">{census.staleCount}</span> untouched in
          6+ months
        </p>
        {census.oldest && (
          <p className="text-xs text-faint">
            oldest: {census.oldest.name} ({timeAgo(census.oldest.last_modified)})
          </p>
        )}
      </div>
    </div>
  );
}
