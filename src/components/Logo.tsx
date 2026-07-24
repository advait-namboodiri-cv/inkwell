// the inkwell mark: a nib drawn with a signature's curve, resting in a circle.
// stroke-based so it inherits the parent's color (site header tints it ink).
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="16" cy="16" r="12.5" stroke="currentColor" strokeWidth="1.8" />
      {/* curved nib, leaning like a pen mid-stroke */}
      <path
        d="M17.2 8.4 C 13.6 12.2 11.9 15.3 12 17.9 C 12.1 20.2 13.8 21.9 16.1 21.9 C 18.4 21.9 20 20.2 20 17.9 C 20 15.4 19.1 12.1 17.2 8.4 Z"
        fill="currentColor"
      />
      {/* slit, softly curved */}
      <path
        d="M16.6 13.2 C 16.1 14.8 15.9 16.3 16.1 17.9"
        stroke="var(--paper, #faf7f0)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="16.1" cy="18.6" r="1.15" fill="var(--paper, #faf7f0)" />
      {/* the signature: a swash flowing out of the nib */}
      <path
        d="M13.2 23.6 C 15.6 24.9 18.9 24.6 21.4 22.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
