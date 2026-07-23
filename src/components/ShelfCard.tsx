"use client";

import { timeAgo } from "@/lib/format";

export type ShelfItem = {
  name: string;
  fileType: string;
  page: number;
  pageCount: number;
  percent: number;
  lastOpened: number;
};

export default function ShelfCard({ shelf }: { shelf: ShelfItem[] }) {
  return (
    <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
      <h2 className="text-sm text-graphite">reading shelf</h2>
      {shelf.length === 0 ? (
        <p className="text-sm text-faint">
          nothing in flight — open a book on your tablet and it&apos;ll appear here
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shelf.map((b) => (
            <li key={b.name} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] truncate">{b.name}</span>
                <span className="text-xs text-graphite shrink-0">
                  p. {b.page} of {b.pageCount}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-accent-soft overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-700"
                  style={{ width: `${b.percent}%` }}
                />
              </div>
              <span className="text-xs text-faint">
                {b.percent}% · last read {timeAgo(b.lastOpened)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
