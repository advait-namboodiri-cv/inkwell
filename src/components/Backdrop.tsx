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
// durations are short and delays tightly staggered so many glyphs share the
// stage at once — pens especially (nib 0, quill 3, pencil 5) — appearing and
// disappearing continuously enough to notice, never so fast it feels busy.
const SPOTS: { top: string; left: string; size: number; dur: number; delay: number; glyph: number; sway?: boolean }[] = [
  { top: "8%", left: "5%", size: 52, dur: 14, delay: 0, glyph: 0 },
  { top: "16%", left: "88%", size: 56, dur: 16, delay: 1.5, glyph: 2, sway: true },
  { top: "30%", left: "12%", size: 44, dur: 13, delay: 3, glyph: 3 },
  { top: "6%", left: "38%", size: 42, dur: 17, delay: 4.5, glyph: 5, sway: true },
  { top: "12%", left: "64%", size: 46, dur: 15, delay: 6, glyph: 0 },
  { top: "40%", left: "92%", size: 50, dur: 16, delay: 2.5, glyph: 1 },
  { top: "50%", left: "4%", size: 58, dur: 18, delay: 7.5, glyph: 3, sway: true },
  { top: "62%", left: "90%", size: 44, dur: 14, delay: 9, glyph: 0 },
  { top: "72%", left: "8%", size: 48, dur: 15, delay: 0.8, glyph: 5, sway: true },
  { top: "84%", left: "86%", size: 54, dur: 17, delay: 5, glyph: 5 },
  { top: "90%", left: "30%", size: 46, dur: 13, delay: 8, glyph: 1, sway: true },
  { top: "86%", left: "58%", size: 42, dur: 15, delay: 2, glyph: 3 },
  { top: "68%", left: "45%", size: 40, dur: 19, delay: 11, glyph: 0 },
  { top: "34%", left: "70%", size: 38, dur: 14, delay: 5.5, glyph: 3, sway: true },
  { top: "55%", left: "25%", size: 40, dur: 16, delay: 10, glyph: 5 },
  { top: "22%", left: "45%", size: 36, dur: 15, delay: 12.5, glyph: 4, sway: true },
  { top: "44%", left: "55%", size: 38, dur: 18, delay: 13, glyph: 0 },
  { top: "78%", left: "72%", size: 44, dur: 15, delay: 14, glyph: 5 },
  // second wave — fills the gaps and keeps pens on screen almost always
  { top: "4%", left: "20%", size: 38, dur: 16, delay: 9.5, glyph: 5, sway: true },
  { top: "10%", left: "78%", size: 40, dur: 14, delay: 3.8, glyph: 3 },
  { top: "26%", left: "30%", size: 34, dur: 17, delay: 15, glyph: 0, sway: true },
  { top: "24%", left: "58%", size: 42, dur: 15, delay: 6.8, glyph: 6 },
  { top: "38%", left: "84%", size: 36, dur: 16, delay: 11.5, glyph: 5, sway: true },
  { top: "46%", left: "16%", size: 44, dur: 18, delay: 4.2, glyph: 0 },
  { top: "58%", left: "62%", size: 38, dur: 14, delay: 8.5, glyph: 3, sway: true },
  { top: "60%", left: "36%", size: 34, dur: 17, delay: 13.8, glyph: 5 },
  { top: "74%", left: "22%", size: 40, dur: 15, delay: 1.2, glyph: 3, sway: true },
  { top: "76%", left: "52%", size: 36, dur: 16, delay: 10.5, glyph: 0 },
  { top: "88%", left: "70%", size: 42, dur: 14, delay: 7, glyph: 3, sway: true },
  { top: "92%", left: "44%", size: 38, dur: 18, delay: 12, glyph: 5 },
  { top: "18%", left: "6%", size: 34, dur: 15, delay: 16, glyph: 3, sway: true },
  { top: "52%", left: "78%", size: 40, dur: 16, delay: 2.8, glyph: 0 },
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
