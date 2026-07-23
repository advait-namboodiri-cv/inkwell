"use client";

export type HighlightsData = {
  totals: { passages: number; books: number };
  recent: { text: string; color: number; doc: string }[];
  daily: { text: string; doc: string } | null;
};

export default function HighlightsCard({ data }: { data: HighlightsData }) {
  if (data.totals.passages === 0) return null;
  return (
    <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm text-graphite">passages</h2>
        <span className="text-xs text-faint">
          {data.totals.passages} highlights from {data.totals.books}{" "}
          {data.totals.books === 1 ? "doc" : "docs"}
        </span>
      </div>

      {data.daily && (
        <blockquote className="border-l-2 border-accent pl-4 py-1">
          <p className="text-[17px] leading-relaxed">“{data.daily.text}”</p>
          <cite className="text-xs text-graphite not-italic">{data.daily.doc}</cite>
          <div className="text-[10px] text-faint mt-1">today&apos;s resurfaced passage</div>
        </blockquote>
      )}

      <ul className="flex flex-col gap-2.5">
        {data.recent.slice(0, 6).map((h, i) => (
          <li key={i} className="flex flex-col">
            <span className="text-sm leading-relaxed">
              <span className="bg-accent-soft rounded px-1 -mx-1">{h.text}</span>
            </span>
            <span className="text-xs text-faint mt-0.5">{h.doc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
