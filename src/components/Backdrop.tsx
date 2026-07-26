// ambient writing-room backdrop: faint nibs, inkwells, paper and quills that
// slowly appear, drift and fade behind every page. pure decoration, so it is
// aria-hidden, never catches the pointer, and stays whisper-quiet.
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

const GLYPHS = [NIB, INKWELL_POT, PAPER, QUILL];

// fixed, deterministic placements so server and client render identically
const SPOTS: { top: string; left: string; size: number; dur: number; delay: number; glyph: number }[] = [
  { top: "12%", left: "6%", size: 44, dur: 34, delay: 0, glyph: 0 },
  { top: "68%", left: "4%", size: 56, dur: 42, delay: 7, glyph: 1 },
  { top: "24%", left: "90%", size: 48, dur: 38, delay: 3, glyph: 2 },
  { top: "80%", left: "88%", size: 42, dur: 30, delay: 12, glyph: 3 },
  { top: "45%", left: "94%", size: 38, dur: 46, delay: 19, glyph: 0 },
  { top: "88%", left: "40%", size: 46, dur: 40, delay: 9, glyph: 2 },
  { top: "6%", left: "72%", size: 40, dur: 36, delay: 15, glyph: 3 },
  { top: "52%", left: "2%", size: 40, dur: 44, delay: 23, glyph: 1 },
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
          className="backdrop-glyph text-ink absolute"
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
