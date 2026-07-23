// inkwell mark: a fountain-pen nib inside a circle, drawn in currentColor
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
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="2" />
      {/* nib: body */}
      <path
        d="M16 7.5 C 12.8 12 11.5 15.5 11.5 18.2 C 11.5 21 13.4 23 16 23 C 18.6 23 20.5 21 20.5 18.2 C 20.5 15.5 19.2 12 16 7.5 Z"
        fill="currentColor"
      />
      {/* nib: slit + breather hole, cut out in paper */}
      <line
        x1="16"
        y1="13.5"
        x2="16"
        y2="19.4"
        stroke="var(--paper)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="19.6" r="1.5" fill="var(--paper)" />
    </svg>
  );
}
