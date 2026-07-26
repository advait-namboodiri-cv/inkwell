// ambient writing-room backdrop: nibs, inkwells, paper, quills, drops and
// pencils that appear, drift and fade behind every page. decorative only:
// aria-hidden and pointer-transparent.
const NIB = (
  <path
    d="M20 4 C 14 11 11 16.5 11 21 C 11 25.5 14.5 29 20 29 C 25.5 29 29 25.5 29 21 C 29 16.5 26 11 20 4 Z M20 14 L20 22 M20 23.5 a1.6 1.6 0 1 0 0.01 0"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
  />
);

const INKWELL_POT = (
  <path
    d="M12 14 h16 M14 14 c-2 3 -3 6 -3 9 a9 6 0 0 0 18 0 c0 -3 -1 -6 -3 -9 M17 14 v-4 h6 v4 M25 8 l6 -5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const PAPER = (
  <path
    d="M10 5 h14 l6 6 v24 h-20 z M24 5 v6 h6 M14 16 h12 M14 21 h12 M14 26 h8"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const QUILL = (
  <path
    d="M30 4 C 21 7 13 14 9 24 l-2 6 6 -2 C 23 24 28 15 30 4 Z M9 24 C 15 18 21 13 27 8"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const DROP = (
  <path
    d="M20 6 C 16 12 13.5 16.5 13.5 20.5 A 6.5 6.5 0 0 0 26.5 20.5 C 26.5 16.5 24 12 20 6 Z"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
  />
);

const PENCIL = (
  <path
    d="M8 28 l2 -6 L 26 6 l4 4 L 14 26 z M10 22 l4 4 M23 9 l4 4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const BOOK = (
  <path
    d="M20 9 C 16 6.5 11 6 7 7 v20 c4 -1 9 -0.5 13 2 c4 -2.5 9 -3 13 -2 V7 c-4 -1 -9 -0.5 -13 2 z M20 9 v20 M11 12 h5 M11 16 h5 M24 12 h5 M24 16 h5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const GLYPHS = [NIB, INKWELL_POT, PAPER, QUILL, DROP, PENCIL, BOOK];

// deterministic placements so server and client render identically.
// durations are short and delays staggered so several glyphs share the
// stage at any moment, appearing and disappearing continuously.
const SPOTS: { top: string; left: string; size: number; dur: number; delay: number; glyph: number; sway?: boolean }[] = [
  { top: "8%", left: "5%", size: 52, dur: 16, delay: 0, glyph: 0 },
  { top: "16%", left: "88%", size: 56, dur: 18, delay: 2, glyph: 2, sway: true },
  { top: "30%", left: "12%", size: 44, dur: 15, delay: 5, glyph: 4 },
  { top: "6%", left: "38%", size: 42, dur: 20, delay: 8, glyph: 5, sway: true },
  { top: "12%", left: "64%", size: 46, dur: 17, delay: 11, glyph: 6 },
  { top: "40%", left: "92%", size: 50, dur: 19, delay: 4, glyph: 1 },
  { top: "50%", left: "4%", size: 58, dur: 21, delay: 9, glyph: 3, sway: true },
  { top: "62%", left: "90%", size: 44, dur: 16, delay: 13, glyph: 0 },
  { top: "72%", left: "8%", size: 48, dur: 18, delay: 1, glyph: 6, sway: true },
  { top: "84%", left: "86%", size: 54, dur: 20, delay: 6, glyph: 5 },
  { top: "90%", left: "30%", size: 46, dur: 15, delay: 10, glyph: 1, sway: true },
  { top: "86%", left: "58%", size: 42, dur: 17, delay: 3, glyph: 4 },
  { top: "68%", left: "45%", size: 40, dur: 22, delay: 14, glyph: 2 },
  { top: "34%", left: "70%", size: 38, dur: 16, delay: 7, glyph: 3, sway: true },
  { top: "55%", left: "25%", size: 40, dur: 19, delay: 12, glyph: 5 },
  { top: "22%", left: "45%", size: 36, dur: 18, delay: 15, glyph: 4, sway: true },
  { top: "44%", left: "55%", size: 38, dur: 21, delay: 16, glyph: 0 },
  { top: "78%", left: "72%", size: 44, dur: 17, delay: 17, glyph: 6 },
];

export default function Backdrop() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {SPOTS.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 40 36"
          width={s.size}
          height={s.size}
          className={`${s.sway ? "backdrop-glyph-sway" : "backdrop-glyph"} text-ink absolute`}
          style={{
            top: s.top,
            left: s.left,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        >
          {GLYPHS[s.glyph]}
        </svg>
      ))}
    </div>
  );
}
