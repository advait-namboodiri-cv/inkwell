"use client";

export type HeatData = {
  days: { day: string; pages: number }[];
  totals: { events: number; docs: number };
};

// deliberate hardcoded ink-blue ramp (like flowstate's sage heatmap steps)
const EMPTY = "#efeadd";
const RAMP = ["#cfdde2", "#9fbcc7", "#6f97a6", "#47758a", "#2c4655"];
const THRESHOLDS = [1, 3, 6, 12, 20]; // pages/day to reach each ramp step

function shade(pages: number): string {
  if (pages <= 0) return EMPTY;
  let i = 0;
  for (let t = 0; t < THRESHOLDS.length; t++) if (pages >= THRESHOLDS[t]) i = t;
  return RAMP[i];
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const CELL = 12;
const GAP = 3;
const WEEKS = 53;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export default function HeatmapCard({ data }: { data: HeatData }) {
  const byDay = new Map(data.days.map((d) => [d.day, d.pages]));

  // grid ends on today's week (Monday-aligned), spans 53 weeks back
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endMonday = new Date(end);
  endMonday.setDate(end.getDate() - ((end.getDay() + 6) % 7));
  const start = new Date(endMonday);
  start.setDate(endMonday.getDate() - (WEEKS - 1) * 7);

  const cells: { x: number; y: number; day: string; pages: number; future: boolean }[] = [];
  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + w * 7);
    if (weekStart.getMonth() !== lastMonth) {
      lastMonth = weekStart.getMonth();
      monthLabels.push({ x: w * (CELL + GAP), label: MONTHS[lastMonth] });
    }
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + d);
      const key = isoDay(date);
      cells.push({
        x: w * (CELL + GAP),
        y: d * (CELL + GAP),
        day: key,
        pages: byDay.get(key) ?? 0,
        future: date > end,
      });
    }
  }
  const width = WEEKS * (CELL + GAP) - GAP;
  const height = 7 * (CELL + GAP) - GAP;

  return (
    <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm text-graphite">a year of ink</h2>
        <span className="text-xs text-faint">
          {data.totals.events} page saves across {data.totals.docs} docs
        </span>
      </div>
      <svg
        viewBox={`0 -18 ${width} ${height + 18}`}
        className="w-full h-auto"
        role="img"
        aria-label="pages annotated per day over the last year"
      >
        {monthLabels.map((m) => (
          <text key={`${m.label}-${m.x}`} x={m.x} y={-6} fontSize={10} fill="var(--faint)">
            {m.label}
          </text>
        ))}
        {cells.map(
          (c) =>
            !c.future && (
              <rect
                key={c.day}
                x={c.x}
                y={c.y}
                width={CELL}
                height={CELL}
                rx={3}
                fill={shade(c.pages)}
              >
                <title>
                  {c.day} · {c.pages} page{c.pages === 1 ? "" : "s"}
                </title>
              </rect>
            )
        )}
      </svg>
      <div className="flex items-center gap-1.5 text-xs text-faint self-end">
        less
        <span className="w-3 h-3 rounded-[3px]" style={{ background: EMPTY }} />
        {RAMP.map((c) => (
          <span key={c} className="w-3 h-3 rounded-[3px]" style={{ background: c }} />
        ))}
        more
      </div>
    </div>
  );
}
