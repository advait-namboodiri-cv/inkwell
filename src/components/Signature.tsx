// quiet credit, in the page flow at the very bottom so it never sits on top
// of anything
export default function Signature() {
  return (
    <footer className="w-full flex items-center justify-center gap-1.5 pb-6 pt-2 text-[11px] text-faint tracking-wide">
      made by advait namboodiri
      <svg
        width="11"
        height="11"
        viewBox="0 0 40 36"
        aria-hidden
        className="translate-y-[0.5px]"
      >
        <path
          d="M20 4 C 14 11 11 16.5 11 21 C 11 25.5 14.5 29 20 29 C 25.5 29 29 25.5 29 21 C 29 16.5 26 11 20 4 Z M20 14 L20 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </footer>
  );
}
